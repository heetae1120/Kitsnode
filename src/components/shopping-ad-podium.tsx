"use client";
import {useEffect,useState} from 'react';
import {ImageOff,RefreshCw,ExternalLink,Star} from 'lucide-react';
import {type BrowserScreenCapture} from '@/lib/browser-screen-capture';
import {BrowserShoppingCapture} from './browser-shopping-capture';
import observations from '@/data/shopping-ad-observations.json';
import {shoppingSearchUrl,validateShoppingAdSnapshot,type ShoppingAdSnapshot} from '@/lib/shopping-ad-snapshot';

export function ShoppingAdPodium({keyword}:{keyword:string}){
 const [localCapture,setLocalCapture]=useState<(BrowserScreenCapture&{keyword:string})|null>(null);
 const [result,setResult]=useState<{keyword:string;snapshot:ShoppingAdSnapshot|null;archived:boolean;notice:string}|null>(null);
 const [busy,setBusy]=useState(true);const [attempt,setAttempt]=useState(0);
 useEffect(()=>{
  let active=true;const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),45000);
  setBusy(true);setResult(null);
  void(async()=>{
   let snapshot:ShoppingAdSnapshot|null=null;let archived=false;let notice='';
   try{
    const endpoint=new URL(process.env.NEXT_PUBLIC_KEYWORD_API_URL||'https://kitsnode.vercel.app/api/keywords');
    endpoint.pathname='/api/shopping-ads';endpoint.search='';endpoint.searchParams.set('keyword',keyword);
    const response=await fetch(endpoint,{signal:controller.signal,credentials:'omit',cache:'no-store'});
    const payload=await response.json();
    if(!response.ok)throw Error(payload.reason==='SHOPPING_PAGE_BLOCKED'?'네이버쇼핑에서 서버 접근을 제한해 캡처하지 못했어요. (SHOPPING_PAGE_BLOCKED)':payload.reason==='AD_RESULTS_NOT_CONFIRMED'?'검색 페이지에서 광고 표시를 확인하지 못해 순위를 확정할 수 없어요.':'광고 캡처 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.');
    snapshot=validateShoppingAdSnapshot(payload,keyword);
   }catch(error){
    notice=error instanceof Error?error.message:'현재 광고를 자동으로 확인하지 못했어요.';
    const saved=observations.find(row=>row.keyword.replace(/\s/g,'')===keyword.replace(/\s/g,''));
    if(saved){try{snapshot=validateShoppingAdSnapshot(saved,keyword);archived=true;}catch{}}
   }finally{clearTimeout(timer);if(active){setResult({keyword,snapshot,archived,notice});setBusy(false);}}
  })();
  return()=>{active=false;controller.abort();clearTimeout(timer);};
 },[keyword,attempt]);
 const state=result?.keyword===keyword?result:null;const imported=localCapture?.keyword===keyword?localCapture:null;const snapshot=state?.snapshot;
 return <section className="mp-ad-podium" aria-label="검색 당시 쇼핑광고 상품"><div className="mp-ad-heading"><div><span>네이버 쇼핑 · PC</span><h4>‘{keyword}’ 광고에 나온 상품</h4></div><button type="button" className="mp-secondary" disabled={busy} onClick={()=>setAttempt(v=>v+1)}><RefreshCw size={14}/>{busy?'링크에서 확인 중…':'링크에서 다시 확인'}</button></div>
  <BrowserShoppingCapture keyword={keyword} onCapture={snapshot=>setLocalCapture({...snapshot,keyword})}/>
  <div className="mp-ad-tablet"><div className="mp-ad-screen"><div className="mp-ad-observed" role="status">{imported?<><b>사용자가 확인한 실제 화면 캡처</b><time dateTime={imported.observedAt}>{new Date(imported.observedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})} · 한국 시간</time><span>선택한 탭의 화면 · 검색어와 광고 순위는 사용자 확인</span></>:snapshot?<><b>{state?.archived?'저장된 확인 기록':'조회 결과'}</b><time dateTime={snapshot.observedAt}>{new Date(snapshot.observedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})} · 한국 시간</time><span>{snapshot.context}</span></>:<b>{busy?'광고 상품을 확인하고 있어요.':'지금 확인한 광고 자료가 없어요.'}</b>}</div>
   <div className="mp-ad-list-heading">광고 상품 · 상위 3개</div>
   {imported?<figure className="mp-user-screen"><img src={imported.image} alt={`사용자가 확인한 ‘${keyword}’ 쇼핑광고 화면`}/><figcaption>사용자가 직접 확인한 광고 1·2·3위 화면</figcaption><button type="button" className="mp-secondary" onClick={()=>setLocalCapture(null)}>캡처 이미지 지우기</button></figure>:snapshot?<ol className="mp-ad-products">{[1,2,3].map(rank=>{const item=snapshot?.items.find(row=>row.rank===rank);if(item?.capture)return <li key={rank} className="mp-ad-capture"><span className="mp-ad-place">광고 {rank}위 · 실제 화면</span><img src={item.capture} alt={`조회 당시 광고 ${rank}위: ${item.title}`}/></li>;return <li key={rank}>
    <div className="mp-ad-image"><span className="mp-ad-place">광고 {rank}위</span>{item?.image?<img src={item.image} alt={item.title} referrerPolicy="no-referrer" onError={e=>{e.currentTarget.style.display='none';}}/>:<ImageOff size={30} aria-label="상품 이미지 없음"/>}</div>
    <div className="mp-ad-summary">{item?<>{item.promotion&&<p className="mp-ad-promotion">{item.promotion}</p>}<h5>{item.title}</h5>{item.originalPrice!=null&&<del className="mp-ad-original">{item.originalPrice.toLocaleString('ko-KR')}원</del>}<div className="mp-ad-price"><span>광고</span><strong>{item.price===null?'가격 확인 필요':`${item.price.toLocaleString('ko-KR')}원`}</strong></div>{item.couponPrice!=null&&<p className="mp-ad-coupon">{item.couponPrice.toLocaleString('ko-KR')}원 <small>쿠폰할인가</small></p>}{item.shipping&&<p className="mp-ad-shipping">{item.shipping}</p>}{item.category&&<p className="mp-ad-category">{item.category}</p>}{item.specifications&&<p className="mp-ad-specs">{item.specifications}</p>}<div className="mp-ad-reviews">{item.rating!=null?<span><Star size={12} fill="currentColor"/> 별점 {item.rating.toLocaleString('ko-KR',{maximumFractionDigits:2})}</span>:<span>별점 정보 없음</span>}{item.reviewCount?<span>리뷰 {item.reviewCount}</span>:<span>리뷰 수 정보 없음</span>}{item.wishCount&&<span>찜 {item.wishCount}</span>}{item.registeredAt&&<span>등록일 {item.registeredAt}</span>}</div><a href={shoppingSearchUrl(item.title)} target="_blank" rel="noopener noreferrer">상품 검색<ExternalLink size={12}/></a></>:<div className="mp-ad-empty"><h5>{busy?'광고 상품 확인 중':snapshot?.complete&&snapshot.items.length===0?'노출된 광고 없음':'확인 자료 없음'}</h5><p>{busy?'잠시만 기다려 주세요.':'자료를 확인하면 상품명과 가격이 여기에 나와요.'}</p></div>}</div>
    <div className="mp-ad-seller"><span>판매처</span><p>{item?.mall||'판매처 정보 없음'}</p></div>
   </li>;})}</ol>:<div className="mp-ad-capture-error" role="status"><ImageOff size={32}/><h5>{busy?'입력한 검색어로 광고를 캡처하고 있어요':'실제 광고 화면을 캡처하지 못했어요'}</h5><p>{busy?'네이버쇼핑 첫 페이지의 광고 1·2·3위를 확인합니다.':state?.notice}</p></div>}
  </div></div>
  <p className="mp-ad-notice">위 상품과 순위·가격은 조회 시간에 따라 변동될 수 있어요.{!imported&&state?.archived?' 표시된 시각에 저장한 자료예요.':''}{state?.notice&&!snapshot&&!imported?' 현재 자료를 불러오지 못했어요. 네이버 쇼핑에서 확인해 주세요.':''}</p>
  <div className="mp-ad-foot"><p>위 예상 입찰가와는 별도 자료예요. 쿠폰·배송 조건에 따라 가격이 달라져요.</p><a href={shoppingSearchUrl(keyword)} target="_blank" rel="noopener noreferrer">지금 바로 네이버쇼핑보러가기<ExternalLink size={18}/></a></div>
 </section>;
}
