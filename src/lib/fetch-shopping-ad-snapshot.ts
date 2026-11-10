import {validateShoppingAdSnapshot,type ShoppingAdSnapshot} from './shopping-ad-snapshot';
export async function fetchShoppingAdSnapshot(keyword:string,signal:AbortSignal,onWaiting:()=>void,{fetcher=fetch,wait=abortableWait}={}) : Promise<ShoppingAdSnapshot>{
 for(let attempt=0;attempt<10;attempt++){
  const response=await fetcher('https://kitsnode.vercel.app/api/shopping-ads?placement=integrated&keyword='+encodeURIComponent(keyword),{signal,cache:'no-store'});
  const raw=await response.json();
  if(response.status===429&&attempt<9){
   onWaiting();const seconds=Number(response.headers.get('Retry-After')||raw.retryAfter||5);
   await wait(Math.min(60,Math.max(2,Number.isFinite(seconds)?seconds:5))*1000,signal);continue;
  }
  if(!response.ok)throw Error(response.status===429?'조회 대기가 길어지고 있어요. 잠시 후 다시 확인해 주세요.':raw.reason==='SHOPPING_PAGE_BLOCKED'?'네이버가 서버 접근을 제한했어요.':raw.reason==='BROWSER_START_FAILED'?'캡처 서버를 시작하지 못했어요. 잠시 후 다시 조회해 주세요.':'네이버 광고 화면을 가져오지 못했어요. 잠시 후 다시 조회해 주세요.');
  const snapshot=validateShoppingAdSnapshot(raw,keyword);
  if(snapshot.placement!=='integrated'||!snapshot.items.length||snapshot.items.some(item=>!item.capture))throw Error('광고 표시가 있는 실제 화면을 확인하지 못했어요.');
  return snapshot;
 }
 throw Error('광고 조회 대기 시간이 초과됐어요.');
}
function abortableWait(milliseconds:number,signal:AbortSignal){
 return new Promise<void>((resolve,reject)=>{
  if(signal.aborted){reject(signal.reason);return;}
  const abort=()=>{clearTimeout(timer);reject(signal.reason);};
  const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},milliseconds);
  signal.addEventListener('abort',abort,{once:true});
 });
}
