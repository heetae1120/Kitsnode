import {test} from 'node:test';import assert from 'node:assert/strict';import {createSurveyFunnel,clearSurveyAttempt,SURVEY_ATTEMPT_KEY} from '../src/lib/analytics-survey-funnel';
const id='11111111-1111-4111-8111-111111111111', second='22222222-2222-4222-8222-222222222222';
function storage(){const values=new Map<string,string>();return {getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value)},removeItem:(key:string)=>{values.delete(key)}} as Storage;}
test('unique reached stages survive departure, resume and completion without duplicate attempt',()=>{
 const store=storage(),events:any[]=[];let allowed=true;const create=()=>createSurveyFunnel({storage:store,createId:()=>id,allowed:()=>allowed,send:e=>events.push(e)});
 const one=create();one.step('brandVision',false);one.activity();one.flush();one.step('audience',false);one.step('brandVision',false);one.leave();
 assert.deepEqual(events.at(-1).reached,['brandVision','audience']);assert.equal(events.at(-1).status,'left');
 const two=create();two.step('brandVision',false);assert.equal(events.at(-1).status,'active');assert.equal(events.at(-1).attemptId,id);
 two.step('contact',false);two.step('contact',true);assert.equal(events.at(-1).status,'completed');const n=events.length;two.leave();assert.equal(events.length,n);
 assert.deepEqual(events.map(e=>e.sequence),[1,2,3,4,5,6,7,8]);assert.ok(events.every(e=>!JSON.stringify(e).includes('answer')));
 allowed=false;two.activity();two.flush();assert.equal(events.length,n);clearSurveyAttempt(store);assert.equal(store.getItem(SURVEY_ATTEMPT_KEY),null);
});
test('completed form starts a new attempt, idle flushes do not send, malformed storage is ignored',()=>{
 const store=storage(),events:any[]=[];let current=id;const mk=()=>createSurveyFunnel({storage:store,createId:()=>current,allowed:()=>true,send:e=>events.push(e)});
 store.setItem(SURVEY_ATTEMPT_KEY,'{"attemptId":"private"}');const first=mk();first.step('brandVision',false);first.flush();assert.equal(events.length,1);first.step('contact',false);first.step('contact',true);current=second;const next=mk();next.step('brandVision',false);assert.equal(events.at(-1).attemptId,second);assert.equal(events.at(-1).sequence,1);
});

test('browser lifecycle distinguishes tab background, close, return and consent withdrawal',async()=>{
 const {startVisitorAnalytics}=await import('../src/lib/analytics');const old=globalThis.MutationObserver;let changed=()=>{};class Observer {constructor(fn:()=>void){changed=fn} observe(){} disconnect(){}}
 globalThis.MutationObserver=Observer as unknown as typeof MutationObserver;
 try {let time=0,allowed=true,tick=()=>{};let step='brandVision',done=false;const events:any[]=[];const store=storage();
  const card={getAttribute:(key:string)=>key==='data-analytics-step'?step:key==='data-analytics-completed'?String(done):null};
  const doc=Object.assign(new EventTarget(),{body:{},visibilityState:'visible',querySelector:()=>card});
  const win=Object.assign(new EventTarget(),{sessionStorage:store,crypto:{randomUUID:()=>id},performance:{now:()=>time},fetch:async(url:string,init:RequestInit)=>{if(String(url).includes('resource=survey-funnel'))events.push(JSON.parse(String(init.body)));return new Response('',{status:202})},setInterval:(fn:()=>void)=>{tick=fn;return 1},clearInterval:()=>{}});
  const stop=startVisitorAnalytics('/tools/survey/','https://metrics.example/collect',win as unknown as Window,doc as unknown as Document,()=>allowed);
  assert.equal(events.at(-1).status,'active');doc.visibilityState='hidden';doc.dispatchEvent(new Event('visibilitychange'));assert.equal(events.at(-1).status,'active');
  win.dispatchEvent(new Event('pagehide'));assert.equal(events.at(-1).status,'left');doc.visibilityState='visible';win.dispatchEvent(new Event('pageshow'));assert.equal(events.at(-1).status,'active');
  step='audience';changed();assert.deepEqual(events.at(-1).reached,['brandVision','audience']);time=15000;doc.dispatchEvent(new Event('keydown'));tick();assert.equal(events.at(-1).status,'active');
  allowed=false;const count=events.length;win.dispatchEvent(new Event('pagehide'));tick();stop(true);assert.equal(events.length,count);
 }finally{globalThis.MutationObserver=old;}
});
