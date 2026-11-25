import {verifyNaverAgreements} from './naver-agreement.mjs';

// Inert until wired to an authenticated, session-aware service and a durable
// server-only evidence store. Never take the expected subject from the client.
export function createNaverAgreementHandler({origin, authenticate, recordEvidence, clientId, requiredTermCodes, termsVersion, privacyVersion, fetchImpl=fetch}) {
  const site = new URL(origin);
  if(site.origin!==origin || site.protocol!=='https:' || !clientId || !termsVersion || !privacyVersion || !Array.isArray(requiredTermCodes) || !requiredTermCodes.length || typeof authenticate!=='function' || typeof recordEvidence!=='function') throw TypeError('invalid_config');
  return async request=>{
    const headers={'content-type':'application/json','cache-control':'no-store','vary':'Origin'};
    if(request.headers.get('origin')!==origin) return new Response(null,{status:403,headers});
    headers['access-control-allow-origin']=origin;
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...headers,'access-control-allow-methods':'POST, OPTIONS','access-control-allow-headers':'authorization, apikey, content-type'}});
    const fail=(status=400)=>Response.json({ok:false,code:'unavailable'},{status,headers});
    if(request.method!=='POST'||!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type')||''))return fail();
    const auth=/^Bearer ([^\s]{1,8192})$/.exec(request.headers.get('authorization')||'');
    if(!auth)return fail(401);
    try{
      const size=request.headers.get('content-length');if(size&&(!/^\d+$/.test(size)||Number(size)>12000))return fail();
      if(!request.body)return fail();const reader=request.body.getReader();let length=0;const chunks=[];
      try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>12000){await reader.cancel();return fail()}chunks.push(value)}}finally{reader.releaseLock()}
      const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
      const body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
      if(!body || Object.keys(body).length!==1 || typeof body.providerToken!=='string')return fail();
      const session=await authenticate(auth[1]);
      if(!session?.userId||!session?.sessionId||!session?.naverSubject)return fail(401);
      const verified=await verifyNaverAgreements({providerToken:body.providerToken,expectedSubject:session.naverSubject,expectedClientId:clientId,requiredTermCodes,fetchImpl});
      if(!verified.ok)return fail(403);
      // recordEvidence must atomically recheck the same active session and bind
      // the configured terms, versions and verified evidence before storing.
      if(await recordEvidence({userId:session.userId,sessionId:session.sessionId,naverSubject:session.naverSubject,clientId,termsVersion,privacyVersion,agreements:verified.agreements})!==true)return fail(503);
      return Response.json({ok:true},{headers});
    }catch{return fail(503)}
  };
}
