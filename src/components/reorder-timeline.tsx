"use client";
import {useEffect,useId,useState} from 'react';
import {ReorderCalendar} from './reorder-calendar';
import {dateAfter} from '@/lib/reorder-calendar';
import {reorderSchedule,reorderTimeline} from '@/lib/reorder-timeline';
export type ReorderDates={start?:string;reorder?:string};

export function ReorderTimeline({quantity,months,dates,onDatesChange}:{quantity:number;months:number;dates:ReorderDates;onDatesChange:(dates:ReorderDates)=>void}){
 const lead=14;
 const id=useId();
 const plan=reorderTimeline(quantity,months,lead);
 const [today,setToday]=useState('');
 useEffect(()=>{const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());setToday(['year','month','day'].map(key=>parts.find(p=>p.type===key)?.value).join('-'));},[]);
 const start=dates.start??today;
 const reorder=dates.reorder??(plan?dateAfter(start,plan.recommendedDay):null)??'';
 const schedule=plan?reorderSchedule(plan,start,reorder,lead):null;
 const beforeStart=Boolean(schedule&&dateAfter(reorder,0)&&reorder<start);
 const invalidMessage=beforeStart?'재발주일은 판매 시작일과 같거나 그 이후여야 해요.':undefined;
 const statusId=`${id}-status`;
 const n=(value:number)=>value.toLocaleString('ko-KR',{maximumFractionDigits:2});
 return <section className="mp-reorder" aria-labelledby={`${id}-title`}>
  <div className="mp-reorder-heading"><div><span>다음 물건 준비하기</span><h2 id={`${id}-title`}>재고가 끊기기 전, 미리 주문하세요.</h2><p className="ds-reorder-lead">입고까지 {lead}일을 기준으로 계산해요.</p></div></div>
  {plan?<>
   <ReorderCalendar schedule={schedule} quantity={quantity} statusId={statusId} invalidMessage={invalidMessage} controls={
    <div className="ds-calendar-controls">
     <label className="ds-calendar-start">판매 시작일<input type="date" value={start} onChange={event=>onDatesChange({...dates,start:event.target.value})}/></label>
     <label className="ds-calendar-start">재발주일<input type="date" min={start||undefined} value={reorder} onChange={event=>onDatesChange({...dates,reorder:event.target.value})} aria-invalid={beforeStart} aria-describedby={statusId}/></label>
    </div>
   }/>
   <div className="mp-reorder-metrics"><div><span>하루 판매 목표</span><b>{n(plan.dailySales)}개</b></div><div><span>한 달 판매 목표</span><b>{n(plan.monthlySales)}개</b></div><div><span>주문 마감 때 남는 재고</span><b>약 {n(plan.stockAtReorder)}개</b></div></div>
   <details className="mp-story-details"><summary>재발주 날짜는 어떻게 계산하나요?</summary><p>주문 마감 = 판매 목표 기간 {plan.durationDays}일 − 입고 {lead}일. 권장일은 마감보다 최대 {Math.min(plan.bufferDays,plan.reorderDay)}일 앞당긴 계획이에요.</p><p>여유 기간은 입고 소요일의 25%를 올림하되 최대 7일로 잡은 가정입니다. 실제 공급처 일정과 판매 속도에 맞춰 조정하세요.</p></details>
   <details className="mp-story-details"><summary>월별 판매·재고 계획 보기</summary><table className="mp-reorder-table"><caption>균등 판매를 가정한 월말 재고 계획</caption><thead><tr><th scope="col">기간</th><th scope="col">월 판매 목표</th><th scope="col">누적 판매</th><th scope="col">남은 재고</th></tr></thead><tbody>{Array.from({length:months},(_,i)=><tr key={i}><th scope="row">{i+1}개월</th><td>{n(plan.monthlySales)}개</td><td>{n(plan.monthlySales*(i+1))}개</td><td>{n(Math.max(0,quantity-plan.monthlySales*(i+1)))}개</td></tr>)}</tbody></table></details>
  </>:<p role="status">판매 목표 기간을 확인해 주세요.</p>}
  {plan&&<p className="mp-reorder-note">{n(quantity)}개를 {months}개월에 걸쳐 같은 속도로 판매하는 계획입니다. 1개월은 30일로 계산합니다.</p>}
 </section>;
}
