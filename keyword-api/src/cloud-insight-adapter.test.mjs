import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {createCloudInsightAdapter} from './cloud-insight-adapter.mjs';
const env={KITS_CLOUD_INSIGHT_ENABLED:'true',NCP_CLOUD_INSIGHT_ACCESS_KEY:'test-access',NCP_CLOUD_INSIGHT_SECRET_KEY:'test-secret',NCP_CLOUD_INSIGHT_CW_KEY:'test-product'};
test('disabled and malformed configuration never call network',async()=>{
 let calls=0;const fetchImpl=async()=>{calls++;throw Error()};
 assert.equal((await createCloudInsightAdapter({env:{},fetchImpl}).publish({healthy:true})).status,'disabled');
 assert.equal(createCloudInsightAdapter({env:{...env,NCP_CLOUD_INSIGHT_SECRET_KEY:''},fetchImpl}).status,'configuration_error');assert.equal(calls,0);
});
test('signs fixed endpoint and emits only permitted aggregate values',async()=>{
 let request;const a=createCloudInsightAdapter({env,now:()=>1700000000000,fetchImpl:async(url,options)=>{request={url,options};return {ok:true,json:async()=>({result:'success'})}}});
 assert.equal((await a.publish({healthy:false,secret:'ignored'})).status,'sent');
 assert.equal(request.url,'https://cw.apigw.ntruss.com/cw_collector/real/data');
 assert.deepEqual(JSON.parse(request.options.body),{cw_key:'test-product',data:{worker:'shadow',heartbeat:1,healthy:0}});
 const expected=createHmac('sha256','test-secret').update('POST /cw_collector/real/data\n1700000000000\ntest-access').digest('base64');
 assert.equal(request.options.headers['x-ncp-apigw-signature-v2'],expected);
});
test('never exposes network exceptions or response bodies',async()=>{
 for(const fetchImpl of [async()=>{throw Error('sensitive')},async()=>({ok:true,json:async()=>({result:'error',message:'sensitive'})}),async()=>({ok:false})]){
  const a=createCloudInsightAdapter({env,fetchImpl});assert.deepEqual(await a.publish({healthy:true}),{status:'unavailable'});
 }
});
test('rejects overlapping sends and invalid inputs',async()=>{
 let release;const a=createCloudInsightAdapter({env,fetchImpl:()=>new Promise(r=>{release=r})});
 assert.equal((await a.publish({healthy:'yes'})).status,'invalid');const first=a.publish({healthy:true});assert.equal((await a.publish({healthy:true})).status,'busy');release({ok:true,json:async()=>({result:'success'})});assert.equal((await first).status,'sent');
});
