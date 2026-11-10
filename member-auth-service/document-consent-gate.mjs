import {validDocumentSelections} from './document-consents.mjs';
export function createDocumentConsentGate({auth,store,documents,allowedOrigins}) {
 async function session(request) {try {const s=await auth.api.getSession({headers:request.headers});return typeof s?.user?.id==='string' && s.user.id ? s:null;} catch {return null;}}
 return {
  async authorize(request) {
   const s=await session(request); if(!s) return {ok:false,status:401};
   try {const consentStatus=await store.status(s.user.id);return {ok:documents.every(d=>consentStatus[d.type]===true),status:documents.every(d=>consentStatus[d.type]===true)?200:403,userId:s.user.id,consentStatus};} catch{return {ok:false,status:503};}
  },
  async accept(request) {
   if(request.method!=='POST'||!allowedOrigins.includes(request.headers.get('origin'))||!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type')||'')) return {ok:false,status:403};
   const s=await session(request); if(!s) return {ok:false,status:401};
   let body;try {const raw=await request.text();if(new TextEncoder().encode(raw).length>16384)return {ok:false,status:400};body=JSON.parse(raw);}catch{return {ok:false,status:400};}
   if(!body || Object.keys(body).join(',')!=='consents' || !validDocumentSelections(body.consents,documents))return {ok:false,status:400};
   try {await store.record(s.user.id,body.consents);return {ok:true,status:200};}catch{return {ok:false,status:503};}
  }
 };
}
