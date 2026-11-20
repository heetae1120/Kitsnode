// Review-only HTTP boundary. Mount behind TLS using an exact allowlisted origin,
// a trusted runtime-provided client identity and redacted application logs.
const response = (status, body, corsOrigin='') => {
  const headers={'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','vary':'Origin'};
  if (corsOrigin) headers['access-control-allow-origin']=corsOrigin;
  return new Response(JSON.stringify(body),{status,headers});
};
async function readBounded(request,limit=16384) {
  const contentLength = request.headers.get('content-length');
  if (contentLength && (!/^\d+$/.test(contentLength) || Number(contentLength)>limit)) throw new Error('body_too_large');
  if (!request.body) throw new Error('body_missing');
  const reader=request.body.getReader(); let count=0; const chunks=[];
  try {while(true){const {done,value}=await reader.read(); if(done) break; count+=value.byteLength;if(count>limit) throw new Error('body_too_large');chunks.push(value);}}
  finally {reader.releaseLock();}
  const bytes=new Uint8Array(count); let offset=0;for(const part of chunks){bytes.set(part,offset);offset+=part.byteLength;}
  const parsed=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid_body');
  return parsed;
}
export function createMemberOnboardingHttpCandidate({service,trustedOrigin,clientKeyFromRuntime}) {
  if (!service || typeof clientKeyFromRuntime !== 'function') throw new TypeError('invalid_dependencies');
  const origin = new URL(trustedOrigin);
  if (origin.origin !== trustedOrigin || (origin.protocol !== 'https:' && !(origin.protocol === 'http:' && ['localhost','127.0.0.1'].includes(origin.hostname)))) throw new TypeError('invalid_origin');
  const methods = new Set(['checkUsername','register','inspectDraft','complete','completeManual','signIn']);
  return async function handle(request,method) {
    if (request.headers.get('origin') !== trustedOrigin) return response(403,{ok:false,code:'forbidden'});
    const reply=(status,body)=>response(status,body,trustedOrigin);
    if (!methods.has(method) || typeof service[method] !== 'function') return reply(404,{ok:false,code:'not_found'});
    if (request.method === 'OPTIONS') {
      const requestedMethod=request.headers.get('access-control-request-method');
      const requestedHeaders=(request.headers.get('access-control-request-headers') || '').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
      if (requestedMethod !== 'POST' || requestedHeaders.some(x=>!['content-type','authorization'].includes(x))) return reply(403,{ok:false,code:'forbidden'});
      return new Response(null,{status:204,headers:{'access-control-allow-origin':trustedOrigin,'access-control-allow-methods':'POST, OPTIONS','access-control-allow-headers':'content-type, authorization','cache-control':'no-store','vary':'Origin, Access-Control-Request-Method, Access-Control-Request-Headers'}});
    }
    if (request.method !== 'POST') return reply(405,{ok:false,code:'method_not_allowed'});
    if (!/^application\/json(?:\s*;.*)?$/i.test(request.headers.get('content-type') || '')) return reply(415,{ok:false,code:'invalid_content_type'});
    let data,clientKey;
    try {data=await readBounded(request);clientKey=await clientKeyFromRuntime(request);} catch {return reply(400,{ok:false,code:'invalid_request'});}
    const authorization=request.headers.get('authorization') || '';
    const bearer = /^Bearer ([^\s]+)$/.exec(authorization);
    // Request fields cannot override the trusted client key or bearer token.
    try {
      const result=await service[method]({...data,clientKey,token:bearer?.[1] || ''});
      return reply(result?.code === 'unavailable' && result?.ok === false ? 503 : 200,result || {ok:false,code:'unavailable'});
    } catch {return reply(503,{ok:false,code:'unavailable'});}
  };
}
