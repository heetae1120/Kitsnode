import {createD1IdentityAdapter} from './d1-identity.mjs';
const valid=s=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
const hash=async value=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));
async function equal(a,b){const [x,y]=await Promise.all([hash(a),hash(b)]);let diff=0;for(let i=0;i<x.length;i++)diff|=x[i]^y[i];return diff===0}
// Candidate server-to-server gateway. Its token must never be made public.
export async function handleD1Identity(request,{db,secret}) {
 const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
 const reply=(body,status)=>Response.json(body,{status,headers});
 if(request.method!=='POST')return reply({error:'not_found'},404);
 if(typeof secret!=='string'||secret.length<43||!db)return reply({error:'unavailable'},503);
 const auth=request.headers.get('authorization')||'';
 if(auth.length>256||!auth.startsWith('Bearer ')||!await equal(auth.slice(7),secret))return reply({error:'forbidden'},403);
 try {
  if((request.headers.get('content-type')||'').split(';')[0].trim().toLowerCase()!=='application/json')return reply({error:'invalid_request'},400);
  if(!request.body)return reply({error:'invalid_request'},400);
  const reader=request.body.getReader(),chunks=[];let size=0;try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>512){await reader.cancel();return reply({error:'invalid_request'},400)}chunks.push(value)}}finally{reader.releaseLock()}
  const raw=new Uint8Array(size);let offset=0;for(const part of chunks){raw.set(part,offset);offset+=part.length}
  let body;try{body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw))}catch{return reply({error:'invalid_request'},400)}
  if(!body||Array.isArray(body)||typeof body!=='object'||Object.keys(body).sort().join(',')!=='operation,requestId,subject'||!valid(body.subject)||!valid(body.requestId)||!['block','cleanup_identity','verify_identity'].includes(body.operation))return reply({error:'invalid_request'},400);
  const adapter=createD1IdentityAdapter(db);
  const ok=body.operation==='block'?await adapter.block(body):body.operation==='cleanup_identity'?await adapter.cleanupIdentity(body):await adapter.verifyIdentity(body);
  return ok?reply({ok:true},200):reply({error:'pending'},409);
 }catch{return reply({error:'unavailable'},503)}
}
