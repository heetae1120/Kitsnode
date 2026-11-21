let session=location.search.includes('signedout') ? null : {user:{id:'test-user'},access_token:'fixture.token'};
let listener:((event:string,currentSession:typeof session)=>void)|undefined;
Object.assign(window,{testSignOut:()=>{session=null;listener?.('SIGNED_OUT',null);}});
export function memberBrowserClient(){
  return {auth:{getSession:async()=>({data:{session}}),onAuthStateChange:(callback:(event:string,currentSession:typeof session)=>void)=>{listener=callback;queueMicrotask(()=>callback('SIGNED_IN',session));return {data:{subscription:{unsubscribe(){listener=undefined;}}}};}}};
}
