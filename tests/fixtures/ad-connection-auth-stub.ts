const session=location.search.includes('signedout') ? null : {user:{id:'test-user'},access_token:'fixture.token'};
export function memberBrowserClient(){
  return {auth:{getSession:async()=>({data:{session}}),onAuthStateChange:(callback:(event:string,currentSession:typeof session)=>void)=>{queueMicrotask(()=>callback('SIGNED_IN',session));return {data:{subscription:{unsubscribe(){}}}};}}};
}
