const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{test}=require('node:test'),{DatabaseSync}=require('node:sqlite'),ts=require('typescript');
require.extensions['.ts']=require.extensions['.tsx']=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true,resolveJsonModule:true}}).outputText,file);
const {initializeDatabase}=require('../lib/db-migrations.mjs');
const {characterHash,characterForVoice,validateCharacterCast}=require('../lib/character-cast.mjs');
const {validateCharacterAudio,loadCharacterAudio,characterClipKey}=require('../lib/character-audio.mjs');
const courseBytes=fs.readFileSync('content/story-course/course-v1.json'),libraryBytes=fs.readFileSync('content/audio-library/series-v1.json'),castBytes=fs.readFileSync('content/characters/cast-v1.json');
const course=JSON.parse(courseBytes),library=JSON.parse(libraryBytes),cast=JSON.parse(castBytes),castSha=characterHash(castBytes);
const sources={course,librarySegments:library.segments,courseSha256:characterHash(courseBytes),librarySha256:characterHash(libraryBytes)};

test('All 2000 casts cover original speakers and bind by explicit source identity, never voice-name gender',()=>{
  assert.equal(validateCharacterCast(cast,sources),cast);assert.equal(Object.keys(cast.stories).length,2000);assert.equal(Object.keys(cast.actors).length,6);
  const assignment={cast:[{actorId:'role-one',sourceVoice:'arbitrary-speaker-A'},{actorId:'role-two',sourceVoice:'arbitrary-speaker-B'}]};
  assert.equal(characterForVoice(assignment,'arbitrary-speaker-A').actorId,'role-one');assert.throws(()=>characterForVoice(assignment,'female'),/no source speaker/);
  const wrong=structuredClone(cast),s=course.stories.find(s=>!s.legacy);wrong.stories[s.id].cast[0].sourceVoice='missing-original-speaker';assert.throws(()=>validateCharacterCast(wrong,sources),/no source speaker/);
  const missing=structuredClone(cast);delete missing.stories[s.id];assert.throws(()=>validateCharacterCast(missing,sources),/coverage/);
});

test('Schema 7→8 is transactional and preserves original boards, routes, accounts and progress',()=>{
  const db=new DatabaseSync(':memory:'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'character-migration-'));
  try{
    initializeDatabase(db);db.exec('DROP TABLE story_character_cast; DROP TABLE character_cast_releases; PRAGMA user_version=7;');
    db.prepare('INSERT INTO users VALUES(?,?,?,?)').run('kept','0123','Existing learner','2026-10-21');
    db.prepare('INSERT INTO sessions VALUES(?,?,?)').run('session-hash','kept',2000000000);
    db.prepare('INSERT INTO progress VALUES(?,?,?,?,?,?)').run('kept','coffee-01','{"phase":"dialogue","node":"short"}',4,'unchanged-progress','2026-10-21');
    db.prepare('INSERT INTO runs VALUES(?,?,?,?,?,?)').run('kept','coffee-01','2026-10-20',2,1,3);
    db.prepare('INSERT INTO study_profiles VALUES(?,?,?,?,?)').run('kept',JSON.stringify({journey:{active:{en:'coffee-01'},stories:{'coffee-01':{path:[1,0],heard:['start'],assisted:['short'],completedAt:'2026-10-20',endings:['short-end']}}},audioPractice:{kept:true}}),9,'unchanged-profile','2026-10-21');
    const tables=['users','sessions','progress','runs','study_profiles','comic_boards','comic_releases','story_course_entries','story_course_releases'];
    const snapshot=()=>tables.map(table=>db.prepare('SELECT * FROM '+table).all()),before=snapshot(),invalid=path.join(dir,'invalid.json');
    fs.writeFileSync(invalid,JSON.stringify({...cast,courseSha256:'wrong'}));
    assert.throws(()=>initializeDatabase(db,undefined,undefined,undefined,invalid),/Invalid character cast/);
    assert.equal(db.prepare('PRAGMA user_version').get().user_version,7);
    assert(!db.prepare("SELECT name FROM sqlite_master WHERE name='story_character_cast'").get());assert.deepEqual(snapshot(),before);
    assert.equal(initializeDatabase(db).charactersSeeded,true);assert.equal(db.prepare('PRAGMA user_version').get().user_version,8);
    assert.equal(db.prepare('SELECT count(*) n FROM story_character_cast').get().n,2000);assert.deepEqual(snapshot(),before);
    assert.equal(initializeDatabase(db).charactersSeeded,false);assert.deepEqual(snapshot(),before);
    fs.writeFileSync(invalid,JSON.stringify({...cast,provenance:'changed published bytes'}));
    assert.throws(()=>initializeDatabase(db,undefined,undefined,undefined,invalid),/new releaseId/);assert.deepEqual(snapshot(),before);
  }finally{db.close();fs.rmSync(dir,{recursive:true,force:true});}
});

// This is a protocol fixture, not synthesized speech or an audio-quality test.
function recordingFixture(){
  const bytes=Buffer.from('ID3-character-protocol-fixture'),manifest={formatVersion:1,releaseId:'character-audio-v1',castSha256:castSha,courseSha256:sources.courseSha256,librarySha256:sources.librarySha256,modelSha256:'1'.repeat(64),voicesSha256:'2'.repeat(64),sampleRate:24000,readyStories:2000,files:{'fixture.mp3':{sha256:characterHash(bytes),bytes:bytes.length,duration:2}},segments:{},stories:{}};
  const add=(profileId,text,language)=>{const key=characterClipKey(profileId,text),profile=cast.voiceProfiles[profileId];manifest.segments[key]={file:'fixture.mp3',start:0,end:1,textSha256:characterHash(text),voiceProfileId:profileId,voice:profile.voice,language,speed:profile.speed};return key;};
  for(const story of course.stories){const assignment=cast.stories[story.id],player=assignment.cast.find(a=>a.actorId===assignment.playerActorId);manifest.stories[story.id]={nodes:Object.fromEntries(Object.entries(story.nodes).map(([id,node])=>[id,{clips:node.clips.map(ref=>{const data=(ref.set==='course'?course:library).segments[ref.id];return add(characterForVoice(assignment,data.voice).voiceProfileId,data.text,story.language);}),choices:node.choices.map(choice=>add(player.voiceProfileId,choice.text,story.language))}]))};}
  return {manifest,bytes};
}

