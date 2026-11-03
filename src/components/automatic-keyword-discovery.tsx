"use client";
import {useEffect,useState} from 'react';
import {formatRange,rowVolume,validateKeywordResponse,type KeywordRow} from '@/lib/naver-keywords';
import {productKeywordSeed,selectProductKeywords} from '@/lib/product-keywords';
import {shoppingVolumeReferences,calibrateShoppingVolume,estimateShoppingVolume} from '@/lib/shopping-volume-estimate';
import {keywordEconomics} from '@/lib/keyword-budget';
import {FormattedNumberInput} from './formatted-number-input';
const money=(v:number)=>`${Math.round(v).toLocaleString('ko-KR')}원`;
const estimateMoney=(v:number)=>v<10?'10원 미만':money(Math.round(v/10)*10);
export function AutomaticKeywordDiscovery({productName,perOrder,budget}:{productName:string;perOrder:number;budget:number}){
 const [rows,setRows]=useState<KeywordRow[]>([]);const [sourceRows,setSourceRows]=useState<KeywordRow[]>([]);
 const [busy,setBusy]=useState(true);const [error,setError]=useState('');const [retry,setRetry]=useState(0);const [date,setDate]=useState('');const [cvr,setCvr]=useState('2');
 useEffect(()=>{
  const controller=new AbortController();let active=true;
  const timeout=setTimeout(()=>{controller.abort();if(active){setBusy(false);setError('키워드 분석 시간이 초과되었습니다. 다시 분석해 주세요.');}},15000);
  setBusy(true);setError('');setRows([]);setSourceRows([]);setDate('');
  void (async()=>{try{
   const endpoint=process.env.NEXT_PUBLIC_KEYWORD_API_URL||'https://kitsnode.vercel.app/api/keywords';
   const seed=productKeywordSeed(productName);const url=new URL(endpoint);
   url.searchParams.set('keywords',[...new Set([seed,...shoppingVolumeReferences.map(row=>row.keyword)])].join(','));
   const response=await fetch(url,{signal:controller.signal,credentials:'omit',cache:'no-store'});const raw=await response.json();
   if(!response.ok)throw Error(raw.error||'연관 키워드를 불러오지 못했습니다.');
   const data=validateKeywordResponse(raw);const found=selectProductKeywords(seed,data.keywords);
   if(!found.length)throw Error('이 품목의 관련 키워드를 찾지 못했습니다. 상품 종류가 포함되도록 품목명을 수정해 주세요.');
   if(active){setRows(found);setSourceRows(data.keywords);setDate(data.fetchedAt);}
  }catch(e){if(active&&!controller.signal.aborted)setError(e instanceof Error?e.message:'키워드 분석 실패');}
  finally{clearTimeout(timeout);if(active)setBusy(false);}})();
  return()=>{active=false;controller.abort();clearTimeout(timeout);};
 },[productName,retry]);
 const main=rows[0];const calibration=calibrateShoppingVolume(sourceRows);
 const estimate=(row:KeywordRow)=>estimateShoppingVolume(row,calibration);
 const mainEstimate=main?estimate(main):null;
 const alternatives=rows.slice(1).sort((a,b)=>(estimate(a)?.bids[0]??Infinity)-(estimate(b)?.bids[0]??Infinity));
 const economics=(row:KeywordRow)=>{const result=estimate(row);return result?keywordEconomics(result.bids[0]*1.1,Number(cvr),perOrder,budget):null;};
 return <div><p className="mp-keyword-source">품목 ‘{productName}’의 검색량을 리큐엠 보조배터리·무선충전기 소재 데이터와 비교해 쇼핑검색광고 입찰가를 환산합니다.</p>
 <button type="button" className="mp-secondary" disabled={busy} onClick={()=>setRetry(v=>v+1)}>{busy?'관련 키워드·검색량 분석 중…':'키워드 다시 분석'}</button>
 {error&&<p role="alert" className="mp-error">{error}</p>}
 {main&&<><div className="mp-keyword-main"><div><span>품목에서 자동으로 찾은 메인 키워드</span><h4>{main.keyword}</h4><p>월간 검색량 {formatRange(rowVolume(main,'all'))}회 · PC+모바일</p><p>환산에 사용한 PC 검색량 {formatRange(rowVolume(main,'pc'))}회</p></div><div><span className="mp-estimate-badge">리큐엠 데이터 기반 환산 추정 · PC</span><strong>{mainEstimate?estimateMoney(mainEstimate.bids[0]):'검색량 자료 부족'}</strong><p>쇼핑검색광고 1위 입찰가 환산 · VAT 미포함</p>{mainEstimate&&<p>기준 평균 PC 검색량 대비 {mainEstimate.ratio.toLocaleString('ko-KR',{maximumFractionDigits:2})}배</p>}</div></div>
 {mainEstimate&&<><div className="mp-rank-reference mp-volume-ranks">{mainEstimate.bids.map((bid,i)=><div key={i}><span>{i+1}위 환산 추정 입찰가</span><strong>{estimateMoney(bid)}</strong><small>두 기준별 환산 범위<br/>{estimateMoney(mainEstimate.ranges[i].min)}–{estimateMoney(mainEstimate.ranges[i].max)}</small></div>)}</div><details className="mp-story-details"><summary>구매로 이어질 때 광고비는? · 전환율 가정</summary><div className="mp-keyword-main"><div><label>구매전환율 가정<FormattedNumberInput aria-label="환산 추정 구매전환율 가정" value={cvr} onValueChange={setCvr}/> %</label><p>실제 전환율을 입력하면 수익성 가정도 함께 바뀝니다.</p></div><div><b>내 상품의 1건당 광고비 한도 {money(perOrder)}</b>{economics(main)&&<p>1위 환산 입찰가 + VAT를 CPC로 가정한 판매 1건당 광고비 {money(economics(main)!.cpa)} · {economics(main)!.affordable?'한도 이내':'한도 초과'}</p>}</div></div></details></>}
 {!mainEstimate&&<p className="mp-keyword-source">대상과 두 기준 품목의 정확한 PC 검색량이 모두 있어야 환산할 수 있습니다. 0회·범위값·누락값은 금액을 임의로 채우지 않습니다.</p>}
 <h4>이런 검색어도 함께 살펴보세요</h4><p className="mp-keyword-source">관련 후보 최대 3개 중 1위 환산 금액이 낮은 순서입니다. 검색량 기반 비교이므로 실제 상품에 맞는 키워드인지 확인하세요.</p>
 <ol className="mp-keyword-candidates">{alternatives.map((row,i)=><li key={row.keyword}><span className="mp-keyword-order">{i+1}</span><div><h4>{row.keyword}</h4><p>월간 PC 검색량 {formatRange(rowVolume(row,'pc'))}회</p><strong>{estimate(row)?estimateMoney(estimate(row)!.bids[0]):'자료 부족'}</strong><p>1위 환산 추정 · VAT 미포함</p>{economics(row)&&<p className={economics(row)!.affordable?'mp-keyword-good':'mp-keyword-over'}>구매전환율 {cvr}% 가정 · 판매 1건당 광고비 {money(economics(row)!.cpa)} · {economics(row)!.affordable?'한도 이내':'한도 초과'}</p>}</div></li>)}</ol>
 {!alternatives.length&&<p>이 품목의 세분화 키워드 자료가 없습니다.</p>}
 <details className="mp-story-details"><summary>후보별 1·2·3위 금액 비교하기</summary><div className="mp-keyword-table"><table><thead><tr><th>자동 분석 키워드</th><th>1위 환산 추정</th><th>2위 환산 추정</th><th>3위 환산 추정</th></tr></thead><tbody>{[main,...alternatives].map(row=><tr key={row.keyword}><th>{row.keyword}</th>{[0,1,2].map(position=><td key={position}>{estimate(row)?estimateMoney(estimate(row)!.bids[position]):'자료 부족'}</td>)}</tr>)}</tbody></table></div></details>
 {calibration&&<details className="mp-shopping-reference"><summary>리큐엠 기준 데이터와 환산식 보기</summary><div className="mp-keyword-table"><table><thead><tr><th>기준 품목 · PC</th><th>월간 PC 검색량</th><th>1위</th><th>2위</th><th>3위</th></tr></thead><tbody>{calibration.references.map(row=><tr key={row.keyword}><th>{row.keyword} · {row.product}</th><td>{row.volume.toLocaleString('ko-KR')}회</td>{row.bids.map((bid,i)=><td key={i}>{money(bid)}</td>)}</tr>)}</tbody></table></div><p>각 순위 환산 입찰가 = 기준 두 품목의 평균 입찰가 × (대상 PC 검색량 ÷ 기준 평균 PC 검색량 {calibration.averageVolume.toLocaleString('ko-KR')}회). 10원 단위로 반올림해 표시합니다.</p><p>기준 견적은 리큐엠 쇼핑검색 PC 소재 전체의 순위별 평균 입찰가이며 해당 키워드만의 견적이 아닙니다. 순위별 견적 확인일 2026.11.03 · 검색량 조회 {new Date(date).toLocaleString('ko-KR')}.</p></details>}
 <p className="mp-keyword-source">검색량에 입찰가가 정비례한다고 가정한 예산 검토용 추정입니다. 실제 네이버 조회 입찰가·결제 CPC·순위 보장이 아닙니다. ‘두 기준별 환산 범위’는 두 기준을 각각 적용한 차이로, 통계적 신뢰구간이 아닙니다. 업종별 경쟁·품질·전환율 차이는 반영하지 않습니다.</p></>}
 </div>;
}
