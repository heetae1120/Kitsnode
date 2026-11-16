"use client";
import {useId,useState,type CSSProperties} from 'react';
import {reorderTimeline} from '@/lib/reorder-timeline';
export function ReorderTimeline({quantity,months}:{quantity:number;months:number}){
 const [lead,setLead]=useState('14');const id=useId();
 const plan=lead.trim()!==''?reorderTimeline(quantity,months,Number(lead)):null;
 const n=(value:number)=>value.toLocaleString('ko-KR',{maximumFractionDigits:2});
 return <section className="mp-reorder" aria-labelledby={`${id}-title`}>
  <div className="mp-reorder-heading"><div><span>다음 물건 준비하기</span><h2 id={`${id}-title`}>재고가 끊기기 전, 미리 주문하세요.</h2></div><label htmlFor={`${id}-lead`}>주문한 물건이 도착하는 데 <span><input id={`${id}-lead`} type="number" min="0" max="3650" step="1" value={lead} onChange={event=>setLead(event.target.value)}/>일</span></label></div>
  {plan?<>
   <div className="ds-reorder-answer"><p>{quantity.toLocaleString('ko-KR')}개를 {months}개월에 걸쳐 같은 속도로 판다는 가정이에요.</p><h3>{plan.recommendedDay===0?'지금 바로':<>판매 시작 <strong>{n(plan.recommendedDay)}일째</strong>에</>} 재발주를 권장해요.</h3><p>늦어도 <b>{plan.reorderDay===0?'지금':`${n(plan.reorderDay)}일째`}</b>까지 주문해야, 계산상 재고가 소진되기 전에 도착해요.</p></div>
   <div className="ds-stock-timeline" role="img" aria-label={`재발주 권장 ${plan.recommendedDay}일째, 주문 마감 ${plan.reorderDay}일째, 재고 소진 ${plan.durationDays}일째. 마감 이후 주문하면 재고가 끊길 위험이 있어요.`} style={{'--deadline':`${plan.reorderDay/plan.durationDays*100}%`,'--recommended':`${plan.recommendedDay/plan.durationDays*100}%`} as CSSProperties}>
    <div className="ds-stock-callouts"><div><span>여유 있게 주문</span><strong>{plan.recommendedDay===0?'지금':`${n(plan.recommendedDay)}일째`}</strong><small>권장 재발주</small></div><div><span>늦어도 이때까지</span><strong>{plan.reorderDay===0?'지금':`${n(plan.reorderDay)}일째`}</strong><small>주문 마감</small></div></div>
    <div className="ds-stock-bar"><span className="ds-stock-safe" style={{flexBasis:`${plan.reorderDay/plan.durationDays*100}%`}}>{plan.reorderDay/plan.durationDays>.25?'안전구간':''}</span><span className="ds-stock-risk">{plan.reorderDay/plan.durationDays<.85?'위험구간':''}</span><i className="ds-stock-recommended" title="권장 재발주"/><i className="ds-stock-deadline" title="주문 마감"/></div>
    <div className="ds-stock-axis"><span>판매 시작 · 0일</span><span>{n(plan.durationDays)}일 · 재고 소진</span></div>
    <div className="ds-stock-legend"><span><i/>안전구간 · 마감 전에 주문</span><span><i/>위험구간 · 입고 전 품절 가능</span></div>
   </div>
   {plan.reorderDay===0&&<p className="mp-reorder-warning" role="status">주문을 미룰 수 있는 안전구간이 없어요. 지금 재발주와 입고 일정을 확인하세요.</p>}
   {plan.lateDays>0&&<p className="mp-reorder-warning" role="status">입고 소요일이 판매 목표 기간보다 {n(plan.lateDays)}일 길어요. 지금 주문해도 계산상 재고 소진보다 늦게 도착해요.</p>}
   <div className="mp-reorder-metrics"><div><span>하루 판매 목표</span><b>{n(plan.dailySales)}개</b></div><div><span>한 달 판매 목표</span><b>{n(plan.monthlySales)}개</b></div><div><span>주문 마감 때 남는 재고</span><b>약 {n(plan.stockAtReorder)}개</b></div></div>
   <details className="mp-story-details"><summary>재발주 날짜는 어떻게 계산하나요?</summary><p>주문 마감 = 판매 목표 기간 {plan.durationDays}일 − 입고 {lead}일. 권장일은 마감보다 최대 {Math.min(plan.bufferDays,plan.reorderDay)}일 앞당긴 계획이에요.</p><p>여유 기간은 입고 소요일의 25%를 올림하되 최대 7일로 잡은 가정입니다. 실제 공급처 일정과 판매 속도에 맞춰 조정하세요.</p></details>
   <details className="mp-story-details"><summary>월별 판매·재고 계획 보기</summary><table className="mp-reorder-table"><caption>균등 판매를 가정한 월말 재고 계획</caption><thead><tr><th scope="col">기간</th><th scope="col">월 판매 목표</th><th scope="col">누적 판매</th><th scope="col">남은 재고</th></tr></thead><tbody>{Array.from({length:months},(_,i)=><tr key={i}><th scope="row">{i+1}개월</th><td>{n(plan.monthlySales)}개</td><td>{n(plan.monthlySales*(i+1))}개</td><td>{n(Math.max(0,quantity-plan.monthlySales*(i+1)))}개</td></tr>)}</tbody></table></details>
  </>:<p role="status">입고 소요일을 0~3,650일의 정수로 입력하세요.</p>}
  <p className="mp-reorder-note">1개월=30일·균등 판매 기준의 계획입니다. 초록색도 실제 재고 안전을 보장하지 않으며, 판매량·입고 지연을 예측하지 않습니다.</p>
 </section>;
}
