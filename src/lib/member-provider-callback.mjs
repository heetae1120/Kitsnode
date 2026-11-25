// A singleton client can finish its OAuth callback before the member screen
// subscribes. Hold that one callback in memory briefly, never in storage.
export function createProviderCallbackCapture(auth, {ttlMs=30000}={}) {
 let captured=null, timer=null;
 const clear=()=>{captured=null;if(timer!==null){clearTimeout(timer);timer=null}};
 const {data:{subscription}}=auth.onAuthStateChange((event,session)=>{
  if(event==='SIGNED_OUT'){clear();return;}
  if(captured && (!session || session.access_token!==captured.access || session.user?.id!==captured.user))clear();
  if(event!=='SIGNED_IN'||typeof session?.provider_token!=='string'||!session.provider_token||
     typeof session?.access_token!=='string'||typeof session?.user?.id!=='string'||
     !session.user.identities?.some(i=>i.provider==='custom:naver'))return;
  clear();captured={access:session.access_token,user:session.user.id,provider:session.provider_token};
  timer=setTimeout(clear,ttlMs);
 });
 return Object.freeze({
  take(session){
   if(!captured || !session || session.access_token!==captured.access || session.user?.id!==captured.user)return null;
   const value=captured.provider;clear();return value;
  },
  dispose(){clear();subscription.unsubscribe();}
 });
}
