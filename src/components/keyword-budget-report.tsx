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
 return <section className="mp-report-section mp-keywords" aria-label="키워드별 광고비 검토"><span className="mp-eyebrow">KEYWORD COST CHECK</span><h3>03. 메인 키워드에 바로 광고해도 될까요?</h3>
 {!category||!main?<AutomaticKeywordDiscovery productName={productName}/>:<>
 <p className="mp-keyword-source">품목 ‘{productName}’ → {keyword} 관련 키워드 자동 분석</p>
 <p className="mp-keyword-source">리큐엠 쇼핑검색 관련 광고그룹 실적 · 2026.10.01–10.31 · 11월 3일 확인</p>
 <div className="mp-keyword-main"><div><span>품목에서 자동으로 찾은 메인 키워드</span><h4>{keyword}</h4><span>관련 그룹 평균 CPC · VAT 포함 · {main.device}</span><strong>{money(main.cpc)}<small> / 클릭</small></strong></div><div><label>구매전환율 가정<FormattedNumberInput aria-label="키워드 구매전환율 가정" value={cvr} onValueChange={setCvr}/> %</label><p>예측값이 아닙니다. 실제 구매전환율로 바꾸세요.</p><b>{economy(main)?`판매 1건당 예상 광고비 ${money(economy(main)!.cpa)}`:'0보다 크고 100 이하인 전환율을 입력하세요.'}</b><p>내 상품의 1건당 광고비 한도 {money(perOrder)}</p>{economy(main)?.requiredCvr!==null&&economy(main)&&<p>이 CPC로 본전을 내려면 구매전환율 {economy(main)!.requiredCvr!.toFixed(2)}% 이상 필요</p>}</div></div>
 {economy(main)&&<p className={`mp-keyword-verdict ${economy(main)!.affordable?'':'is-over'}`}>{economy(main)!.affordable?'이 전환율 가정에서는 메인 키워드 CPC가 광고비 한도 이내입니다. 실제 성과를 소액으로 검증하세요.':`이 전환율 가정에서는 메인 키워드가 비효율적입니다. 판매 1건당 광고비가 한도보다 ${money(-economy(main)!.contribution)} 높습니다. 아래 후보부터 검토하세요.`}</p>}
 <h4 className="mp-keyword-subtitle">세분화 키워드 검토 순서 TOP 3</h4><p className="mp-keyword-source">관측 CPC가 낮은 순서입니다. 상품과 맞는 기능·용량·호환 기기에 해당할 때만 사용하세요. 추천 순서는 광고 노출 순위가 아닙니다.</p>
 <ol className="mp-keyword-candidates">{alternatives.map((row,i)=><li key={row.keyword}><span className="mp-keyword-order">{i+1}</span><div><h4>{row.keyword}</h4><p>관련 그룹 평균 CPC · {row.device} · 클릭 {row.clicks.toLocaleString()}회</p><strong>{money(row.cpc)}<small> / 클릭</small></strong><p>{row.cpc<main.cpc?`메인 관련 그룹보다 ${Math.round((1-row.cpc/main.cpc)*100)}% 낮은 관측 CPC`:'메인 관련 그룹보다 CPC가 높습니다.'}</p>{economy(row)&&<p className={economy(row)!.affordable?'mp-keyword-good':'mp-keyword-over'}>판매 1건당 광고비 {money(economy(row)!.cpa)} · {economy(row)!.affordable?'한도 이내':'한도 초과'}</p>}</div></li>)}</ol>{alternatives.length>0&&alternatives.every(row=>economy(row)&&!economy(row)!.affordable)&&<p className="mp-keyword-verdict is-over">세분화 후보 3개도 현재 전환율 가정에서는 모두 광고비 한도를 넘습니다. 순위를 높이기 전에 상품 가격·비용과 상세페이지 전환율을 먼저 개선하세요.</p>}
 <p className="mp-keyword-source">관련 광고그룹 전체의 평균으로, 해당 검색어만의 CPC가 아닙니다. 메인·세분화 그룹의 기기 및 노출 조건이 달라 비용 차이가 키워드 효과만을 뜻하지 않습니다. 전환율을 동일하게 놓은 비교이며 저렴한 클릭이 수익을 보장하지 않습니다.</p>
 <section className="mp-shopping-reference" aria-label="쇼핑검색광고 예상 입찰가"><h4>쇼핑검색광고 1·2·3위 예상 입찰가</h4><p>{category.rankProduct} 소재 · {category.rankDevice==='PC'?'PC 통합검색':'모바일 검색'} · 2026.11.03 조회 · VAT 미포함</p><div className="mp-rank-reference">{category.shoppingRanks.map((bid,i)=><div key={i}><span>{i+1}위 평균 입찰가</span><strong>{money(bid)}</strong></div>)}</div><p>소재 전체의 순위별 견적입니다. 위 세분화 키워드 각각의 1위 가격이나 현재 결제 CPC로 해석하지 마세요. 광고 입찰 설정은 변경하지 않았습니다.</p></section>

 </>}
 </section>;
}
