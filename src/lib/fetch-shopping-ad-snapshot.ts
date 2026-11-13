import {validateShoppingAdSnapshot,type ShoppingAdSnapshot} from './shopping-ad-snapshot';
export async function fetchShoppingAdSnapshot(keyword:string,signal:AbortSignal,onWaiting:()=>void,{fetcher=fetch,wait=abortableWait}={}) : Promise<ShoppingAdSnapshot>{
 for(let attempt=0;attempt<10;attempt++){
  const response=await fetcher('https://kitsnode.vercel.app/api/shopping-ads?placement=shopping&keyword='+encodeURIComponent(keyword),{signal,cache:'no-store'});
  const raw=await response.json().catch((error:unknown)=>{if(signal.aborted||error instanceof Error&&(error.name==='AbortError'||error.name==='TimeoutError'))throw error;return null;});
  if(signal.aborted)throw signal.reason;
  if(response.status===429&&attempt<9){
   const retryAfter=response.headers.get('Retry-After');
   const seconds=retryAfter?( /^\d+$/.test(retryAfter.trim())?Number(retryAfter): (Date.parse(retryAfter)-Date.now())/1000 ):Number(raw?.retryAfter??5);
   if(seconds>60)throw Error('서버가 더 긴 대기를 요청했어요. 자동 조회를 멈췄습니다. 잠시 후 다시 확인해 주세요.');
   onWaiting();await wait(Math.max(2,Number.isFinite(seconds)?seconds:5)*1000,signal);continue;
  }
  if(!response.ok)throw Error(response.status===429?'조회 대기가 길어지고 있어요. 잠시 후 다시 확인해 주세요.':raw?.reason==='SHOPPING_PAGE_BLOCKED'?'네이버가 서버 접근을 제한했어요.':raw?.reason==='BROWSER_START_FAILED'?'캡처 서버를 시작하지 못했어요. 잠시 후 다시 조회해 주세요.':'네이버 광고 화면을 가져오지 못했어요. 잠시 후 다시 조회해 주세요.');
  const snapshot=validateShoppingAdSnapshot(raw,keyword);
  if(snapshot.placement!=='shopping'||!snapshot.items.length||snapshot.items.some(item=>!item.capture))throw Error('광고 표시가 있는 실제 화면을 확인하지 못했어요.');
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
