// Candidate transport; config is server-only. Pin the exact HTTPS origin in deployment.
export function createLedgerClient({origin,token,fetchImpl=fetch,timeoutMs=5000}) {
 const u=new URL(origin);
 if(u.protocol!=='https:'||u.username||u.password||u.pathname!=='/'||u.search||u.hash||typeof token!=='string'||token.length<43||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>30000)throw Error('invalid_ledger_configuration');
 async function send(path,payload){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
  try {
   const res=await fetchImpl(u.origin+path,{method:'POST',redirect:'error',cache:'no-store',credentials:'omit',signal:controller.signal,headers:{'content-type':'application/json','user-agent':'KITSNODE-Withdrawal/1.0',authorization:'Bearer '+token},body:JSON.stringify(payload)});
   if(!res.ok)throw Error('ledger_unavailable');
   const body=await res.json();
   if(!body||body.ok!==true)throw Error('ledger_unavailable');
   if(path==='/retry-cursor'||path==='/set-retry-cursor'){
    const id=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
    if(body.cursor!==null&&!id(body.cursor))throw Error('ledger_unavailable');
    if(path==='/set-retry-cursor'&&body.cursor!==payload.cursor)throw Error('ledger_unavailable');
    return body.cursor;
   }
   if(path==='/pending'){
    const id=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
    if(!Array.isArray(body.entries)||body.entries.length>payload.limit||body.entries.some((r,i)=>!id(r.subject_id)||!id(r.request_id)||(i===0&&payload.after!==null&&r.request_id<=payload.after)||(i>0&&r.request_id<=body.entries[i-1].request_id)))throw Error('ledger_unavailable');
    return body.entries.map(r=>({subject:r.subject_id,requestId:r.request_id}));
   }
   if(path==='/lookup'&&body.found===false)return null;
   if(body.subjectId!==payload.subjectId||typeof body.requestId!=='string'||typeof body.completed!=='boolean'||(path!=='/lookup'&&body.requestId!==payload.requestId)||(path==='/lookup'&&(!body.found||typeof body.actorId!=='string')))throw Error('ledger_unavailable');
   return body;
  } catch {throw Error('ledger_unavailable')} finally {clearTimeout(timer)}
 }
 return {async lookupIntent({userId}){const row=await send('/lookup',{subjectId:userId});return row?{requestId:row.requestId,userId:row.subjectId,actorId:row.actorId,completed:row.completed}:null},async recordIntent({requestId,userId,actorId}){const row=await send('/intent',{requestId,subjectId:userId,actorId});return {requestId:row.requestId,userId:row.subjectId,durable:true}},async completeIntent({requestId,userId}){return (await send('/complete',{requestId,subjectId:userId})).completed===true},async pending(limit=25,after=null){if(!Number.isInteger(limit)||limit<1||limit>100||(after!==null&&(typeof after!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(after))))throw Error('invalid_cursor');return send('/pending',{limit,after})},async retryCursor(){return send('/retry-cursor',{})},async setRetryCursor(cursor){return send('/set-retry-cursor',{cursor})}};
}
