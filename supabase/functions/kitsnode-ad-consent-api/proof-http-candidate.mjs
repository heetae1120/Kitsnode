// Isolated prototype: never mount without atomic persistent proof storage,
// explicit consent scope and provider policy binding. Viewer identity is not verified.
const fields=(o,ks)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).sort().join(',')===ks.slice().sort().join(',');
export function createProofHttp({server,siteOrigin,extensionOrigin,allowRequest}) {
 if(!server||!['approve','redeem','beginSend'].every(k=>typeof server[k]==='function')||typeof allowRequest!=='function'||siteOrigin!=='https://heetae1120.github.io'||!/^chrome-extension:\/\/[a-p]{32}$/.test(extensionOrigin||''))throw TypeError('invalid_configuration');
 return async req=>{
  const headers={'Cache-Control':'no-store','Content-Type':'application/json','Vary':'Origin','X-Content-Type-Options':'nosniff'};
  const reply=(status,data)=>new Response(JSON.stringify(data),{status,headers});
  let url;try{url=new URL(req.url)}catch{return reply(400,{error:'invalid_request'})}
  const route=url.pathname,approve=route==='/proof/approve',redeem=route==='/proof/redeem',begin=route==='/proof/begin';
  if(!approve&&!redeem&&!begin||url.search||url.hash)return reply(404,{error:'not_found'});
  const origin=req.headers.get('origin');if(origin!==(approve?siteOrigin:extensionOrigin))return reply(403,{error:'forbidden'});
  headers['Access-Control-Allow-Origin']=origin;
  if(req.method==='OPTIONS'){
   const requested=(req.headers.get('access-control-request-headers')||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
   if(req.headers.get('access-control-request-method')!=='POST'||requested.some(x=>!['authorization','content-type'].includes(x)))return reply(403,{error:'forbidden'});
   headers['Access-Control-Allow-Methods']='POST, OPTIONS';headers['Access-Control-Allow-Headers']='Authorization, Content-Type';return new Response(null,{status:204,headers});
  }
  if(req.method!=='POST')return reply(405,{error:'method_not_allowed'});
  if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(req.headers.get('content-type')||''))return reply(400,{error:'invalid_request'});
  const declared=req.headers.get('content-length');if(declared&&(!/^\d+$/.test(declared)||Number(declared)>4096))return reply(400,{error:'invalid_request'});
  let body;try{const reader=req.body?.getReader();if(!reader)return reply(400,{error:'invalid_request'});let size=0;const pieces=[];try{for(;;){const r=await reader.read();if(r.done)break;size+=r.value.byteLength;if(size>4096)return reply(400,{error:'invalid_request'});pieces.push(r.value)}}finally{try{await reader.cancel()}catch{}reader.releaseLock()};const b=new Uint8Array(size);let p=0;for(const part of pieces){b.set(part,p);p+=part.length}body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(b))}catch{return reply(400,{error:'invalid_request'})}
  let input;if(approve){const bearer=(req.headers.get('authorization')||'').match(/^Bearer ([A-Za-z0-9._-]{1,8192})$/)?.[1];if(!bearer)return reply(401,{error:'unauthenticated'});if(!fields(body,['consentId','request']))return reply(400,{error:'invalid_request'});input={bearer,consentId:body.consentId,request:body.request};}
  else {if(req.headers.has('authorization')||!fields(body,['requestId','signature']))return reply(400,{error:'invalid_request'});input=body;}
  try{if(await allowRequest({operation:approve?'approve':redeem?'redeem':'begin',origin,requestId:approve?body.request?.requestId:body.requestId,bearer:approve?input.bearer:undefined})!==true)return reply(429,{error:'rate_limited'});const result=await server[approve?'approve':redeem?'redeem':'beginSend'](input);if(!result||result.status!==(approve?'approved':redeem?'reserved':'begun'))return reply(403,{error:'forbidden'});return reply(200,result);}catch{return reply(503,{error:'unavailable'})}
 };
}