test('Character audio requires complete dialogue/choice coverage, exact texts and actor voice profiles',()=>{
  const {manifest}=recordingFixture();assert.equal(validateCharacterAudio(manifest,cast,sources,castSha),manifest);
  const story=course.stories[0],node=manifest.stories[story.id].nodes[story.start],key=node.choices[0],original=manifest.segments[key];
  manifest.segments[key]={...original,textSha256:characterHash(story.nodes[story.start].choices[0].text+' ')};
  assert.throws(()=>validateCharacterAudio(manifest,cast,sources,castSha),/text or voice profile/);manifest.segments[key]=original;
  const old=node.choices[0];node.choices[0]=node.choices[1];assert.throws(()=>validateCharacterAudio(manifest,cast,sources,castSha),/text or voice profile/);node.choices[0]=old;
  manifest.segments[key]={...original,voice:'legacy-voice'};assert.throws(()=>validateCharacterAudio(manifest,cast,sources,castSha),/text or voice profile/);manifest.segments[key]=original;
  const removed=node.choices.pop();assert.throws(()=>validateCharacterAudio(manifest,cast,sources,castSha),/Incomplete/);node.choices.push(removed);
  const entry=manifest.stories[story.id];delete manifest.stories[story.id];assert.throws(()=>validateCharacterAudio(manifest,cast,sources,castSha),/source version/);manifest.stories[story.id]=entry;
  assert.throws(()=>validateCharacterAudio({...manifest,castSha256:'0'.repeat(64)},cast,sources,castSha),/source version/);
});

test('Missing character audio permits legacy fallback; present incomplete or altered audio fails closed',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'character-audio-'));
  try{
    assert.equal(loadCharacterAudio(cast,sources,castSha,dir),null);
    const {manifest,bytes}=recordingFixture();fs.writeFileSync(path.join(dir,'fixture.mp3'),bytes);fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(manifest));
    assert.equal(loadCharacterAudio(cast,sources,castSha,dir).readyStories,2000);
    fs.writeFileSync(path.join(dir,'fixture.mp3'),Buffer.from('changed'));assert.throws(()=>loadCharacterAudio(cast,sources,castSha,dir),/checksum mismatch/);
    fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify({...manifest,readyStories:1999}));assert.throws(()=>loadCharacterAudio(cast,sources,castSha,dir),/source version/);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('Course API enriches old IDs/boards and uses the actual recorded voice for dialogue and player choices',()=>{
  const db=new DatabaseSync(':memory:'),dbModule=require('../lib/db.ts'),originalGetDb=dbModule.getDb;initializeDatabase(db);dbModule.getDb=()=>db;
  try{
    const {courseStory,storyCatalog}=require('../lib/story-course.ts'),ready=fs.existsSync('public/audio/characters/manifest.json');
    for(const language of ['en','it']){
      const catalog=storyCatalog(language);assert.equal(catalog.total,1000);assert(catalog.items.every(s=>s.comic.coverActor?.artBase));
      for(const legacy of [true,false]){
        const raw=course.stories.find(s=>s.language===language&&s.legacy===legacy),story=courseStory(raw.id),assignment=cast.stories[raw.id];
        assert.equal(story.id,raw.id);assert.deepEqual(Object.keys(story.nodes),Object.keys(raw.nodes));assert.equal(story.comic.releaseId,'comic-v1');assert.equal(story.comic.castReleaseId,'character-cast-v1');assert.equal(story.comic.playerActorId,assignment.playerActorId);
        const oldBoard=JSON.parse(db.prepare('SELECT data_json FROM comic_boards WHERE story_id=?').get(raw.id).data_json);assert.deepEqual(story.comic.cast,oldBoard.cast);assert.deepEqual(story.comic.scenes,oldBoard.scenes);
        for(const [id,node] of Object.entries(raw.nodes)){
          node.clips.forEach((ref,i)=>{const source=(ref.set==='course'?course:library).segments[ref.id],member=characterForVoice(assignment,source.voice),clip=story.nodes[id].clips[i];assert.equal(clip.actorId,member.actorId);assert.equal(clip.actorName,member.name);assert.equal(clip.text,source.text);assert.equal(clip.voice,ready?cast.voiceProfiles[member.voiceProfileId].voice:source.voice);assert.equal(clip.source.startsWith('/audio/characters/'),ready);});
          node.choices.forEach((choice,i)=>{const actual=story.nodes[id].choices[i];assert.equal(actual.text,choice.text);assert.equal(actual.next,choice.next);assert.equal(!!actual.clip,ready);if(ready){assert.equal(actual.clip.actorId,assignment.playerActorId);assert.equal(actual.clip.text,choice.text);assert.equal(actual.clip.voice,cast.voiceProfiles[assignment.cast.find(a=>a.actorId===assignment.playerActorId).voiceProfileId].voice);}});
        }
      }
    }
    assert.equal(courseStory('unknown'),null);
  }finally{dbModule.getDb=originalGetDb;db.close();}
});
