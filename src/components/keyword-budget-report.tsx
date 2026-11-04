"use client";
import {useState} from 'react';
import {keywordEconomics,inferProductCategory,type KeywordBenchmark} from '@/lib/keyword-budget';
import {AutomaticKeywordDiscovery} from './automatic-keyword-discovery';
import {FormattedNumberInput} from './formatted-number-input';
const money=(v:number)=>`${Math.round(v).toLocaleString('ko-KR')}원`;
export function KeywordBudgetReport({productName,perOrder,budget}:{productName:string;perOrder:number;budget:number}){
 const category=inferProductCategory(productName);
 const keyword=category?.main.keyword||productName;
 const [cvr,setCvr]=useState('2');
 const main=category?.main??null;
 const alternatives=category?[category.main,...category.alternatives].filter(k=>k!==main).sort((a,b)=>a.cpc-b.cpc).slice(0,3):[];
 const economy=(row:KeywordBenchmark)=>keywordEconomics(row.cpc,Number(cvr),perOrder,budget);
 return <section className="mp-report-section mp-keywords" aria-label="키워드별 광고비 검토"><span className="mp-eyebrow">KEYWORD COST CHECK</span><h3>검색어와 클릭 비용</h3>
 {!category||!main?<AutomaticKeywordDiscovery productName={productName} perOrder={perOrder} budget={budget}/>:<>
 <p className="mp-keyword-source">품목 ‘{productName}’ → {keyword} 관련 검색어</p>
 <p className="mp-keyword-source">리큐엠 쇼핑검색 관련 광고 기록 · 2026.10.01–10.31 · 11월 3일 확인</p>
 <div className="mp-keyword-main"><div><span>대표 검색어</span><h4>{keyword}</h4><span>관련 광고의 평균 클릭 비용 · 세금 포함 · {main.device}</span><strong>{money(main.cpc)}<small> / 클릭</small></strong></div><div><section className="mp-story-details mp-conversion"><h4>한 건 팔 때 광고비는?</h4><label>클릭 후 구매 비율<FormattedNumberInput aria-label="키워드 클릭 후 구매 비율" value={cvr} onValueChange={setCvr}/> %</label><p>실제 비율을 알면 바꿔주세요. 기본값은 예시예요.</p><b className={economy(main)&&!economy(main)!.affordable?"mp-budget-over":undefined}>{economy(main)?`한 건 팔 때 예상 광고비 ${money(economy(main)!.cpa)}`:'구매 비율을 0% 초과~100%로 입력하세요.'}</b><p>한 건당 광고비 한도 {money(perOrder)}</p>{economy(main)?.requiredCvr!==null&&economy(main)&&<p>본전을 내려면 구매 비율 {economy(main)!.requiredCvr!.toFixed(2)}% 이상이어야 해요.</p>}</section></div></div>
 {economy(main)&&<p className={`mp-keyword-verdict ${economy(main)!.affordable?'':'is-over'}`}>구매 비율 {cvr}% 가정 · {economy(main)!.affordable?'이 비율이면 한도 안이에요. 적은 돈으로 확인하세요.':`이 비율이면 한 건당 광고비가 한도보다 ${money(-economy(main)!.contribution)} 많아요. 다른 검색어도 보세요.`}</p>}
 <h4 className="mp-keyword-subtitle">함께 볼 검색어 3개</h4><p className="mp-keyword-source">기록된 클릭 비용이 낮은 순서예요. 내 상품에 맞는 것만 고르세요. 광고 순위는 아니에요.</p>
 <ol className="mp-keyword-candidates">{alternatives.map((row,i)=><li key={row.keyword}><span className="mp-keyword-order">{i+1}</span><div><h4>{row.keyword}</h4><p>관련 광고 평균 클릭 비용 · {row.device} · 클릭 {row.clicks.toLocaleString()}회</p><strong>{money(row.cpc)}<small> / 클릭</small></strong><p>{row.cpc<main.cpc?`대표 광고보다 ${Math.round((1-row.cpc/main.cpc)*100)}% 낮은 클릭 비용`:'대표 광고보다 클릭 비용이 높아요.'}</p>{economy(row)&&<p className={economy(row)!.affordable?'mp-keyword-good':'mp-keyword-over'}>구매 비율 {cvr}% 가정 · 한 건당 광고비 {money(economy(row)!.cpa)} · {economy(row)!.affordable?'한도 이내':'한도 초과'}</p>}</div></li>)}</ol>{alternatives.length>0&&alternatives.every(row=>economy(row)&&!economy(row)!.affordable)&&<p className="mp-keyword-verdict is-over">이 비율이면 후보 3개도 한도를 넘어요. 가격·비용·구매 비율을 먼저 확인하세요.</p>}
 <p className="mp-keyword-source">관련 광고 전체의 평균이에요. 검색어만의 가격은 아니며, 기기와 노출 조건도 달라요. 싼 클릭이 이익을 보장하지는 않아요.</p>
 <details className="mp-shopping-reference"><summary>쇼핑광고 1·2·3위 예상 가격</summary><h4>쇼핑광고 예상 입찰가</h4><p>{category.rankProduct} 소재 · {category.rankDevice==='PC'?'PC 통합검색':'모바일 검색'} · 2026.11.03 조회 · 세금 별도</p><div className="mp-rank-reference">{category.shoppingRanks.map((bid,i)=><div key={i}><span>{i+1}위 평균 입찰가</span><strong>{money(bid)}</strong></div>)}</div><p>광고 소재 전체의 예상 가격이에요. 검색어별 가격이나 실제 클릭 비용과 달라요. 입찰을 바꾸지는 않아요.</p></details>

 </>}
 </section>;
}
