import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import ts from 'typescript';
const source=readFileSync(new URL('../src/app/tools/keywords/page.tsx',import.meta.url),'utf8');
function mount(){
 const block=source.slice(source.indexOf('  async function search('),source.indexOf('  function download()'));
 const code=ts.transpileModule(block,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 const controller:{current:AbortController|null}={current:null};let timer=()=>{},release:(v:unknown)=>void=()=>{};const writes:unknown[]=[],errors:string[]=[],busy:boolean[]=[];let resets=0,scrolls=0;
 const search=new Function('loading','parseSeeds','query','endpoint','setSettingsOpen','setError','controller','setLoading','setTimeout','clearTimeout','fetch','validateKeywordResponse','setData','resetFilters','results',code+';return search;')(false,()=>['fixture'],'fixture','https://example.invalid',()=>{},(v:string)=>errors.push(v),controller,(v:boolean)=>busy.push(v),(f:()=>void)=>{timer=f;},()=>{},async()=>({ok:true,json:()=>new Promise(r=>release=r)}),(v:unknown)=>v,(v:unknown)=>writes.push(v),()=>resets++,{current:{scrollIntoView:()=>scrolls++}});
 const effect=source.slice(source.indexOf('  useEffect(() => {'),source.indexOf('  // Unrelated keywords'));
 const cleanupBlock=effect.slice(effect.lastIndexOf('return () =>'),effect.lastIndexOf('  }, []);'));
 const cleanup=new Function('controller',ts.transpileModule(cleanupBlock,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText)(controller);

 return{controller,writes,errors,busy,start:()=>search({preventDefault(){}}),tick:()=>timer(),finish:()=>release({keywords:[]}),cleanup,resets:()=>resets,scrolls:()=>scrolls};
}
const settle=()=>new Promise(r=>setImmediate(r));
test('normal keyword result updates once',async()=>{const m=mount();const p=m.start();await settle();m.finish();await p;assert.equal(m.writes.length,1);assert.equal(m.resets(),1);});
test('timeout cannot revive results with a late successful body',async()=>{const m=mount();const p=m.start();await settle();m.tick();m.finish();await p;assert.equal(m.writes.length,0);assert.equal(m.resets(),0);assert.equal(m.scrolls(),0);assert.match(m.errors.at(-1)!,/초과/);assert.equal(m.busy.at(-1),false);});
test('unmount suppresses success error and finally UI updates',async()=>{const m=mount();const p=m.start();await settle();m.cleanup();const before=[m.errors.length,m.busy.length];m.finish();await p;assert.equal(m.writes.length,0);assert.deepEqual([m.errors.length,m.busy.length],before);});
test('superseded response cannot overwrite a newer request',async()=>{const m=mount();const p=m.start();await settle();m.controller.current?.abort();m.controller.current=new AbortController();m.finish();await p;assert.equal(m.writes.length,0);});
