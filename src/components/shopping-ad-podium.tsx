"use client";
import {useContext,useEffect,useState} from 'react';
import {ReportEvidenceContext} from './report-evidence-context';
import {ImageOff,Star,Heart,ShoppingBag,ArrowUpRight} from 'lucide-react';
import {shoppingAdPublicSearchUrl,type ShoppingAdSnapshot} from '@/lib/shopping-ad-snapshot';
import {fetchShoppingAdSnapshot} from '@/lib/fetch-shopping-ad-snapshot';
import {isDraftPreviewMode} from '@/lib/draft-preview-stage';
export function ShoppingAdPodium({keyword}:{keyword:string}){
 const [attempt,setAttempt]=useState(0);
 const [waiting,setWaiting]=useState(false);
 const [result,setResult]=useState<{keyword:string;snapshot?:ShoppingAdSnapshot;error?:string}|null>(null);
 useEffect(()=>{
  if(isDraftPreviewMode()){setResult({keyword,error:'편집 미리보기에서는 실제 광고를 조회하지 않습니다.'});return;}
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
 const updateEvidence=useContext(ReportEvidenceContext);
 const evidenceKey=JSON.stringify(current?.snapshot?{status:'ready',keyword,snapshot:{...current.snapshot,items:current.snapshot.items.map(({capture,...item})=>item)}}:current?.error?{status:'unavailable',keyword,error:current.error}:{status:'loading',keyword});
 useEffect(()=>{updateEvidence?.({ads:JSON.parse(evidenceKey)});},[updateEvidence,evidenceKey]);
 return <section className="mp-ad-podium" aria-label="네이버 통합검색 광고 상품 분석">
  <div className="mp-ad-heading"><div><span>네이버 통합검색 · PC 광고 상품</span><h4>‘{keyword}’ 상위 광고 상품</h4></div><button type="button" className="mp-secondary" disabled={!current} onClick={()=>{setWaiting(false);setResult(null);setAttempt(value=>value+1);}}>다시 조회</button></div>
  <div className="mp-ad-tablet"><div className="mp-ad-screen" aria-busy={!current}>
   {current?.snapshot?<><div className="mp-ad-observed"><time dateTime={current.snapshot.observedAt}>{new Date(current.snapshot.observedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})}</time></div><ol className="mp-auto-ad-captures">{current.snapshot.items.map(item=>{return <li key={item.rank}><b>광고 {item.rank}</b>{item.image?<img src={item.image} alt={item.title}/>:<span>썸네일 미제공</span>}<div><h5>{item.title}</h5><div className="mp-ad-stats"><span className="mp-ad-rating"><Star size={15} fill="currentColor" aria-hidden="true"/><b>{item.rating??'확인 불가'}</b></span><span className="mp-ad-reviews"><span>리뷰</span><b>{item.reviewCount||'확인 불가'}</b></span><span className="mp-ad-purchase"><ShoppingBag size={14} aria-hidden="true"/><span>구매</span><b>{item.purchaseCount||'확인 불가'}</b></span><span className="mp-ad-wish"><Heart size={14} aria-hidden="true"/><span>찜</span><b>{item.wishCount||'확인 불가'}</b></span></div><p>{item.dailySales!=null?`일간 판매 ${item.dailySales.toLocaleString('ko-KR')}개`:item.weeklySales!=null?`주간 판매 ${item.weeklySales.toLocaleString('ko-KR')}개`:'일간·주간 판매량 확인 안 됨'}</p><a className="mp-ad-visit" href={shoppingAdPublicSearchUrl(item.title)} target="_blank" rel="noopener noreferrer" aria-label={`광고 ${item.rank} 상품을 네이버에서 검색`}>상품 검색 <ArrowUpRight size={15}/></a></div></li>;})}</ol>{!current.snapshot.complete&&<p role="status">현재 화면에서 광고 3개를 모두 확인하지 못했어요.</p>}</>:<div className="mp-ad-capture-placeholder" role="status"><ImageOff size={32}/><h5>{current?.error||(waiting?'앞선 조회가 끝나면 자동으로 가져올게요':'입력한 키워드의 광고 상품을 분석하고 있어요')}</h5><p>{current?.error?'접근 제한 또는 광고 미노출 시 상품 정보를 확인할 수 없어요.':'조회까지 몇 분 걸릴 수 있어요. 잠시만 기다려주세요.'}</p></div>}
  </div></div><p className="mp-ad-notice">네이버 통합검색에서 광고 표시를 확인한 노출 순서입니다. 판매량은 공개된 일간 값을 우선하고 없으면 주간 값을 표시합니다. 확인하지 못한 수치는 추정하지 않습니다.</p>
 </section>;
}
