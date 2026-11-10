"use client";
import {useEffect,useState} from 'react';
import {ImageOff} from 'lucide-react';
import {type ShoppingAdSnapshot} from '@/lib/shopping-ad-snapshot';
import {fetchShoppingAdSnapshot} from '@/lib/fetch-shopping-ad-snapshot';
export function ShoppingAdPodium({keyword}:{keyword:string}){
 const [attempt,setAttempt]=useState(0);
 const [waiting,setWaiting]=useState(false);
 const [result,setResult]=useState<{keyword:string;snapshot?:ShoppingAdSnapshot;error?:string}|null>(null);
 useEffect(()=>{
  const controller=new AbortController();const timer=setTimeout(()=>{setResult({keyword,error:'조회 시간이 초과됐어요. 다시 조회해 주세요.'});controller.abort();},120000);
  async function load(){
   try{
    const snapshot=await fetchShoppingAdSnapshot(keyword,controller.signal,()=>setWaiting(true));
    if(!controller.signal.aborted)setResult({keyword,snapshot});
   }catch(error){if(!controller.signal.aborted)setResult({keyword,error:error instanceof Error?error.message:'광고 조회에 실패했어요.'});}
   finally{clearTimeout(timer);}
  }
  void load();return()=>{clearTimeout(timer);controller.abort();};
 },[keyword,attempt]);
 const current=result?.keyword===keyword?result:null;
 return <section className="mp-ad-podium" aria-label="통합검색 쇼핑광고 실제 캡처">
  <div className="mp-ad-heading"><div><span>네이버 통합검색 · 가격비교 쇼핑광고</span><h4>‘{keyword}’ 광고 화면</h4></div><button type="button" className="mp-secondary" disabled={!current} onClick={()=>{setWaiting(false);setResult(null);setAttempt(value=>value+1);}}>다시 조회</button></div>
  <div className="mp-ad-tablet"><div className="mp-ad-screen" aria-busy={!current}>
   {current?.snapshot?<><div className="mp-ad-observed"><time dateTime={current.snapshot.observedAt}>{new Date(current.snapshot.observedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})}</time></div><ol className="mp-auto-ad-captures">{current.snapshot.items.map(item=><li key={item.rank}><b>광고 {item.rank}</b><img src={item.capture!} alt={`확인 순서 ${item.rank} · ${item.title} · 실제 광고 화면`}/><p>{item.title}</p></li>)}</ol>{!current.snapshot.complete&&<p role="status">현재 화면에서 광고 3개를 모두 확인하지 못했어요.</p>}</>:<div className="mp-ad-capture-placeholder" role="status"><ImageOff size={32}/><h5>{current?.error||(waiting?'앞선 조회가 끝나면 자동으로 가져올게요':'실제 쇼핑광고 화면을 가져오고 있어요')}</h5><p>{current?.error?'광고가 없거나 접근이 제한되면 캡처를 표시할 수 없어요.':'별도 설치나 화면 선택 없이 자동으로 조회해요. 조회가 몰리면 최대 2분 정도 걸릴 수 있어요.'}</p></div>}
  </div></div><p className="mp-ad-notice">통합검색에 표시된 쇼핑광고이며, 쇼핑 전용 페이지의 1·2·3위와는 다를 수 있어요. 광고와 가격은 조회 시각에 따라 달라져요.</p>
 </section>;
}


