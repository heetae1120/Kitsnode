const valid=s=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
export function createStaffGateway({endpoint,secret,fetchImpl=fetch,timeoutMs=5000}){
 const u=new URL(endpoint);
 if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||u.pathname!=='/api/member-self-withdraw' || typeof secret!=='string'||secret.length<43||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>30000)throw Error('invalid_gateway');
 async function call(operation,{subject,requestId}){
  if(!valid(subject)||!valid(requestId))return false;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{const r=await fetchImpl(u.href,{method:'POST',headers:{'content-type':'application/json','user-agent':'KITSNODE-Withdrawal/1.0',authorization:`Bearer ${secret}`},body:JSON.stringify({operation,subject,requestId}),redirect:'error',cache:'no-store',credentials:'omit',signal:controller.signal});if(!r.ok)return false;const data=await r.json();return data?.ok===true&&Object.keys(data).length===1}catch{return false}finally{clearTimeout(timer)}
 }
 return {block:ctx=>call('block',ctx),cleanupIdentity:ctx=>call('cleanup_identity',ctx),verifyIdentity:ctx=>call('verify_identity',ctx)};
}
