// Optional isolated SQL verification. Install @electric-sql/pglite@0.5.15 into a
// temporary directory, then pass its dist/index.js path as the first argument.
// This script never connects to Supabase or any external database.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const modulePath = process.argv[2];
if (!modulePath) throw new Error('Pass the local PGlite dist/index.js path. No hosted database is supported.');
const { PGlite } = await import(pathToFileURL(modulePath).href);
const db = new PGlite();
let assertions = 0;
const check = (value, expected) => {assert.deepEqual(value,expected);assertions++;};
try {
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  await db.exec(await readFile(new URL('../supabase/migrations/20261107145249_kitsnode_private_analytics.sql',import.meta.url),'utf8'));
  const event = {version:1,viewId:'491b857a-7641-4cef-8a22-28d383a498c2',sequence:1,page:'/tools/survey/',visibleMs:15000,engagedMs:10000,reason:'heartbeat',survey:{step:'brandVision',lastField:'brandVision',lastInputAgoMs:1000,completed:false}};
  const record = async (patch={}) => (await db.query('select public.kitsnode_record_analytics($1,$2::jsonb) as result',['https://visitor.example',JSON.stringify({...event,...patch})])).rows[0].result;
  const report = async () => (await db.query('select public.kitsnode_analytics_report(7) as result')).rows[0].result;
  await db.exec('set role service_role');
  check((await record()).status,'ok');
  check((await record()).status,'duplicate');
  check((await report()).survey,{started:1,completed:0,incomplete:0,pending:1,dropoffs:[]});
  check((await record({sequence:2,visibleMs:25000,engagedMs:15000})).status,'ok');
  check((await record({sequence:1,visibleMs:50000,engagedMs:30000})).status,'duplicate');
  check((await report()).pages,[{page:'/tools/survey/',views:1,avgVisibleMs:25000,avgEngagedMs:15000}]);
  check((await record({sequence:3,visibleMs:20000,engagedMs:15000})).status,'invalid_event');
  check((await record({sequence:3,page:'/tools/',survey:null,visibleMs:30000,engagedMs:15000})).status,'invalid_event');
  await db.exec("update public.kitsnode_analytics_views set last_seen = now() - interval '31 minutes'");
  check((await report()).survey,{started:1,completed:0,incomplete:1,pending:0,dropoffs:[{step:'brandVision',lastField:'brandVision',count:1}]});
  check((await record({sequence:3,visibleMs:30000,engagedMs:16000,reason:'complete',survey:{step:'contact',lastField:'phone',lastInputAgoMs:1000,completed:true}})).status,'ok');
  check((await report()).survey,{started:1,completed:1,incomplete:0,pending:0,dropoffs:[]});
  // A stale or incomplete later signal cannot undo a confirmed completion.
  check((await record({sequence:4,visibleMs:30000,engagedMs:16000})).status,'ok');
  check((await report()).survey.completed,1);
  await db.exec('update public.kitsnode_analytics_views set rate_count=120');
  check((await record({sequence:5,visibleMs:31000,engagedMs:16000})).status,'rate_limited');
  await db.exec('update public.kitsnode_analytics_rate set requests=6000');
  check((await record({viewId:'f4c9c095-dc97-42aa-9155-bf33b608c1d7'})).status,'rate_limited');
  await db.exec("update public.kitsnode_analytics_views set first_seen=now()-interval '91 days'; select public.kitsnode_purge_analytics()");
  check((await report()).pages,[]);
  await db.exec('reset role; set role anon');
  for (const sql of ['select * from public.kitsnode_analytics_views','select public.kitsnode_analytics_report(7)','select public.kitsnode_purge_analytics()']) {
    await assert.rejects(db.query(sql),/permission denied/);assertions++;
  }
  await db.exec('reset role; set role authenticated');
  await assert.rejects(db.query('select public.kitsnode_analytics_report(7)'),/permission denied/);assertions++;
  console.log(`Isolated PostgreSQL migration/RPC verification: ${assertions} assertions passed. No hosted database accessed.`);
} finally {await db.close();}
