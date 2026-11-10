"use client";
import {useState} from 'react';
import {ImageOff} from 'lucide-react';
import {type BrowserScreenCapture} from '@/lib/browser-screen-capture';
import {BrowserShoppingCapture} from './browser-shopping-capture';
export function ShoppingAdPodium({keyword}:{keyword:string}){
 const [capture,setCapture]=useState<(BrowserScreenCapture&{keyword:string})|null>(null);
 const current=capture?.keyword===keyword?capture:null;
 return <section className="mp-ad-podium" aria-label="검색 당시 쇼핑광고 상품">
  <div className="mp-ad-heading"><div><span>네이버쇼핑 · 실제 화면</span><h4>‘{keyword}’ 광고 1·2·3위</h4></div></div>
  <BrowserShoppingCapture key={keyword} keyword={keyword} onCapture={image=>setCapture({...image,keyword})}/>
  <div className="mp-ad-tablet"><div className="mp-ad-screen">
   {current?<><div className="mp-ad-observed"><b>사용자가 확인한 실제 화면 캡처</b><time dateTime={current.observedAt}>{new Date(current.observedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})} · 한국 시간</time><span>선택한 탭의 화면 · 검색어와 광고 순위는 사용자 확인</span></div><figure className="mp-user-screen"><img src={current.image} alt={`사용자가 확인한 ‘${keyword}’ 쇼핑광고 화면`}/><figcaption>사용자가 직접 확인한 광고 1·2·3위 화면</figcaption><button type="button" className="mp-secondary" onClick={()=>setCapture(null)}>캡처 이미지 지우기</button></figure></>:<div className="mp-ad-capture-placeholder" role="status"><ImageOff size={32}/><h5>캡처할 네이버쇼핑 화면을 선택해 주세요</h5><p>위의 ‘네이버쇼핑 탭 캡처’를 누르면 설치 없이 화면을 가져올 수 있어요.</p></div>}
  </div></div><p className="mp-ad-notice">검색어와 광고 표시를 확인해 주세요. 광고 순서·가격은 조회 시각과 기기에 따라 달라질 수 있어요. 캡처 이미지는 이 페이지에서만 보관되며 새로고침하면 지워져요.</p>
 </section>;
}
