import {strict as a} from 'node:assert';
import {validateAnalyticsEvent as valid,createAnalyticsHandler,ATTRIBUTION_VALUES} from '../supabase/functions/kitsnode-analytics/handler.mjs';
const event={version:3,viewId:'00000000-0000-4000-8000-000000000001',sequence:1,page:'/tools/',visibleMs:1000,engagedMs:500,reason:'heartbeat',survey:null,attribution:{source:'google',medium:'organic',campaign:'none',basis:'referrer'}};
a(valid(event));
for(const [key,values] of Object.entries(ATTRIBUTION_VALUES)) for(const value of values) a(valid({...event,attribution:{...event.attribution,[key]:value}}));
for(const key of Object.keys(event.attribution)) {const attr={...event.attribution};delete attr[key];a(!valid({...event,attribution:attr}));for(const v of [null,{},1,'https://example.test/private','name@example.test'])a(!valid({...event,attribution:{...event.attribution,[key]:v}}));}
a(!valid({...event,attribution:{...event.attribution,raw:'anything'}}));
a(!valid({...event,version:2}));
const {attribution,...old}=event;a(valid({...old,version:1}));a(valid({...old,version:2}));
const survey={step:'contact',lastField:null,lastInputAgoMs:null,completed:true,timing:{elapsedMs:1000,visibleMs:900,engagedMs:400}};
a(valid({...event,page:'/tools/survey/',reason:'complete',survey}));
a(!valid({...event,page:'/tools/survey/',reason:'complete',survey:{...survey,timing:{elapsedMs:1000,visibleMs:2000,engagedMs:400}}}));
let calls=0;const handler=createAnalyticsHandler({projectUrl:'https://example.test',serviceKey:'test',ingestEnabled:true,frontendOrigins:['https://heetae1120.github.io'],fetchImpl:async(url,opts)=>{calls++;a.equal(JSON.parse(opts.body).p_event.attribution.source,'google');return Response.json({status:'ok'});}});
const req=e=>new Request('https://example.test/collect',{method:'POST',headers:{origin:'https://heetae1120.github.io','content-type':'application/json'},body:JSON.stringify(e)});
a.equal((await handler(req(event))).status,202);a.equal(calls,1);
a.equal((await handler(req({...event,attribution:{...event.attribution,campaign:'private-email'}}))).status,400);a.equal(calls,1);
console.log('PASS: v1/v2 compatibility, all v3 enums, strict shape/PII rejection, survey timing and ingestion.');
