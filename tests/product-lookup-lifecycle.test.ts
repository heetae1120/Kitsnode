import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const source=readFileSync(new URL('../src/components/keyword-research.tsx',import.meta.url),'utf8');
function mount(){
 const body=source.slice(source.indexOf('  async function fetchProduct()'),source.indexOf('  function download('));
 const cleanupSource=source.match(/useEffect\(\(\) => (\(\) =>[\s\S]*?), \[\]\);\n  useEffect\(\(\) => \{\n    setProductDraft/)?.[1];assert.ok(cleanupSource);
 let resolveBody:(value:unknown)=>void=()=>{};let timeout:()=>void=()=>{};
 const products:unknown[]=[],errors:string[]=[],notices:string[]=[];const controller={current:null as AbortController|null};
 const code=ts.transpileModule(body,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 const lookup=new Function('endpoint','keyword','shoppingController','m','fetch','setTimeout','clearTimeout','setProductError','setShoppingNotice','setProductLoading',code+';return fetchProduct;')('https://fixture.example.test','fixture',controller,{setProduct:(p:unknown)=>products.push(p)},async()=>({ok:true,json:()=>new Promise(r=>resolveBody=r)}),(fn:()=>void)=>{timeout=fn;return 1},()=>{},(e:string)=>errors.push(e),(n:string)=>notices.push(n),()=>{});
 const cleanup=new Function('shoppingController','return '+cleanupSource)(controller);
 return {lookup,cleanup,products,errors,notices,controller,timeout:()=>timeout(),finish:()=>resolveBody({source:'naver-shopping',products:[{keyword:'fixture',count:321}],fetchedAt:'2026-11-13T00:00:00Z'})};
}
test('current product response remains usable',async()=>{const m=mount();const run=m.lookup();await Promise.resolve();m.finish();await run;assert.equal(m.products.length,1)});
test('response completing after detail unmount cannot update parent product records',async()=>{const m=mount();const run=m.lookup();await Promise.resolve();m.cleanup();m.finish();await run;assert.equal(m.products.length,0);assert.ok(!m.notices.some(n=>n.includes('가져왔습니다')))});
test('body resolving after timeout cannot be saved as a fresh successful response',async()=>{const m=mount();const run=m.lookup();await Promise.resolve();m.timeout();m.finish();await run;assert.equal(m.products.length,0);assert.ok(m.errors.some(e=>e.includes('초과')))});
test('manual save invalidates a pending automatic result',async()=>{const m=mount();const run=m.lookup();await Promise.resolve();m.controller.current?.abort();m.controller.current=null;m.finish();await run;assert.equal(m.products.length,0)});
