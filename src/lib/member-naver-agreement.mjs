// Optional, OFF by default. Never persist/log provider tokens; only the
// authenticated first-party Edge Function can turn verified Naver consent
// into a member-consent record. Failure leaves the normal consent gate active.
export function createNaverAgreementBridge({enabled,url,key,fetchImpl=fetch}={}){
 let origin;try{const parsed=new URL(url);if(parsed.protocol!=='https:'||!/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(parsed.origin)||parsed.href!==parsed.origin+'/')throw Error('origin');origin=parsed.origin}catch{throw TypeError('invalid_url')}
 if(typeof key!=='string'||!key||typeof fetchImpl!=='function')throw TypeError('invalid_dependencies');
 let closed=false,generation=0;const inflight=new Set();
 return Object.freeze({
  async verify(session){
   if(enabled!==true||closed)return false;
   const bearer=session?.access_token,providerToken=session?.provider_token,identities=session?.user?.identities;
   if(typeof bearer!=='string'||!bearer||bearer.length>8192||typeof providerToken!=='string'||!providerToken||providerToken.length>8192||!Array.isArray(identities)||!identities.some(i=>i?.provider==='custom:naver'))return false;
   const current=generation,controller=new AbortController();inflight.add(controller);const timer=setTimeout(()=>controller.abort(),8000);
   try{
    const response=await fetchImpl(`${origin}/functions/v1/kitsnode-naver-agreement`,{method:'POST',headers:{'content-type':'application/json',apikey:key,authorization:`Bearer ${bearer}`},body:JSON.stringify({providerToken}),credentials:'omit',redirect:'error',signal:controller.signal});
    if(closed||current!==generation||!response.ok)return false;
    const data=await response.json();return !closed&&current===generation&&data?.ok===true&&Object.keys(data).length===1;
   }catch{return false}finally{clearTimeout(timer);inflight.delete(controller)}
  },
  cancel(){generation++;for(const c of inflight)c.abort();inflight.clear()},
  dispose(){closed=true;generation++;for(const c of inflight)c.abort();inflight.clear()}
 });
}
