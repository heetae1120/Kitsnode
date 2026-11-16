"use client";
import InkOrbitFeatures from './ui/ink-orbit-features';
import {useId,useState} from 'react';
import {reorderTimeline} from '@/lib/reorder-timeline';
export function ReorderTimeline({quantity,months}:{quantity:number;months:number}){
 const [lead,setLead]=useState('14');const [progress,setProgress]=useState(50);const id=useId();const plan=lead.trim()!==''?reorderTimeline(quantity,months,Number(lead)):null;
 const n=(value:number)=>value.toLocaleString('ko-KR',{maximumFractionDigits:2});

 const selectedDay=plan?Math.round(plan.durationDays*progress/100):0;
 const selectedSold=plan?Math.min(quantity,plan.dailySales*selectedDay):0;

 return <section className="mp-reorder" aria-labelledby={`${id}-title`}>
  <div className="mp-reorder-heading"><div><span>다음 물건 준비하기</span><h2 id={`${id}-title`}>물건이 다 팔리기 전, 언제 주문할까요?</h2></div><label htmlFor={`${id}-lead`}>주문한 물건이 도착하는 데 <span><input id={`${id}-lead`} type="number" min="0" max="3650" step="1" value={lead} onChange={event=>setLead(event.target.value)}/>일</span></label></div>
  {plan?<><div className="ds-reorder-answer"><p>{quantity.toLocaleString('ko-KR')}개를 {months}개월에 걸쳐 같은 속도로 판다면</p><h3>{plan.reorderDay===0?'지금 바로':<>판매 시작 <strong>{n(plan.reorderDay)}일째</strong>에</>} 다음 물건을 주문하세요.</h3><p>그때 약 <b>{n(plan.stockAtReorder)}개</b>가 남고, 새 물건은 <b>{n(plan.reorderDay+Number(lead))}일째</b> 도착하는 계획이에요.</p></div><InkOrbitFeatures days={plan.durationDays} quantity={quantity} reorder={plan.reorderDay} day={selectedDay} onDay={d=>setProgress(d/plan.durationDays*100)}/>
   <div role="status" className="kn-reorder-status">{selectedDay > plan.reorderDay && <strong><i aria-hidden="true" />주문하기에 너무 늦어요. 권장 주문일보다 {selectedDay - plan.reorderDay}일 지났어요.</strong>}</div>
   <div className="mp-reorder-legend"><span>━ 아직 안 팔린 물건</span><span>┄ 지금까지 팔린 물건</span><span>■ 새 물건을 기다리는 기간</span></div><label className="mp-reorder-explore" htmlFor={`${id}-day`}>날짜를 움직여 남은 물건을 확인하세요 · {selectedDay}일째<input id={`${id}-day`} type="range" min="0" max={plan.durationDays} value={selectedDay} onChange={event=>setProgress(Number(event.target.value)/plan.durationDays*100)}/></label><details className="ds-reorder-details"><summary>하루·한 달 판매량과 자세한 숫자 보기</summary><div className="mp-reorder-metric-grid"><div className="mp-reorder-metrics"><div><span>선택 시점까지 판매</span><b>약 {n(selectedSold)}개</b></div><div><span>선택 시점의 재고</span><b>약 {n(quantity-selectedSold)}개</b></div><div><span>하루 판매 목표</span><b>{n(plan.dailySales)}개</b></div></div><div className="mp-reorder-metrics" aria-live="polite"><div><span>월 판매 목표</span><b>{n(plan.monthlySales)}개</b></div><div><span>재발주 시점</span><b>{plan.reorderDay===0?'지금 발주':`시작 후 ${n(plan.reorderDay)}일째`}</b></div><div><span>재발주 시 남은 재고</span><b>약 {n(plan.stockAtReorder)}개</b></div></div></div></details><p className="mp-reorder-note">재발주 {plan.reorderDay}일째 → 입고 예정 {plan.reorderDay+Number(lead)}일째 · 현재 재고 소진 {plan.durationDays}일째</p><details className="mp-story-details"><summary>월별 판매·재고 계획 보기</summary><table className="mp-reorder-table"><caption>균등 판매를 가정한 월말 재고 계획</caption><thead><tr><th scope="col">기간</th><th scope="col">월 판매 목표</th><th scope="col">누적 판매</th><th scope="col">남은 재고</th></tr></thead><tbody>{Array.from({length:months},(_,i)=><tr key={i}><th scope="row">{i+1}개월</th><td>{n(plan.monthlySales)}개</td><td>{n(plan.monthlySales*(i+1))}개</td><td>{n(Math.max(0,quantity-plan.monthlySales*(i+1)))}개</td></tr>)}</tbody></table></details>{plan.lateDays>0&&<p className="mp-reorder-warning" role="status">입고 소요일이 목표 기간보다 {n(plan.lateDays)}일 길어요. 지금 발주해도 재고 소진 전 입고가 어려워요.</p>}</>:<p role="status">입고 소요일을 0~3,650일의 정수로 입력하세요.</p>}
  <p className="mp-reorder-note">입고 {lead||'—'}일은 조정 가능한 가정이에요. 1개월=30일·균등 판매·안전재고 0개 기준이며, 실제 판매나 입고를 예측하지 않아요.</p>
 </section>;
}
