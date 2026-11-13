"use client";
import {useEffect,useState} from 'react';
import {keywordEconomics,inferProductCategory,type KeywordBenchmark} from '@/lib/keyword-budget';
import {AutomaticKeywordDiscovery} from './automatic-keyword-discovery';
import {KeywordGoalCheck} from './keyword-goal-check';
import {breakEvenConversion,type GoalBudgetContext} from '@/lib/keyword-goal';
import {rowVolume,validateKeywordResponse,type KeywordRow,type Device} from '@/lib/naver-keywords';
import {ShoppingAdPodium} from './shopping-ad-podium';
import {FormattedNumberInput} from './formatted-number-input';
const money=(v:number)=>`${Math.round(v).toLocaleString('ko-KR')}원`;
export function KeywordBudgetReport({productName,perOrder,budget,quantity,months,budgetContext}:{productName:string;perOrder:number;budget:number;quantity:number;months:number;budgetContext?:GoalBudgetContext}){
 const category=inferProductCategory(productName);
 const keyword=category?.main.keyword||productName;
 const [cvr,setCvr]=useState('');
 const [volumes,setVolumes]=useState<KeywordRow[]>([]);
 const [volumeError,setVolumeError]=useState('');
 const seeds=category?[category.main,...category.alternatives.slice().sort((a,b)=>a.cpc-b.cpc).slice(0,3)].map(r=>r.keyword).join(','):'';
 useEffect(()=>{
  setVolumes([]);setVolumeError('');if(!seeds)return;
  const controller=new AbortController();let active=true;const timeout=setTimeout(()=>controller.abort(),15000);
  void(async()=>{try{const url=new URL(process.env.NEXT_PUBLIC_KEYWORD_API_URL||'https://kitsnode.vercel.app/api/keywords');url.searchParams.set('keywords',seeds);const response=await fetch(url,{signal:controller.signal,credentials:'omit',cache:'no-store'});if(!response.ok)throw Error();const data=validateKeywordResponse(await response.json());if(active)setVolumes(data.keywords);}catch{if(active)setVolumeError('검색량을 불러오지 못했어요. 목표 기간은 아직 판단할 수 없어요.');}finally{clearTimeout(timeout);}})();
  return()=>{active=false;controller.abort();clearTimeout(timeout);};
 },[seeds]);
 const main=category?.main??null;
 const alternatives=category?[category.main,...category.alternatives].filter(k=>k!==main).sort((a,b)=>a.cpc-b.cpc).slice(0,3):[];
 const neededCvr=main?breakEvenConversion(main.cpc,perOrder):null;
 const scenario=cvr===''?(neededCvr!==null&&neededCvr<=100?Math.ceil(neededCvr*100)/100:0):Number(cvr);
 const conversion=<div className="mp-conversion-input"><label>구매 비율<div><FormattedNumberInput aria-label="키워드 클릭 후 구매 비율" value={cvr===''&&scenario>0?String(scenario):cvr} onValueChange={setCvr}/><span>%</span></div></label><small>본전 기준 {neededCvr===null?'계산 불가':(Math.ceil(neededCvr*100)/100).toLocaleString('ko-KR')+'% 이상'}</small></div>;
 const goal=(row:KeywordBenchmark,compact=false)=>{const volume=volumes.find(v=>v.keyword.replace(/\s/g,'')===row.keyword.replace(/\s/g,''));const device:Device=row.device==='PC'?'pc':row.device==='모바일'?'mobile':'all';return <KeywordGoalCheck conversion={!compact?conversion:undefined} primary={!compact} compact={compact} budgetContext={budgetContext} cpc={row.cpc} perOrder={perOrder} budget={budget} quantity={quantity} months={months} cvr={scenario} volume={volume?rowVolume(volume,device):null} device={device==='all'?'PC+모바일':row.device}/>;};
 const economy=(row:KeywordBenchmark)=>keywordEconomics(row.cpc,scenario,perOrder,budget);
 return <section className="mp-report-section mp-keywords" aria-label="키워드별 광고비 검토"><span className="mp-eyebrow">KEYWORD COST CHECK</span><h3>검색어와 클릭 비용</h3>
 {!category||!main?<AutomaticKeywordDiscovery budgetContext={budgetContext} productName={productName} perOrder={perOrder} budget={budget} quantity={quantity} months={months}/>:<>
 <p className="mp-keyword-source">품목 ‘{productName}’ → {keyword} 관련 검색어</p>
 <p className="mp-keyword-source">쇼핑검색 관련 광고 기록 · 2026.10.01–10.31 · 11월 3일 확인</p>
 <div className="mp-keyword-main"><div><span>대표 검색어</span><h4>{keyword}</h4><span>관련 광고의 평균 클릭 비용 · 세금 포함 · {main.device}</span><strong>{money(main.cpc)}<small> / 클릭</small></strong></div></div>
 <ShoppingAdPodium keyword={productName}/>
 {economy(main)&&<p className={`mp-keyword-verdict ${economy(main)!.affordable?'':'is-over'}`}>구매 비율 {scenario.toLocaleString('ko-KR',{maximumFractionDigits:2})}% 가정 · {economy(main)!.affordable?'이 비율이면 한도 안이에요. 적은 금액으로 확인하세요.':`이 비율이면 한 건당 광고비가 한도보다 ${money(-economy(main)!.contribution)} 많아요. 다른 검색어도 보세요.`}</p>}
 {volumeError&&<p role="status">{volumeError}</p>}{goal(main)}
 <h4 className="mp-keyword-subtitle">함께 볼 검색어 3개</h4><p className="mp-keyword-source">기록된 클릭 비용이 낮은 순서예요. 내 상품에 맞는 것만 고르세요. 광고 순위는 아니에요.</p>
 <ol className="mp-keyword-candidates mp-candidates-concise">{alternatives.map((row,i)=>{const result=economy(row);return <li key={row.keyword}><span className="mp-keyword-order">{i+1}</span><h4>{row.keyword}</h4><p className="mp-candidate-source">관련 광고 평균 · {row.device}</p><div className="mp-candidate-price"><span>클릭 비용</span><strong>{money(row.cpc)}</strong></div><div className="mp-candidate-cpa"><span>구매 1건 예상 광고비</span><b>{result?money(result.cpa):'구매 비율 입력 필요'}</b></div>{goal(row,true)}</li>;})}</ol><p className="mp-candidate-assumption">구매 비율 {scenario.toLocaleString('ko-KR',{maximumFractionDigits:2})}% · {months}개월 · {quantity.toLocaleString('ko-KR')}개 목표 기준. 판매 상한은 계산값이며 실제 판매를 보장하지 않아요.</p>{alternatives.length>0&&alternatives.every(row=>economy(row)&&!economy(row)!.affordable)&&<p className="mp-keyword-verdict is-over">이 비율이면 후보 3개도 한도를 넘어요. 가격·비용·구매 비율을 먼저 확인하세요.</p>}
 <p className="mp-keyword-source">관련 광고 전체의 평균이에요. 검색어만의 가격은 아니며, 기기와 노출 조건도 달라요. 싼 클릭이 이익을 보장하지는 않아요.</p>
 <details className="mp-shopping-reference"><summary>쇼핑광고 1·2·3위 예상 가격</summary><h4>쇼핑광고 예상 입찰가</h4><p>{category.rankProduct} 소재 · {category.rankDevice==='PC'?'PC 통합검색':'모바일 검색'} · 2026.11.03 조회 · 세금 별도</p><div className="mp-rank-reference">{category.shoppingRanks.map((bid,i)=><div key={i}><span>{i+1}위 평균 입찰가</span><strong>{money(bid)}</strong></div>)}</div><p>광고 소재 전체의 예상 가격이에요. 검색어별 가격이나 실제 클릭 비용과 달라요. 입찰을 바꾸지는 않아요.</p></details>

 </>}
 </section>;
}
