// Cloud Insight SendData transport, deliberately opt-in and server-only.
// The caller must publish regularly and use an independent missing-data alarm;
// successful HTTP delivery alone does not prove metric ingestion or email delivery.
import {createHmac} from 'node:crypto';
const path='/cw_collector/real/data';
const url='https://cw.apigw.ntruss.com'+path;
const validSecret=x=>typeof x==='string'&&x.length>0&&x.length<=512&&/^[\x21-\x7e]+$/.test(x);
export function createCloudInsightAdapter({env=process.env,fetchImpl=globalThis.fetch,now=Date.now,timeoutMs=5000}={}){
 if(env.KITS_CLOUD_INSIGHT_ENABLED!=='true')return Object.freeze({status:'disabled',publish:async()=>({status:'disabled'})});
 const access=env.NCP_CLOUD_INSIGHT_ACCESS_KEY,secret=env.NCP_CLOUD_INSIGHT_SECRET_KEY,key=env.NCP_CLOUD_INSIGHT_CW_KEY;
 if(![access,secret,key].every(validSecret)||typeof fetchImpl!=='function'||typeof now!=='function'||!Number.isInteger(timeoutMs)||timeoutMs<100||timeoutMs>30000)return Object.freeze({status:'configuration_error',publish:async()=>({status:'configuration_error'})});
 let busy=false;
 return Object.freeze({status:'ready',async publish({healthy}={}){
  if(typeof healthy!=='boolean')return {status:'invalid'};
  if(busy)return {status:'busy'};
  const ms=now();if(!Number.isSafeInteger(ms)||ms<0)return {status:'invalid_clock'};
  busy=true;const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
   const ts=String(ms),signature=createHmac('sha256',secret).update(`POST ${path}\n${ts}\n${access}`).digest('base64');
   const response=await fetchImpl(url,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json','x-ncp-apigw-timestamp':ts,'x-ncp-iam-access-key':access,'x-ncp-apigw-signature-v2':signature},body:JSON.stringify({cw_key:key,data:{worker:'shadow',heartbeat:1,healthy:healthy?1:0}}),signal:controller.signal});
   if(!response.ok)return {status:'unavailable'};
   const data=await response.json();return data?.result==='success'?{status:'sent'}:{status:'unavailable'};
  }catch{return {status:'unavailable'}}finally{clearTimeout(timer);busy=false}
 }});
}
