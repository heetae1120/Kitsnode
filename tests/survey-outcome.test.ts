import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source=readFileSync(new URL('../src/components/store-survey.tsx',import.meta.url),'utf8');
function form(request:()=>Promise<unknown>,endpoint=()=> 'https://fixture.example.test'){
 const block=source.slice(source.indexOf('  async function submit('),source.indexOf('\n  if (savedId)'));
 const compiled=ts.transpileModule(block,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 const errors:string[]=[],busy:boolean[]=[],ids:string[]=[];let calls=0;
 const submit=new Function('busy','setError','contact','consent','setBusy','fetch','consultationEndpoint','answers','OTHER','AbortSignal','setSavedId',compiled+';return submit;')(false,(s:string)=>errors.push(s),{company:'Fixture',nameRole:'Fixture',phone:'0000000000'},true,(s:boolean)=>busy.push(s),()=>{calls++;return request()},endpoint,{},'other',{timeout:()=>undefined},(id:string)=>ids.push(id));
 return{submit:()=>submit({preventDefault(){}}),errors,busy,ids,calls:()=>calls};
}
test('timeout explains uncertain server outcome without prompting immediate resend',async()=>{const e=new Error('timeout');e.name='TimeoutError';const f=form(async()=>{throw e});await f.submit();assert.match(f.errors.at(-1)!,/접수됐을 수/);assert.match(f.errors.at(-1)!,/다시 보내기 전에/);assert.equal(f.calls(),1);assert.deepEqual(f.busy,[true,false]);});
test('lost network response has the same uncertainty warning',async()=>{const f=form(async()=>{throw new TypeError('Failed to fetch')});await f.submit();assert.match(f.errors.at(-1)!,/접수됐을 수/);assert.equal(f.calls(),1)});
test('successful response preserves receipt',async()=>{const f=form(async()=>({ok:true,json:async()=>({id:'fixture-receipt'})}));await f.submit();assert.deepEqual(f.ids,['fixture-receipt'])});
test('preview endpoint rejection never sends and retains its specific reason',async()=>{const f=form(async()=>{throw Error('should not run')},()=>{throw Error('편집 미리보기에서는 상담을 접수하지 않습니다.')});await f.submit();assert.equal(f.calls(),0);assert.match(f.errors.at(-1)!,/미리보기/)});
test('explicit server rejection preserves response guidance',async()=>{const f=form(async()=>({ok:false,status:400,json:async()=>({error:'필수 입력값을 확인해 주세요.'})}));await f.submit();assert.match(f.errors.at(-1)!,/필수 입력값/)});

for(const status of [500,502,503,504]) test(`HTTP ${status} unreadable response remains uncertain`,async()=>{const f=form(async()=>({ok:false,status,json:async()=>{throw new SyntaxError('html gateway')}}));await f.submit();assert.match(f.errors.at(-1)!,/접수됐을 수/);assert.equal(f.calls(),1)});
test('HTTP 500 structured error does not falsely assert no receipt',async()=>{const f=form(async()=>({ok:false,status:500,json:async()=>({error:'저장하지 못했습니다. 다시 시도해 주세요.'})}));await f.submit();assert.match(f.errors.at(-1)!,/접수됐을 수/)});
test('HTTP 400 without a valid reason remains uncertain',async()=>{const f=form(async()=>({ok:false,status:400,json:async()=>null}));await f.submit();assert.match(f.errors.at(-1)!,/접수됐을 수/)});

for(const status of [408,409]) test(`HTTP ${status} is not treated as explicit field validation`,async()=>{const f=form(async()=>({ok:false,status,json:async()=>({error:'다시 시도해 주세요.'})}));await f.submit();assert.match(f.errors.at(-1)!,/접수됐을 수/)});
