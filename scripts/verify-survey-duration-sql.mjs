// Isolated synthetic PostgreSQL only. Never connects to a hosted database.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const modulePath=process.argv[2];
if(!modulePath)throw new Error('Pass local PGlite dist/index.js. Hosted databases are unsupported.');
const {PGlite}=await import(pathToFileURL(modulePath).href);
const db=new PGlite(); let assertions=0;
const check=(value,expected)=>{assert.deepEqual(value,expected);assertions++;};
const uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const event=(n,timing,completed=false)=>({version:2,viewId:uuid(n),sequence:1,page:'/tools/survey/',visibleMs:timing?.visibleMs??15000,engagedMs:timing?.engagedMs??5000,reason:completed?'complete':'heartbeat',survey:{step:completed?'contact':'brandVision',lastField:null,lastInputAgoMs:null,completed,timing}});
const record=async e=>(await db.query('select public.kitsnode_record_analytics($1,$2::jsonb) as result',['https://visitor.example',JSON.stringify(e)])).rows[0].result.status;
const report=async days=>(await db.query('select public.kitsnode_analytics_report($1) as result',[days??7])).rows[0].result;
const group=(samples,avgElapsedMs,avgVisibleMs,avgEngagedMs,medianVisibleMs)=>({samples,avgElapsedMs,avgVisibleMs,avgEngagedMs,medianVisibleMs});
const timing=(elapsedMs,visibleMs=elapsedMs,engagedMs=0)=>({elapsedMs,visibleMs,engagedMs});
try {
 await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
 await db.exec(await readFile(new URL('../supabase/migrations/20261107145249_kitsnode_private_analytics.sql',import.meta.url),'utf8'));
 const legacy=event(1,null,true);legacy.version=1;delete legacy.survey.timing;
 check(await record(legacy),'ok');
 await db.exec(await readFile(new URL('../supabase/migrations/20261107153632_kitsnode_survey_duration.sql',import.meta.url),'utf8'));
 await db.exec('set role service_role');
 check((await report()).survey.timing.completed,group(0,null,null,null,null));
 check((await report()).survey.completed,1);
 check(await record({...legacy,sequence:2,visibleMs:50000}),'ok');
 check((await report()).survey.timing.completed.samples,0);
 const first=event(2,timing(60000,40000,10000));
 check(await record(first),'ok');
 check((await report()).survey.timing.pending,group(1,60000,40000,10000,40000));
 check(await record(first),'duplicate');
 check(await record({...first,sequence:2,survey:{...first.survey,timing:timing(60000,30000,10000)}}),'invalid_event');
 check(await record({...first,sequence:2,survey:{...first.survey,timing:null}}),'invalid_event');
 await db.query("update public.kitsnode_analytics_views set last_seen=now()-interval '31 minutes' where view_id=$1",[uuid(2)]);
 check((await report()).survey.timing.incomplete,group(1,60000,40000,10000,40000));
 const complete={...first,sequence:2,visibleMs:50000,engagedMs:12000,reason:'complete',survey:{...first.survey,completed:true,step:'contact',timing:timing(80000,50000,12000)}};
 check(await record(complete),'ok');
 check((await report()).survey.timing.completed,group(1,80000,50000,12000,50000));
 check((await report()).survey.timing.incomplete,group(0,null,null,null,null));
 check(await record({...complete,sequence:3,visibleMs:150000,engagedMs:20000,survey:{...complete.survey,timing:timing(200000,100000,20000)}}),'ok');
 check((await report()).survey.timing.completed,group(1,80000,50000,12000,50000));
 const postLegacy={...legacy,viewId:uuid(2),sequence:4,visibleMs:160000,engagedMs:20000,survey:{...legacy.survey,completed:false,step:'brandVision'},reason:'heartbeat'};
 check(await record(postLegacy),'ok');
 check((await report()).survey.timing.completed,group(1,80000,50000,12000,50000));
 check(await record({...complete,sequence:2}),'duplicate');
 check(await record(event(3,timing(10000,10000,2000),true)),'ok');
 check((await report()).survey.timing.completed,group(2,45000,30000,7000,30000));
 check(await record(event(4,timing(0),true)),'ok');
 check((await report()).survey.timing.completed,group(3,30000,20000,4667,10000));
 check((await report()).survey.completed,4); // one legacy unknown, three measured
 check(await record(event(5,null,true)),'ok');
 check((await report()).survey.timing.completed.samples,3);
 // Invalid timing cannot create a row, including partial nulls and page bound violations.
 for(const t of [timing(1,2),timing(-1),{elapsedMs:10,visibleMs:null,engagedMs:0},timing(86400001)])check(await record({...event(6,t),visibleMs:100,engagedMs:0}),'invalid_event');
 const pending=event(7,timing(20000,10000));check(await record(pending),'ok');
 check((await report()).survey.timing.pending,group(1,20000,10000,0,10000));
 await db.query("update public.kitsnode_analytics_views set first_seen=now()-interval '8 days' where view_id=$1",[uuid(3)]);
 check((await report(7)).survey.timing.completed.samples,2);check((await report(30)).survey.timing.completed.samples,3);
 await db.query("update public.kitsnode_analytics_views set first_seen=now()-interval '2 days' where view_id=$1",[uuid(4)]);
 check((await report(1)).survey.timing.completed.samples,1);
 await db.exec('reset role; set role anon');
 for(const sql of ['select survey_visible_ms from public.kitsnode_analytics_views','select public.kitsnode_analytics_report(7)',"select public.kitsnode_record_analytics('https://visitor.example','{}')"]){await assert.rejects(db.query(sql),/permission denied/);assertions++;}
 await db.exec('reset role; set role authenticated');
 await assert.rejects(db.query('select public.kitsnode_analytics_report(7)'),/permission denied/);assertions++;
 console.log(`Survey duration migration/aggregate verification: ${assertions} assertions passed. No hosted database accessed.`);
}finally{await db.close();}
