const fs=require('node:fs'),assert=require('node:assert/strict'),{test}=require('node:test'),ts=require('typescript');
require.extensions['.ts']=require.extensions['.tsx']=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,file);
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const {ComicStage,ComicCover}=require('../app/comic-stage.tsx');
const actor=(id,name)=>({id,name,artBase:'/comics/characters/v1/'+id,artLayout:'sheet-2x2'});
const panel={location:'cafe',shot:'wide',mood:'neutral',prop:'cup',caption:'Утро в кафе',clue:{title:'Скрытая деталь',body:'Скрытый перевод'},beatAt:1};
const story={comic:{actors:[actor('traveler','Майя'),actor('host','Лео')],cast:['Legacy F','Legacy M'],scenes:{start:panel}}};
test('Human stage follows actor identity even when a voice prefix disagrees, without revealing translation',()=>{
 const markup=renderToStaticMarkup(React.createElement(ComicStage,{story,nodeId:'start',frame:1,voice:'bf_emma',actorId:'host',actorName:'Лео',playing:true,position:2,duration:4,motion:true,inspected:false,onInspect(){},disabled:false}));
 assert(markup.includes('traveler-sheet.png'));assert(markup.includes('host-sheet.png'));
 assert(!markup.includes('female-neutral.webp'));assert(!markup.includes('male-neutral.webp'));
 assert(markup.includes('Кафе. Майя и Лео.'));assert(markup.includes('Говорит Лео'));
 assert.match(markup,/novel-actor male active[^>]*><span class="character-art pose-speaking/);
 assert(!markup.includes('Скрытый перевод'));
});
test('Human cover uses story casting and the catalogue default has a human illustration',()=>{
 const markup=renderToStaticMarkup(React.createElement(ComicCover,{location:'gallery',actor:actor('curator','Эмма')}));
 assert(markup.includes('/comics/characters/v1/curator-sheet.png'));
 const defaultCover=renderToStaticMarkup(React.createElement(ComicCover,{location:'square'}));
 assert(defaultCover.includes('/comics/characters/v1/traveler-sheet.png'));
});
