"use client";
import {useEffect,useState} from 'react';
import {loadBidRanks,type BidRank} from '@/lib/bid-ranks';
import {formatRange,rowVolume,validateKeywordResponse,type KeywordRow} from '@/lib/naver-keywords';
import {productKeywordSeed,selectProductKeywords} from '@/lib/product-keywords';
import {keywordEconomics} from '@/lib/keyword-budget';
const money=(v:number)=>`${Math.round(v).toLocaleString('ko-KR')}원`;
export function AutomaticKeywordDiscovery({productName,perOrder,budget}:{productName:string;perOrder:number;budget:number}){
 const [rows,setRows]=useState<KeywordRow[]>([]);const [ranks,setRanks]=useState<Record<string,BidRank[]>>({});
 const [busy,setBusy]=useState(true);const [error,setError]=useState('');const [retry,setRetry]=useState(0);
 const [device,setDevice]=useState<'PC'|'MOBILE'>('MOBILE');const [cvr,setCvr]=useState('2');const [date,setDate]=useState('');
 useEffect(()=>{
  const controller=new AbortController();let active=true;
  const timeout=setTimeout(()=>{controller.abort();if(active){setBusy(false);setError('키워드 분석 시간이 초과되었습니다. 다시 분석해 주세요.');}},25000);
  setBusy(true);setError('');setRows([]);setRanks({});setDate('');
  void (async()=>{try{
   const endpoint=process.env.NEXT_PUBLIC_KEYWORD_API_URL||'https://kitsnode.vercel.app/api/keywords';
   const seed=productKeywordSeed(productName);const url=new URL(endpoint);url.searchParams.set('keywords',seed);
   const response=await fetch(url,{signal:controller.signal,credentials:'omit',cache:'no-store'});const raw=await response.json();
   if(!response.ok)throw Error(raw.error||'연관 키워드를 불러오지 못했습니다.');
   const data=validateKeywordResponse(raw);const found=selectProductKeywords(seed,data.keywords);
   if(!found.length)throw Error('이 품목의 관련 키워드를 찾지 못했습니다. 상품 종류가 포함되도록 품목명을 수정해 주세요.');
   if(!active)return;setRows(found);setDate(data.fetchedAt);
   for(const row of found){
    if(controller.signal.aborted)break;
    await loadBidRanks(endpoint,{adType:'powerlink',targetType:'id',target:row.keyword,device,count:3},controller.signal,result=>{
     if(active)setRanks(previous=>({...previous,[row.keyword]:[...(previous[row.keyword]||[]).filter(r=>r.position!==result.position),result].sort((a,b)=>a.position-b.position)}));
    });
   }
  }catch(e){if(active&&!controller.signal.aborted)setError(e instanceof Error?e.message:'키워드 분석 실패');}
  finally{clearTimeout(timeout);if(active)setBusy(false);}})();
  return()=>{active=false;controller.abort();clearTimeout(timeout);};
 },[productName,device,retry]);
 const firstBid=(keyword:string)=>ranks[keyword]?.find(r=>r.position===1)?.bid??null;
 const main=rows[0];
 const alternatives=rows.slice(1).sort((a,b)=>(firstBid(a.keyword)??Infinity)-(firstBid(b.keyword)??Infinity));
 const economics=(keyword:string)=>{const bid=firstBid(keyword);return bid?keywordEconomics(bid*1.1,Number(cvr),perOrder,budget):null;};
 return <div><p className="mp-keyword-source">품목 ‘{productName}’에서 네이버 관련 키워드를 자동으로 찾습니다. 리큐엠 실적 기준이 없는 품목에는 다른 상품의 CPC를 대입하지 않습니다.</p>
 <div className="mp-keyword-controls"><label>조회 기기<select aria-label="자동 키워드 조회 기기" value={device} onChange={e=>setDevice(e.target.value as 'PC'|'MOBILE')}><option value="MOBILE">모바일</option><option value="PC">PC</option></select></label><button type="button" className="mp-secondary" disabled={busy} onClick={()=>setRetry(v=>v+1)}>{busy?'관련 키워드·입찰가 자동 분석 중…':'키워드 다시 분석'}</button></div>
 {error&&<p role="alert" className="mp-error">{error}</p>}
 {main&&<><div className="mp-keyword-main"><div><span>품목에서 자동으로 찾은 메인 키워드 후보</span><h4>{main.keyword}</h4><span>월간 검색량 {formatRange(rowVolume(main,'all'))}회 · PC+모바일</span><strong>{firstBid(main.keyword)?money(firstBid(main.keyword)!):busy?'조회 중…':'자료 없음'}<small> / 1위 예상 입찰가</small></strong></div><div><label>구매전환율 가정<input aria-label="자동 분석 구매전환율 가정" type="number" min="0.01" max="100" step="0.1" value={cvr} onChange={e=>setCvr(e.target.value)}/> %</label><p>1위 예상 입찰가에 VAT 10%를 더해 CPC로 가정한 시뮬레이션입니다. 실제 결제 CPC가 아닙니다.</p><b>내 상품의 1건당 광고비 한도 {money(perOrder)}</b>{economics(main.keyword)&&<p>이 가정의 판매 1건당 광고비 {money(economics(main.keyword)!.cpa)} · {economics(main.keyword)!.affordable?'한도 이내':'한도 초과'}</p>}</div></div>
 <h4>세분화 키워드 검토 후보</h4><p className="mp-keyword-source">검색량이 있는 연관 후보 최대 3개 중 1위 예상 입찰가가 낮은 순서입니다. 상품에 실제로 맞는지 확인하세요. 검색량은 월간 PC·모바일 합계입니다.</p>
 <ol className="mp-keyword-candidates">{alternatives.map((row,i)=><li key={row.keyword}><span className="mp-keyword-order">{i+1}</span><div><h4>{row.keyword}</h4><p>월간 검색량 {formatRange(rowVolume(row,'all'))}회</p><strong>{firstBid(row.keyword)?money(firstBid(row.keyword)!):busy?'조회 중…':'자료 없음'}</strong><p>1위 예상 입찰가 · VAT 미포함</p>{economics(row.keyword)&&<p className={economics(row.keyword)!.affordable?'mp-keyword-good':'mp-keyword-over'}>판매 1건당 광고비 가정 {money(economics(row.keyword)!.cpa)} · {economics(row.keyword)!.affordable?'한도 이내':'한도 초과'}</p>}</div></li>)}</ol>
 {!alternatives.length&&!busy&&<p>이 품목의 세분화 키워드 자료가 없습니다.</p>}
 <div className="mp-keyword-table"><table><thead><tr><th>자동 분석 키워드</th><th>1위 예상 입찰가</th><th>2위</th><th>3위</th></tr></thead><tbody>{[main,...alternatives].map(row=><tr key={row.keyword}><th>{row.keyword}</th>{[1,2,3].map(position=>{const result=ranks[row.keyword]?.find(r=>r.position===position);return <td key={position}>{result?.error?'조회 실패':result?.bid?money(result.bid):busy?'조회 중…':'자료 없음'}</td>;})}</tr>)}</tbody></table></div>
 <p className="mp-keyword-source">네이버 파워링크 예상 입찰가 · VAT 미포함 · {date?new Date(date).toLocaleString('ko-KR'):''}. 노출 순위나 성과를 보장하지 않습니다. 관련 키워드 검색 결과는 자동 추린 후보이며 상품 적합성을 보장하지 않습니다.</p>
 {Object.values(ranks).flat().some(row=>row.error)&&<p className="mp-error" role="alert">일부 예상 입찰가를 불러오지 못했습니다. 키워드 다시 분석으로 재시도할 수 있습니다.</p>}</>}
 </div>;
}
