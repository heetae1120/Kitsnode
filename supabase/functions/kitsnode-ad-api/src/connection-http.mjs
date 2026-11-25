// HTTP boundary for server-side account-connection operations.
// This factory is not deployed or attached to a public route by itself.
// Authentication must call Supabase Auth and authorization must consult trusted
// server-owned state. Neither request JSON nor user_metadata is an authority.
const uuid = v => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const account = v => typeof v === 'string' && /^[1-9]\d{0,15}$/.test(v);
const validStates = new Set(['pending_review','read_connected','disconnected']);
const statusCode = {unauthenticated:401,invalid_input:400,forbidden:403,not_found:404,conflict:409,unavailable:503};

/** Uses the server's Supabase SDK getUser(token), which revalidates via Auth.
 * Supabase response metadata must never be used to decide operator privileges. */
export function createSupabaseSessionVerifier(client) {
  if (typeof client?.auth?.getUser !== 'function') throw new TypeError('invalid_auth_client');
  return async token => {
    if (typeof token !== 'string' || token.length < 1 || token.length > 8192 || !/^[A-Za-z0-9._-]+$/.test(token)) return null;
    try {
      const {data,error}=await client.auth.getUser(token);
      const user=data?.user;
      if (error || !uuid(user?.id) || user.is_anonymous === true || user.aud !== 'authenticated') return null;
      if (user.banned_until && (!Number.isFinite(Date.parse(user.banned_until)) || Date.parse(user.banned_until)>Date.now())) return null;
      return {id:user.id};
    } catch {return null;}
  };
}

/** `service` must be createConnectionService configured with the same verifier.
 * listOwned must enforce user_id server-side; returned rows are rechecked here.
 * memberAllowed must verify current member eligibility and current consent.
 * allowRequest must use a shared, atomic rate limit when exposed publicly.
 * No approval endpoint is exposed; no ownership is inferred from API access.
 */
export function createConnectionHttp({allowedOrigins,verifySession,memberAllowed,allowRequest,service,listOwned}) {
  if (!Array.isArray(allowedOrigins) || allowedOrigins.length===0 || !allowedOrigins.every(o=>{
    try {const u=new URL(o);return u.protocol==='https:' && u.origin===o && !u.username && !u.password;} catch {return false;}
  }) || ![verifySession,memberAllowed,allowRequest,listOwned].every(v=>typeof v==='function') || !service || !['request','disconnect'].every(k=>typeof service[k]==='function')) throw new TypeError('invalid_dependencies');
  return async function handler(req) {
    const origin=req.headers.get('origin');
    const headers={'Cache-Control':'no-store','Content-Type':'application/json','Vary':'Origin','X-Content-Type-Options':'nosniff'};
    const out=(body,status)=>new Response(JSON.stringify(body),{status,headers});
    if (!origin || !allowedOrigins.includes(origin)) return out({error:'origin_not_allowed'},403);
    headers['Access-Control-Allow-Origin']=origin;
    if (req.method==='OPTIONS') {
      const method=req.headers.get('access-control-request-method');
      const requested=(req.headers.get('access-control-request-headers')||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
      if (!['GET','POST','DELETE'].includes(method) || requested.some(h=>!['authorization','content-type'].includes(h))) return out({error:'preflight_denied'},403);
      headers['Access-Control-Allow-Methods']='GET, POST, DELETE, OPTIONS';
      headers['Access-Control-Allow-Headers']='Authorization, Content-Type';
      return new Response(null,{status:204,headers});
    }
    const url=new URL(req.url);
    if(url.search || url.hash) return out({error:'not_found'},404);
    const path=url.pathname;
    const match=path.match(/^\/api\/ad-connections\/([0-9a-fA-F-]{36})$/);
    if(path!=='/api/ad-connections' && !match) return out({error:'not_found'},404);
    if((path==='/api/ad-connections' && !['GET','POST'].includes(req.method)) || (match && req.method!=='DELETE')) return out({error:'method_not_allowed'},405);
    if(match && !uuid(match[1])) return out({error:'not_found'},404);
    const tokenHeader=req.headers.get('authorization')||'';
    const tokenMatch=tokenHeader.match(/^Bearer ([A-Za-z0-9._-]{1,8192})$/);
    if (!tokenMatch) return out({error:'unauthenticated'},401);
    const token=tokenMatch[1];
    let principal;
    try { principal=await verifySession(token); } catch { return out({error:'unavailable'},503); }
    if (!uuid(principal?.id)) return out({error:'unauthenticated'},401);
    try {
      if(await memberAllowed(principal.id)!==true) return out({error:'forbidden'},403);
      if(await allowRequest(principal.id)!==true) return out({error:'rate_limited'},429);
    } catch {return out({error:'unavailable'},503);}
    if(req.method==='GET') {
      try {
        const rows=await listOwned(principal.id);
        if(!Array.isArray(rows)||rows.length>100) return out({error:'unavailable'},503);
        if(!rows.every(x=>x?.userId===principal.id && uuid(x.requestId) && account(x.adAccountId) && validStates.has(x.status))) return out({error:'unavailable'},503);
        return out({connections:rows.map(x=>({requestId:x.requestId,adAccountId:x.adAccountId,status:x.status}))},200);
      }catch{return out({error:'unavailable'},503);}
    }
    if(req.method==='DELETE') {
      try {const result=await service.disconnect(token,match[1]); return result?.ok ? out({status:'disconnected'},200):out({error:result?.code || 'unavailable'},statusCode[result?.code] || 503);}
      catch{return out({error:'unavailable'},503);}
    }
    if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(req.headers.get('content-type')||'')) return out({error:'invalid_input'},400);
    let body;
    try {
      const declared=req.headers.get('content-length');if(declared && (!/^\d+$/.test(declared) || Number(declared)>1024)) return out({error:'invalid_input'},400);
      const reader=req.body?.getReader();if(!reader)return out({error:'invalid_input'},400);
      const chunks=[];let size=0;
      try {for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>1024)return out({error:'invalid_input'},400);chunks.push(value);}}
      finally{try{await reader.cancel();}catch{}reader.releaseLock();}
      const bytes=new Uint8Array(size);let pos=0;for(const chunk of chunks){bytes.set(chunk,pos);pos+=chunk.length;}
      body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
    } catch {return out({error:'invalid_input'},400);}
    if(!body || Array.isArray(body) || typeof body!=='object' || Object.keys(body).length!==1 || !account(body.adAccountId)) return out({error:'invalid_input'},400);
    try {const result=await service.request(token,body.adAccountId);return result?.ok ? out({status:'pending_review'},201):out({error:result?.code || 'unavailable'},statusCode[result?.code] || 503);}
    catch {return out({error:'unavailable'},503);}
  };
}
