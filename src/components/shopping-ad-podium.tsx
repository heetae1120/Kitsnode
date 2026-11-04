"use client";
import {useEffect,useState} from 'react';
import {ImageOff,RefreshCw,ExternalLink} from 'lucide-react';
import observations from '@/data/shopping-ad-observations.json';
import {shoppingSearchUrl,validateShoppingAdSnapshot,type ShoppingAdSnapshot} from '@/lib/shopping-ad-snapshot';

export function ShoppingAdPodium({keyword}:{keyword:string}){
 const [result,setResult]=useState<{keyword:string;snapshot:ShoppingAdSnapshot|null;archived:boolean;notice:string}|null>(null);
 const [busy,setBusy]=useState(true);const [attempt,setAttempt]=useState(0);
 useEffect(()=>{
  let active=true;const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),12000);
  setBusy(true);setResult(null);
  void(async()=>{
   let snapshot:ShoppingAdSnapshot|null=null;let archived=false;let notice='';
   try{
    const endpoint=new URL(process.env.NEXT_PUBLIC_KEYWORD_API_URL||'https://kitsnode.vercel.app/api/keywords');
    endpoint.pathname='/api/shopping-ads';endpoint.search='';endpoint.searchParams.set('keyword',keyword);
    const response=await fetch(endpoint,{signal:controller.signal,credentials:'omit',cache:'no-store'});
    if(!response.ok)throw Error();
    snapshot=validateShoppingAdSnapshot(await response.json(),keyword);
   }catch{
    notice='현재 광고를 자동으로 확인하지 못했어요.';
    const saved=observations.find(row=>row.keyword.replace(/\s/g,'')===keyword.replace(/\s/g,''));
    if(saved){try{snapshot=validateShoppingAdSnapshot(saved,keyword);archived=true;}catch{}}
   }finally{clearTimeout(timer);if(active){setResult({keyword,snapshot,archived,notice});setBusy(false);}}
  })();
  return()=>{active=false;controller.abort();clearTimeout(timer);};
 },[keyword,attempt]);
 const state=result?.keyword===keyword?result:null;const snapshot=state?.snapshot;
 return <section className="mp-ad-podium" aria-label="검색 당시 쇼핑광고 상품"><div className="mp-ad-heading"><div><span>네이버 쇼핑 · PC</span><h4>‘{keyword}’ 광고에 나온 상품</h4></div><button type="button" className="mp-secondary" disabled={busy} onClick={()=>setAttempt(v=>v+1)}><RefreshCw size={14}/>{busy?'확인 중…':'다시 확인'}</button></div>
  <div className="mp-ad-tablet"><div className="mp-ad-screen"><div className="mp-ad-observed" role="status">{snapshot?<><b>{state?.archived?'저장된 확인 기록':'조회 결과'}</b><time dateTime={snapshot.observedAt}>{new Date(snapshot.observedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})} · 한국 시간</time><span>{snapshot.context}</span></>:<b>{busy?'광고 상품을 확인하고 있어요.':'지금 확인한 광고 자료가 없어요.'}</b>}</div>
   <ol className="mp-ad-products">{[1,2,3].map(rank=>{const item=snapshot?.items.find(row=>row.rank===rank);return <li key={rank}><span className="mp-ad-place">광고 {rank}위</span>{item?<><div className="mp-ad-image">{item.image?<img src={item.image} alt={item.title} referrerPolicy="no-referrer" onError={e=>{e.currentTarget.style.display='none';}}/>:<ImageOff size={30} aria-label="상품 이미지 없음"/>}</div><h5>{item.title}</h5><p>{item.mall||'판매처 정보 없음'}</p><strong>{item.price===null?'가격 확인 필요':`${item.price.toLocaleString('ko-KR')}원`}</strong><a href={shoppingSearchUrl(item.title)} target="_blank" rel="noopener noreferrer">상품 검색<ExternalLink size={12}/></a></>:<div className="mp-ad-empty"><ImageOff size={30}/><p>{busy?'확인 중':snapshot?.complete&&snapshot.items.length===0?'노출된 광고 없음':'확인 자료 없음'}</p></div>}</li>;})}</ol>
  </div></div>
  {state?.notice&&<p className="mp-ad-notice">{state.notice}{state.archived?' 위 상품은 표시된 시각에 직접 확인한 기록이에요. 지금 순위와 다를 수 있어요.':' 현재 광고 상품을 확인하려면 네이버 쇼핑을 열어보세요.'}</p>}
  <div className="mp-ad-foot"><p>확인한 화면의 광고 노출 순서예요. 위 예상 입찰가와는 별도 기록이에요. 시간·기기·검색 조건에 따라 달라져요. 가격은 쿠폰·배송비에 따라 달라질 수 있어요.</p><a href={shoppingSearchUrl(keyword)} target="_blank" rel="noopener noreferrer">네이버 쇼핑 열기<ExternalLink size={13}/></a></div>
 </section>;
}
