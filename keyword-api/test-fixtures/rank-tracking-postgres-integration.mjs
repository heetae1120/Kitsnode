// Local ephemeral PostgreSQL integration only. The psql adapter is deliberately
// test-only and cannot be imported into an application route.
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import assert from 'node:assert/strict';
import {createRankTrackingTestService} from '../src/rank-tracking-test-service.mjs';
const execute=promisify(execFile),u='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',connectionId='33333333-3333-4333-8333-333333333333',trackingId='44444444-4444-4444-8444-444444444444',targetId='nad-demo',start=1800000000000;
const sql=async text=>(await execute('psql',['-X','-v','ON_ERROR_STOP=1','-q','-At','-d','postgres','-c',text],{env:process.env})).stdout.trim();
const safeUuid=x=>{if(!/^[0-9a-f-]{36}$/.test(x))throw Error('invalid');return `'${x}'`};
const safeTarget=x=>{if(!/^(?:nad|nkw)-[A-Za-z0-9-]+$/.test(x))throw Error('invalid');return `'${x}'`};
const json=x=>`convert_from(decode('${Buffer.from(JSON.stringify(x)).toString('base64')}','base64'),'UTF8')::jsonb`;
function store(){return {
 async create(x){return (await sql(`insert into rank_tracking_test.trackings(tracking_id,user_id,connection_id,target_id,tracking) values(${safeUuid(x.tracking.id)},${safeUuid(x.userId)},${safeUuid(x.connectionId)},${safeTarget(x.targetId)},${json(x.tracking)}) on conflict do nothing returning 'created'`))==='created'},
 async get(x){const text=await sql(`select json_build_object('version',version,'tracking',tracking)::text from rank_tracking_test.trackings where user_id=${safeUuid(x.userId)} and connection_id=${safeUuid(x.connectionId)} and target_id=${safeTarget(x.targetId)} and tracking_id=${safeUuid(x.trackingId)}`);return text?JSON.parse(text):null},
 async commit(x){if(!Number.isSafeInteger(x.expectedVersion)||x.expectedVersion<0)throw Error('invalid');return sql(`select rank_tracking_test.commit_observation(${safeUuid(x.userId)},${safeUuid(x.connectionId)},${safeTarget(x.targetId)},${safeUuid(x.trackingId)},${safeUuid(x.requestId)},${x.expectedVersion},${json(x.tracking)})`)}
}}
let current=start;let allow=true;
function service(){return createRankTrackingTestService({verifyUser:async t=>({id:t==='owner'?u:other}),authorizeTarget:async (id,c,target)=>allow&&id===u&&c===connectionId&&target===targetId,store:store(),now:()=>current});}
const input={token:'owner',connectionId,targetId,trackingId,changeAt:start,bid:100,targets:{pc:2,mobile:3}};
let s=service();assert.equal((await s.start(input)).status,'created');
let next=0;
for(const minutes of [10,20,30]){current=start+minutes*60000;for(const device of ['pc','mobile']){
 const requestId=`55555555-5555-4555-8555-${String(++next).padStart(12,'0')}`;
 const result=device==='mobile'&&minutes===20?{status:'unavailable'}:{status:'available',kind:'instant',rank:minutes===10?4:2,observedAt:current,source:'synthetic'};
 const body={token:'owner',connectionId,targetId,trackingId,requestId,minutes,device,result};
 if(minutes===10&&device==='pc'){const [a,b]=await Promise.all([s.observe(body),s.observe(body)]);assert.equal([a,b].filter(x=>x.status==='recorded').length,1)}else assert.equal((await s.observe(body)).status,'recorded');
}}
// New store/service instance reads the same database, simulating app restart.
s=service();const result=await s.history(input);assert.equal(result.status,'ok');assert.equal(result.summary.pc.checkpoints.length,3);assert.equal(result.summary.mobile.checkpoints[1].status,'unavailable');assert.equal(result.summary.pc.firstObservedTarget.upperBoundMs,1200000);assert.equal((await s.history({...input,token:'other'})).reason,'not_authorized');allow=false;assert.equal((await s.history(input)).reason,'not_authorized');
assert.equal(await sql(`select count(*) from rank_tracking_test.requests where tracking_id=${safeUuid(trackingId)}`),'6');
console.log('simulation service → isolated PostgreSQL: 10/20/30, no data, duplicate, restart durability, ownership passed');
