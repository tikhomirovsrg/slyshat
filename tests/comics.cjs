const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{test}=require('node:test'),{DatabaseSync}=require('node:sqlite'),ts=require('typescript');
require.extensions['.ts']=require.extensions['.tsx']=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,file);
const {initializeDatabase}=require('../lib/db-migrations.mjs'),{migrateComics,buildComicBoard}=require('../lib/comic-migration.mjs');
const release=JSON.parse(fs.readFileSync('content/comics/comic-v1.json')),course=JSON.parse(fs.readFileSync('content/story-course/course-v1.json'));
test('Every story scene has a valid storyboard, illustration and exact current-scene clue',()=>require('../scripts/comics/validate.cjs'));
test('Schema 6 upgrade preserves all saved routes and endings, is idempotent, and rolls back invalid comics',()=>{
 const db=new DatabaseSync(':memory:'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'comic-migration-'));
 try{initializeDatabase(db);db.exec('DROP TABLE comic_boards; DROP TABLE comic_releases; PRAGMA user_version=6;');
  db.prepare('INSERT INTO users VALUES(?,?,?,?)').run('reader','17','Reader','2026-10-21');db.prepare('INSERT INTO study_profiles VALUES(?,?,?,?,?)').run('reader',JSON.stringify({journey:{active:{it:'coffee-it'},stories:{'coffee-it':{path:[0,0,0],heard:['start','short'],assisted:['place'],completedAt:'2026-10-21',endings:['short-end']}}}}),9,'keep','2026-10-21');
  const before=db.prepare('SELECT * FROM study_profiles').all(),file=path.join(dir,'invalid.json');fs.writeFileSync(file,JSON.stringify({...release,courseSha256:'wrong'}));
  assert.throws(()=>initializeDatabase(db,undefined,undefined,file),/Invalid comic/);assert.equal(db.prepare('PRAGMA user_version').get().user_version,6);assert(!db.prepare("SELECT name FROM sqlite_master WHERE name='comic_boards'").get());assert.deepEqual(db.prepare('SELECT * FROM study_profiles').all(),before);
  assert.equal(initializeDatabase(db).comicsSeeded,true);assert.equal(initializeDatabase(db).comicsSeeded,false);assert.equal(db.prepare('SELECT count(*) n FROM comic_boards').get().n,2000);assert.equal(db.prepare('PRAGMA user_version').get().user_version,7);assert.deepEqual(db.prepare('SELECT * FROM study_profiles').all(),before);
  fs.writeFileSync(file,JSON.stringify({...release,publishedAt:'changed'}));assert.throws(()=>migrateComics(db,file),/new releaseId/);
 }finally{db.close();fs.rmSync(dir,{recursive:true,force:true});}
});
test('Unread scene and locked endings never render translations or future outcomes',()=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{ComicStage,EndingCollection,comicPose}=require('../app/comic-stage.tsx');
 const raw=course.stories.find(s=>s.id==='coffee-it'),board=buildComicBoard(raw,release,ref=>course.segments[ref.id].ru),story={...raw,comic:board};
 const props={story,nodeId:'start',frame:1,voice:'if_sara',playing:false,position:0,duration:5,motion:true,inspected:false,onInspect(){},disabled:false};
 const draw=p=>renderToStaticMarkup(React.createElement(ComicStage,p));const html=draw(props);assert(html.includes('female-neutral.webp'));assert(html.includes('male-neutral.webp'));assert(html.includes('Осмотреть'));assert(!html.includes(board.scenes.start.clue.body));assert(draw({...props,inspected:true}).includes(board.scenes.start.clue.body));
 const panel=board.scenes.start;assert.equal(comicPose(panel,0,true,true),'neutral');assert.equal(comicPose(panel,2,true,true),'speaking');assert.equal(comicPose(panel,2,false,true),'neutral');assert.equal(comicPose(panel,2,true,false),'neutral');
 const p={path:[],heard:[],assisted:[],finishedAt:null,updatedAt:'2026-10-21'};const collection=progress=>renderToStaticMarkup(React.createElement(EndingCollection,{story,progress,current:'start'}));const locked=collection(p);for(const n of Object.values(story.nodes))if(n.outcome){assert(!locked.includes(n.outcome.title));assert(!locked.includes(n.outcome.body));}
 const opened=collection({...p,endings:['short-end']});assert(opened.includes(story.nodes['short-end'].outcome.title));assert(!opened.includes(story.nodes['take-end'].outcome.title));
});
test('Inspection is reading assistance, keeps the route intact, and never earns listening credit',()=>{
 const {assistJourney,restartJourney}=require('../app/story-course-state.ts'),p={path:[0],heard:['start'],assisted:[],finishedAt:null,updatedAt:'2026-10-21',completedAt:'2026-10-20',endings:['short-end']};
 const assisted=assistJourney(p,'short');assert.deepEqual(assisted.heard,['start']);assert.deepEqual(assisted.path,[0]);assert.deepEqual(assisted.assisted,['short']);assert.deepEqual(assistJourney(assisted,'short').assisted,['short']);assert.deepEqual(p.assisted,[]);assert.deepEqual(restartJourney(assisted,'short').endings,['short-end']);
});
