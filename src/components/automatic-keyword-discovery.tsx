"use client";
import {useEffect,useState} from 'react';
import {formatRange,rowVolume,validateKeywordResponse,type KeywordRow} from '@/lib/naver-keywords';
import {productKeywordSeed,selectProductKeywords} from '@/lib/product-keywords';
export function AutomaticKeywordDiscovery({productName}:{productName:string}){
 const [rows,setRows]=useState<KeywordRow[]>([]);const [busy,setBusy]=useState(true);
 const [error,setError]=useState('');const [retry,setRetry]=useState(0);const [date,setDate]=useState('');
 useEffect(()=>{
  const controller=new AbortController();let active=true;
  const timeout=setTimeout(()=>{controller.abort();if(active){setBusy(false);setError('키워드 분석 시간이 초과되었습니다. 다시 분석해 주세요.');}},15000);
  setBusy(true);setError('');setRows([]);setDate('');
  void (async()=>{try{
   const endpoint=process.env.NEXT_PUBLIC_KEYWORD_API_URL||'https://kitsnode.vercel.app/api/keywords';
   const url=new URL(endpoint);url.searchParams.set('keywords',productKeywordSeed(productName));
   const response=await fetch(url,{signal:controller.signal,credentials:'omit',cache:'no-store'});const raw=await response.json();
   if(!response.ok)throw Error(raw.error||'연관 키워드를 불러오지 못했습니다.');
   const data=validateKeywordResponse(raw);const found=selectProductKeywords(productKeywordSeed(productName),data.keywords);
   if(!found.length)throw Error('이 품목의 관련 키워드를 찾지 못했습니다. 상품 종류가 포함되도록 품목명을 수정해 주세요.');
   if(active){setRows(found);setDate(data.fetchedAt);}
  }catch(e){if(active&&!controller.signal.aborted)setError(e instanceof Error?e.message:'키워드 분석 실패');}
  finally{clearTimeout(timeout);if(active)setBusy(false);}})();
  return()=>{active=false;controller.abort();clearTimeout(timeout);};
 },[productName,retry]);
 const main=rows[0];
 return <div><p className="mp-keyword-source">품목 ‘{productName}’에서 관련 키워드를 자동으로 찾습니다. 예상 입찰가는 쇼핑검색광고 기준만 표시합니다.</p>
 <button type="button" className="mp-secondary" disabled={busy} onClick={()=>setRetry(v=>v+1)}>{busy?'관련 키워드 자동 분석 중…':'키워드 다시 분석'}</button>
 {error&&<p role="alert" className="mp-error">{error}</p>}
 {main&&<><div className="mp-keyword-main"><div><span>품목에서 자동으로 찾은 메인 키워드 후보</span><h4>{main.keyword}</h4><p>월간 검색량 {formatRange(rowVolume(main,'all'))}회 · PC+모바일</p></div><div><span>쇼핑검색광고 예상 입찰가</span><strong>자료 없음</strong><p>이 품목의 쇼핑검색 소재 기준 입찰가 자료가 아직 없습니다. 키워드만으로 소재의 순위별 입찰가를 산출할 수 없습니다.</p></div></div>
 <h4>세분화 키워드 검토 후보</h4><p className="mp-keyword-source">월간 검색량 기준 관련 후보입니다. 상품에 실제로 맞는 기능·용량·호환 조건인지 확인하세요.</p>
 <ol className="mp-keyword-candidates">{rows.slice(1).map((row,i)=><li key={row.keyword}><span className="mp-keyword-order">{i+1}</span><div><h4>{row.keyword}</h4><p>월간 검색량 {formatRange(rowVolume(row,'all'))}회</p><p>쇼핑검색 예상 입찰가 · 자료 없음</p></div></li>)}</ol>
 {!rows.slice(1).length&&<p>이 품목의 세분화 키워드 자료가 없습니다.</p>}
 <p className="mp-keyword-source">네이버 연관 키워드 · {date?new Date(date).toLocaleString('ko-KR'):''}. 리큐엠 쇼핑검색 실적 기준이 없는 품목에는 다른 상품의 CPC를 대입하지 않습니다.</p></>}
 </div>;
}
