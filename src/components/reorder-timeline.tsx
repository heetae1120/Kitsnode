"use client";
import {useEffect,useId,useState} from 'react';
import {ReorderCalendar} from './reorder-calendar';
import {dateAfter} from '@/lib/reorder-calendar';
import {reorderTimeline} from '@/lib/reorder-timeline';
export type ReorderDates={start?:string;reorder?:string};

export function ReorderTimeline({quantity,months,dates,onDatesChange}:{quantity:number;months:number;dates:ReorderDates;onDatesChange:(dates:ReorderDates)=>void}){
 const lead=14;
 const id=useId();
 const plan=reorderTimeline(quantity,months,lead);
 const [today,setToday]=useState('');
 useEffect(()=>{const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());setToday(['year','month','day'].map(key=>parts.find(p=>p.type===key)?.value).join('-'));},[]);
 const start=dates.start??today;
 const reorder=dates.reorder??(plan?dateAfter(start,plan.recommendedDay):null)??'';
 const depletion=plan?dateAfter(start,plan.durationDays):null;
 const beforeStart=Boolean(start&&reorder&&reorder<start);
 const arrival=depletion&&!beforeStart?dateAfter(reorder,lead):null;
 const n=(value:number)=>value.toLocaleString('ko-KR',{maximumFractionDigits:2});
 return <section className="mp-reorder" aria-labelledby={`${id}-title`}>
  <div className="mp-reorder-heading"><div><span>다음 물건 준비하기</span><h2 id={`${id}-title`}>재고가 끊기기 전, 미리 주문하세요.</h2><p className="ds-reorder-lead">최소 2주 전에는 발주를 넣으셔야 해요.</p></div></div>
  {plan?<>
   <div className="ds-reorder-answer"><p>{quantity.toLocaleString('ko-KR')}개를 {months}개월에 걸쳐 같은 속도로 판다는 가정이에요.</p><h3>{plan.recommendedDay===0?'지금 바로':<>판매 시작 <strong>{n(plan.recommendedDay)}일째</strong>에</>} 재발주를 권장해요.</h3><p>늦어도 <b>{plan.reorderDay===0?'지금':`${n(plan.reorderDay)}일째`}</b>까지 주문해야, 계산상 재고가 소진되기 전에 도착해요.</p></div>
   <div className="ds-calendar-controls">
    <label className="ds-calendar-start">판매 시작일<input type="date" value={start} onChange={event=>onDatesChange({...dates,start:event.target.value})}/></label>
    <label className="ds-calendar-start">재발주일<input type="date" min={start||undefined} value={reorder} onChange={event=>onDatesChange({...dates,reorder:event.target.value})} aria-invalid={beforeStart} aria-describedby={`${id}-arrival`}/></label>
   </div>
   <p id={`${id}-arrival`} className="ds-reorder-arrival" aria-live="polite">
    {beforeStart?'재발주일은 판매 시작일 이후로 선택해 주세요.':arrival&&depletion?<>예상 입고일 <time dateTime={arrival}>{arrival}</time>{' · '}{arrival>depletion?'예상 재고 소진일 이후에 도착해요.':arrival===depletion?'예상 재고 소진일에 도착해요.':'예상 재고 소진일 전에 도착해요.'}</>:`재발주일에 입고 소요일 ${lead}일을 더해 예상 입고일을 계산해요.`}
   </p>
   <ReorderCalendar start={start} recommended={plan.recommendedDay} deadline={plan.reorderDay} duration={plan.durationDays}/>
   {plan.reorderDay===0&&<p className="mp-reorder-warning" role="status">주문을 미룰 수 있는 안전구간이 없어요. 지금 재발주와 입고 일정을 확인하세요.</p>}
   {plan.lateDays>0&&<p className="mp-reorder-warning" role="status">입고 소요일이 판매 목표 기간보다 {n(plan.lateDays)}일 길어요. 지금 주문해도 계산상 재고 소진보다 늦게 도착해요.</p>}
   <div className="mp-reorder-metrics"><div><span>하루 판매 목표</span><b>{n(plan.dailySales)}개</b></div><div><span>한 달 판매 목표</span><b>{n(plan.monthlySales)}개</b></div><div><span>주문 마감 때 남는 재고</span><b>약 {n(plan.stockAtReorder)}개</b></div></div>
   <details className="mp-story-details"><summary>재발주 날짜는 어떻게 계산하나요?</summary><p>주문 마감 = 판매 목표 기간 {plan.durationDays}일 − 입고 {lead}일. 권장일은 마감보다 최대 {Math.min(plan.bufferDays,plan.reorderDay)}일 앞당긴 계획이에요.</p><p>여유 기간은 입고 소요일의 25%를 올림하되 최대 7일로 잡은 가정입니다. 실제 공급처 일정과 판매 속도에 맞춰 조정하세요.</p></details>
   <details className="mp-story-details"><summary>월별 판매·재고 계획 보기</summary><table className="mp-reorder-table"><caption>균등 판매를 가정한 월말 재고 계획</caption><thead><tr><th scope="col">기간</th><th scope="col">월 판매 목표</th><th scope="col">누적 판매</th><th scope="col">남은 재고</th></tr></thead><tbody>{Array.from({length:months},(_,i)=><tr key={i}><th scope="row">{i+1}개월</th><td>{n(plan.monthlySales)}개</td><td>{n(plan.monthlySales*(i+1))}개</td><td>{n(Math.max(0,quantity-plan.monthlySales*(i+1)))}개</td></tr>)}</tbody></table></details>
  </>:<p role="status">판매 목표 기간을 확인해 주세요.</p>}
  <p className="mp-reorder-note">1개월=30일·균등 판매 기준의 계획입니다. 초록색도 실제 재고 안전을 보장하지 않으며, 판매량·입고 지연을 예측하지 않습니다.</p>
 </section>;
}
