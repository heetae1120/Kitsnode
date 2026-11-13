"use client";
import {useContext,useEffect} from 'react';
import {ReportPriorityContext} from './report-priority-context';
import {keywordGoalDiagnostics,type GoalBudgetContext} from '@/lib/keyword-goal';
import {formatRange,type CountRange} from '@/lib/naver-keywords';
const n=(v:number)=>v.toLocaleString('ko-KR',{maximumFractionDigits:2});
const requiredPercent=(v:number)=>n(Math.ceil(v*100)/100);
const money=(v:number)=>`${Math.ceil(v).toLocaleString('ko-KR')}원`;
export function KeywordGoalCheck({cpc,perOrder,budget,quantity,months,cvr,volume,device,budgetContext,compact=false,primary=false}:{cpc:number;perOrder:number;budget:number;quantity:number;months:number;cvr:number;volume:CountRange|null;device:string;budgetContext?:GoalBudgetContext;compact?:boolean;primary?:boolean}){
 const diagnostic=keywordGoalDiagnostics({cpc,perOrder,budget,quantity,months,cvr,monthlySearches:volume?.max??null},budgetContext);
 const updatePriority=useContext(ReportPriorityContext);const diagnosticKey=JSON.stringify(diagnostic);
 useEffect(()=>{if(primary)updatePriority?.(JSON.parse(diagnosticKey));},[primary,updatePriority,diagnosticKey]);
 if(!diagnostic)return <p className="mp-keyword-over">구매 비율을 0% 초과~100%로 입력하면 목표를 계산해요.</p>;
 const g=diagnostic.goal;
 const title={loss:'이 조건으로 목표를 채우면 손해예요',both:'예산과 검색량 모두 부족해요',budget:'이 예산으로는 목표 수량이 부족해요',demand:'이 검색어 하나로는 수량이 부족해요',unknown:'검색량 확인이 더 필요해요',conditional:'계산 조건은 맞아요 · 실제 클릭 확인 필요'}[g.status];
 if(compact){
  const risky=g.loss||g.budgetShort||g.demandShort;
  const status=g.loss?'손실 위험':g.budgetShort&&g.demandShort?'예산·검색량 부족':g.budgetShort?'예산 부족':g.demandShort?'검색량 부족':g.status==='unknown'?'검색량 미확인':'계산상 가능';
  const maxOrders=Math.min(g.budgetOrders,g.demandOrders??g.budgetOrders);
  return <div className="mp-goal-compact"><span className={risky?'mp-compact-risk':g.status==='unknown'?'mp-compact-unknown':'mp-compact-good'}>{status}</span><dl><div><dt>판매 상한 · 계산상</dt><dd>{n(maxOrders)} / {n(quantity)}개</dd></div>{g.budgetShort&&<div><dt>부족한 광고비</dt><dd className="mp-compact-risk">{money(g.extraBudget)}</dd></div>}{g.loss&&<div><dt>목표 광고비 손실</dt><dd className="mp-compact-risk">{money(diagnostic.goalAdLoss)}</dd></div>}{g.demandShort&&<div><dt>부족한 클릭</dt><dd className="mp-compact-risk">{n(diagnostic.missingClicks??0)}회</dd></div>}</dl><details><summary>계산 자세히</summary><KeywordGoalCheck cpc={cpc} perOrder={perOrder} budget={budget} quantity={quantity} months={months} cvr={cvr} volume={volume} device={device} budgetContext={budgetContext}/></details></div>;
 }
 const maxOrders=Math.min(g.budgetOrders,g.demandOrders??g.budgetOrders);
 const reason=g.loss?(diagnostic.unitAdLoss>0?`건당 광고비가 이익 한도를 ${money(diagnostic.unitAdLoss)} 초과해요.`:`목표 광고비가 이익 한도를 ${money(diagnostic.goalAdLoss)} 초과해요.`):g.demandShort?`목표까지 클릭 ${n(diagnostic.missingClicks??0)}회가 부족해요.`:g.budgetShort?`목표까지 광고비 ${money(g.extraBudget)}가 부족해요.`:g.status==='unknown'?'검색량 자료가 없어 판매 가능 수량을 확인할 수 없어요.':'입력 조건상 가능해요. 실제 판매 결과는 달라질 수 있어요.';
 return <section className={`mp-goal-check ${g.status==='conditional'?'is-conditional':g.status==='unknown'?'is-short':'is-critical'}`} role={g.loss||g.budgetShort||g.demandShort?'alert':undefined} aria-label="판매 목표 점검"><b>{g.loss||g.budgetShort||g.demandShort?'⚠ ':''}{title}</b><p>{months}개월 · {n(quantity)}개 목표 · 구매 비율 {n(cvr)}% 가정</p><p className={g.loss||g.budgetShort||g.demandShort?'mp-compact-risk':undefined}>{reason}</p><dl className="mp-goal-summary"><div><dt>계산상 판매 가능</dt><dd>{n(maxOrders)} / {n(quantity)}개</dd></div><div><dt>필요 광고비</dt><dd>{money(g.neededBudget)}</dd></div><div><dt>마케팅비용 한도</dt><dd>{money(budget)}</dd></div></dl><details className="mp-story-details"><summary>계산 근거 보기</summary><dl><div><dt>필요 클릭</dt><dd>{n(g.neededClicks)}회</dd></div><div><dt>월 검색량 · {device}</dt><dd>{volume?formatRange(volume)+'회':'자료 없음'}</dd></div>{g.requiredShare!==null&&<div><dt>필요한 검색 대비 클릭 비율</dt><dd>{requiredPercent(g.requiredShare)}%</dd></div>}{g.requiredCvr!==null&&g.budgetShort&&<div><dt>예산 내 필요한 구매 비율</dt><dd>{requiredPercent(g.requiredCvr)}%{g.requiredCvr>100?' · 현재 조건으로 불가':''}</dd></div>}</dl><small>검색량 일정·검색 1회당 최대 클릭 1회 가정. 노출·판매를 보장하지 않으며, 검색어별 결과는 같은 예산으로 따로 계산해요.</small></details></section>;
}
