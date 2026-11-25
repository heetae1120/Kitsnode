import {createHmac} from 'node:crypto';
import {readLimitedJson} from './limited-json.mjs';

const origin='https://api.searchad.naver.com';
const jobId=v=>typeof v==='string'&&/^[a-zA-Z0-9-]{1,100}$/.test(v);
const customer=v=>/^[1-9][0-9]{0,15}$/.test(String(v));
const group=v=>typeof v==='string'&&/^grp-[A-Za-z0-9-]{1,100}$/.test(v);
const ad=v=>typeof v==='string'&&/^nad-[A-Za-z0-9-]{1,100}$/.test(v);

async function boundedText(response,limit){
 const reader=response.body?.getReader();if(!reader)throw Error('missing_body');let bytes=0;const decoder=new TextDecoder('utf-8',{fatal:true});let output='';
 try{for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>limit)throw Error('body_too_large');output+=decoder.decode(value,{stream:true});}return output+decoder.decode();}finally{try{await reader.cancel()}catch{}reader.releaseLock()}
}

// Fixed provider destination and operations. This client can create a report
// job but has no advertisement mutation method. Download URLs are never used
// as destinations and neither credentials nor download tokens are returned.
export function createShoppingMasterClient({apiKey,secretKey,customerId,fetcher=fetch,now=Date.now}){
 if(![apiKey,secretKey].every(x=>typeof x==='string'&&/^[\x21-\x7e]+$/.test(x))||!customer(customerId)||typeof fetcher!=='function')throw Error('invalid_configuration');
 async function request(method,path,{query,body,text=false}={}){
  const timestamp=String(now()),signature=createHmac('sha256',secretKey).update(`${timestamp}.${method}.${path}`).digest('base64');
  const url=new URL(path,origin);if(query)for(const [k,v] of Object.entries(query))url.searchParams.set(k,v);
  const headers={'X-Timestamp':timestamp,'X-API-KEY':apiKey,'X-Customer':String(customerId),'X-Signature':signature};if(body)headers['Content-Type']='application/json';
  let r;try{r=await fetcher(url,{method,headers,...(body?{body:JSON.stringify(body)}:{}),redirect:'error',signal:AbortSignal.timeout(12000)})}catch{return {ok:false,reason:'network_error'}}
  if(!r.ok)return {ok:false,reason:r.status===401||r.status===403?'access_denied':r.status===429?'rate_limited':'provider_error',httpStatus:r.status};
  try{return {ok:true,data:text?await boundedText(r,20_000_000):await readLimitedJson(r,100_000)}}catch{return {ok:false,reason:'invalid_response'}}
 }
 return Object.freeze({
  async create(){const r=await request('POST','/master-reports',{body:{item:'ShoppingProduct'}});if(!r.ok)return r;if(!jobId(r.data?.id)||r.data.item!=='ShoppingProduct')return {ok:false,reason:'invalid_job'};return {ok:true,id:r.data.id}},
  async get(id){if(!jobId(id))return {ok:false,reason:'invalid_job'};const r=await request('GET',`/master-reports/${id}`);if(!r.ok)return r;const j=r.data;if(j?.id!==id||j.item!=='ShoppingProduct'||!['REGIST','RUNNING','BUILT','NONE','ERROR'].includes(j.status))return {ok:false,reason:'invalid_job'};return {ok:true,job:j}},
  async download(job){if(job?.status!=='BUILT'||job.item!=='ShoppingProduct'||typeof job.downloadUrl!=='string')return {ok:false,reason:'invalid_job'};let u;try{u=new URL(job.downloadUrl,origin)}catch{return {ok:false,reason:'invalid_download'}};if(u.origin!==origin||u.pathname!=='/report-download'||u.username||u.password||u.hash||[...u.searchParams.keys()].some(k=>!['authtoken','fileVersion'].includes(k))||u.searchParams.getAll('authtoken').length!==1||u.searchParams.getAll('fileVersion').length>1)return {ok:false,reason:'invalid_download'};const token=u.searchParams.get('authtoken'),version=u.searchParams.get('fileVersion');if(!token||token.length>4096||version&&!/^v[0-9]+$/.test(version))return {ok:false,reason:'invalid_download'};return request('GET','/report-download',{query:{authtoken:token,...(version?{fileVersion:version}:{})},text:true})}
 });
}

// Full reports are headerless TSV according to the ShoppingProduct column
// order; reject unknown representations rather than interpreting them as 0.
export function parseShoppingMaster(tsv,{customerId,adgroupId}={}){
 if(typeof tsv!=='string'||!customer(customerId)||!group(adgroupId))return {ok:false,reason:'invalid_input'};
 const rows=[],seen=new Set();let deleted=0;const lines=tsv.split(/\r?\n/);if(lines.at(-1)==='')lines.pop();
 for(const line of lines){const f=line.split('\t');if(f.length<15||!customer(f[0])||!group(f[1])||!ad(f[2]))return {ok:false,reason:'invalid_report'};if(f[0]!==String(customerId))return {ok:false,reason:'customer_mismatch'};if(f[1]!==adgroupId)continue;if(seen.has(f[2]))return {ok:false,reason:'duplicate_ad'};seen.add(f[2]);if(f[11]!==''&&f[11]!=='-'){if(!Number.isFinite(Date.parse(f[11])))return {ok:false,reason:'invalid_deletion'};deleted++;continue;}let uses;if(f[8]==='true')uses=true;else if(f[8]==='false')uses=false;else return {ok:false,reason:'invalid_bid_mode'};rows.push({id:f[2],adgroupId:f[1],customerId:f[0],useGroupBid:uses});if(rows.length>1000)return {ok:false,reason:'too_many_products'};}
 return {ok:true,rows,deleted};
}
