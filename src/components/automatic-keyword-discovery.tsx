"use client";
import {useEffect,useState} from 'react';
import {formatRange,rowVolume,validateKeywordResponse,type KeywordRow} from '@/lib/naver-keywords';
import {productKeywordSeed,selectProductKeywords} from '@/lib/product-keywords';
import {shoppingVolumeReferences,calibrateShoppingVolume,estimateShoppingVolume} from '@/lib/shopping-volume-estimate';
import {keywordEconomics} from '@/lib/keyword-budget';
import {KeywordGoalCheck} from './keyword-goal-check';
import {breakEvenConversion} from '@/lib/keyword-goal';
import {ShoppingAdPodium} from './shopping-ad-podium';
import {FormattedNumberInput} from './formatted-number-input';
const money=(v:number)=>`${Math.round(v).toLocaleString('ko-KR')}원`;
const estimateMoney=(v:number)=>v<10?'10원 미만':money(Math.round(v/10)*10);
export function AutomaticKeywordDiscovery({productName,perOrder,budget,quantity,months}:{productName:string;perOrder:number;budget:number;quantity:number;months:number}){
 const [rows,setRows]=useState<KeywordRow[]>([]);const [sourceRows,setSourceRows]=useState<KeywordRow[]>([]);
 const [busy,setBusy]=useState(true);const [error,setError]=useState('');const [retry,setRetry]=useState(0);const [cvr,setCvr]=useState('');
 useEffect(()=>{
  const controller=new AbortController();let active=true;
  const timeout=setTimeout(()=>{controller.abort();if(active){setBusy(false);setError('키워드 분석 시간이 초과되었습니다. 다시 분석해 주세요.');}},15000);
  setBusy(true);setError('');setRows([]);setSourceRows([]);
  void (async()=>{try{
   const endpoint=process.env.NEXT_PUBLIC_KEYWORD_API_URL||'https://kitsnode.vercel.app/api/keywords';
   const seed=productKeywordSeed(productName);const url=new URL(endpoint);
   url.searchParams.set('keywords',[...new Set([seed,...shoppingVolumeReferences.map(row=>row.keyword)])].join(','));
   const response=await fetch(url,{signal:controller.signal,credentials:'omit',cache:'no-store'});const raw=await response.json();
   if(!response.ok)throw Error(raw.error||'연관 키워드를 불러오지 못했습니다.');
   const data=validateKeywordResponse(raw);const found=selectProductKeywords(seed,data.keywords);
   if(!found.length)throw Error('이 품목의 관련 키워드를 찾지 못했습니다. 상품 종류가 포함되도록 품목명을 수정해 주세요.');
   if(active){setRows(found);setSourceRows(data.keywords);}
  }catch(e){if(active&&!controller.signal.aborted)setError(e instanceof Error?e.message:'키워드 분석 실패');}
  finally{clearTimeout(timeout);if(active)setBusy(false);}})();
  return()=>{active=false;controller.abort();clearTimeout(timeout);};
 },[productName,retry]);
 const main=rows[0];const calibration=calibrateShoppingVolume(sourceRows);
 const estimate=(row:KeywordRow)=>estimateShoppingVolume(row,calibration);
 const mainEstimate=main?estimate(main):null;
 const neededCvr=mainEstimate?breakEvenConversion(mainEstimate.bids[0]*1.1,perOrder):null;
 const scenario=cvr===''?(neededCvr!==null&&neededCvr<=100?Math.ceil(neededCvr*100)/100:0):Number(cvr);
 const alternatives=rows.slice(1).sort((a,b)=>(estimate(a)?.bids[0]??Infinity)-(estimate(b)?.bids[0]??Infinity));
 const economics=(row:KeywordRow)=>{const result=estimate(row);return result?keywordEconomics(result.bids[0]*1.1,scenario,perOrder,budget):null;};
 return <div><p className="mp-keyword-source">품목 ‘{productName}’의 검색량을 리큐엠 두 상품과 비교해 쇼핑광고 가격을 추정해요.</p>
 <button type="button" className="mp-secondary" disabled={busy} onClick={()=>setRetry(v=>v+1)}>{busy?'검색어 찾는 중…':'다시 찾기'}</button>
 {error&&<p role="alert" className="mp-error">{error}</p>}
 {main&&<><div className="mp-keyword-main"><div><span>대표 검색어</span><h4>{main.keyword}</h4><p>한 달 검색량 {formatRange(rowVolume(main,'all'))}회 · PC+모바일</p><p>계산에 쓴 PC 검색량 {formatRange(rowVolume(main,'pc'))}회</p></div><div><span className="mp-estimate-badge">리큐엠 자료로 추정 · PC</span><strong>{mainEstimate?estimateMoney(mainEstimate.bids[0]):'검색량 자료 부족'}</strong><p>쇼핑광고 1위 추정 가격 · 세금 별도</p>{mainEstimate&&<p>기준 PC 검색량의 {mainEstimate.ratio.toLocaleString('ko-KR',{maximumFractionDigits:2})}배</p>}</div></div>
 {mainEstimate&&<><div className="mp-rank-reference mp-volume-ranks">{mainEstimate.bids.map((bid,i)=><div key={i}><span>{i+1}위 추정 입찰가</span><strong>{estimateMoney(bid)}</strong><small>두 상품으로 계산한 범위<br/>{estimateMoney(mainEstimate.ranges[i].min)}–{estimateMoney(mainEstimate.ranges[i].max)}</small></div>)}</div><ShoppingAdPodium keyword={main.keyword}/><section className="mp-story-details mp-conversion"><h4>본전을 내려면 구매 비율이 얼마여야 할까요?</h4><p className="mp-bep-rate"><b>{neededCvr===null?'현재 이익으로 본전 불가':`${(Math.ceil(neededCvr*100)/100).toLocaleString('ko-KR')}% 이상`}</b>{neededCvr!==null&&neededCvr>100&&' · 100%를 넘어 불가능해요. 클릭 비용을 낮춰야 해요.'}</p><div className="mp-keyword-main"><div><label>계산할 구매 비율<FormattedNumberInput aria-label="환산 추정 클릭 후 구매 비율" value={cvr===''&&scenario>0?String(scenario):cvr} onValueChange={setCvr}/> %</label><p>처음에는 대표 검색어의 본전 비율로 계산해요. 실제 비율을 알면 바꾸세요.</p></div><div><b>한 건당 광고비 한도 {money(perOrder)}</b>{economics(main)&&<p className={economics(main)!.affordable?undefined:"mp-budget-over"}>1위 추정 가격에 세금을 더해 계산한 한 건당 광고비 {money(economics(main)!.cpa)} · {economics(main)!.affordable?'한도 이내':'한도 초과'}</p>}</div></div></section></>}
 {mainEstimate&&<KeywordGoalCheck cpc={mainEstimate.bids[0]*1.1} perOrder={perOrder} budget={budget} quantity={quantity} months={months} cvr={scenario} volume={rowVolume(main,'pc')} device="PC"/>}
 {!mainEstimate&&<p className="mp-keyword-source">내 품목과 기준 두 상품의 정확한 PC 검색량이 필요해요. 자료가 없으면 가격을 만들지 않아요.</p>}
 <h4>함께 볼 검색어</h4><p className="mp-keyword-source">후보 3개 중 1위 추정 가격이 낮은 순서예요. 내 상품에 맞는지 확인하세요.</p>
 <ol className="mp-keyword-candidates">{alternatives.map((row,i)=><li key={row.keyword}><span className="mp-keyword-order">{i+1}</span><div><h4>{row.keyword}</h4><p>월간 PC 검색량 {formatRange(rowVolume(row,'pc'))}회</p><strong>{estimate(row)?estimateMoney(estimate(row)!.bids[0]):'자료 부족'}</strong><p>1위 추정 가격 · 세금 별도</p>{economics(row)&&<p className={economics(row)!.affordable?'mp-keyword-good':'mp-keyword-over'}>구매 비율 {scenario.toLocaleString('ko-KR',{maximumFractionDigits:2})}% 가정 · 판매 1건당 광고비 {money(economics(row)!.cpa)} · {economics(row)!.affordable?'한도 이내':'한도 초과'}</p>}{estimate(row)&&<KeywordGoalCheck cpc={estimate(row)!.bids[0]*1.1} perOrder={perOrder} budget={budget} quantity={quantity} months={months} cvr={scenario} volume={rowVolume(row,'pc')} device="PC"/>}</div></li>)}</ol>
 {!alternatives.length&&<p>이 품목의 세분화 키워드 자료가 없습니다.</p>}
 <details className="mp-story-details"><summary>1·2·3위 가격 비교</summary><div className="mp-keyword-table"><table><thead><tr><th>자동 분석 키워드</th><th>1위 추정 가격</th><th>2위 추정 가격</th><th>3위 추정 가격</th></tr></thead><tbody>{[main,...alternatives].map(row=><tr key={row.keyword}><th>{row.keyword}</th>{[0,1,2].map(position=><td key={position}>{estimate(row)?estimateMoney(estimate(row)!.bids[position]):'자료 부족'}</td>)}</tr>)}</tbody></table></div></details>

 <p className="mp-keyword-source">검색량에 비례해 계산한 참고 가격이에요. 실제 네이버 견적·클릭 비용·순위와 달라요. 두 상품의 계산 차이는 오차 범위를 뜻하지 않아요. 업종별 경쟁과 구매 비율은 반영하지 않았어요.</p></>}
 </div>;
}
