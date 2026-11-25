"use client";
import {useEffect,useId,useState} from 'react';
import {ReorderCalendar} from './reorder-calendar';
import {dateAfter} from '@/lib/reorder-calendar';
import {reorderSchedule,reorderTimeline} from '@/lib/reorder-timeline';

export type ReorderDates={start?:string;reorder?:string;lead?:string};

function wholeNumber(value:string,min:number,max:number){
 const number=Number(value);
 return value!==''&&Number.isInteger(number)&&number>=min&&number<=max?number:null;
}

export function ReorderTimeline({quantity,months,onMonthsChange,dates,onDatesChange}:{quantity:number;months:number;onMonthsChange:(months:number)=>void;dates:ReorderDates;onDatesChange:(dates:ReorderDates)=>void}){
 const id=useId();
 const [monthDraft,setMonthDraft]=useState(String(months));
 const [today,setToday]=useState('');
 useEffect(()=>{const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());setToday(['year','month','day'].map(key=>parts.find(p=>p.type===key)?.value).join('-'));},[]);

 const selectedMonths=wholeNumber(monthDraft,1,120);
 const leadText=dates.lead??'14';
 const lead=wholeNumber(leadText,0,3650);
 const plan=selectedMonths===null?null:reorderTimeline(quantity,selectedMonths,lead??0);
 const start=dates.start??today;
 const reorder=dates.reorder??(plan&&lead!==null?dateAfter(start,plan.recommendedDay):null)??'';
 const schedule=plan&&lead!==null?reorderSchedule(plan,start,reorder,lead):null;
 const beforeStart=Boolean(schedule&&dateAfter(reorder,0)&&reorder<start);
 const invalidMessage=beforeStart?'재발주일은 판매 시작일과 같거나 그 이후여야 해요.':undefined;
 const statusId=`${id}-status`;
 const n=(value:number)=>value.toLocaleString('ko-KR',{maximumFractionDigits:2});
 return <section className="mp-reorder" aria-labelledby={`${id}-title`}>
  <h2 id={`${id}-title`} className="ds-sr-only">재발주 일정</h2>
  <div className="mp-reorder-metrics sd-stock-targets">
   <div><label htmlFor={`${id}-months`}>목표 개월 수</label><div className="sd-stock-number"><input id={`${id}-months`} type="number" min={1} max={120} step={1} value={monthDraft} aria-invalid={selectedMonths===null} aria-describedby={selectedMonths===null?`${id}-months-error`:undefined} onChange={event=>{
    const value=event.target.value;
    setMonthDraft(value);
    const number=wholeNumber(value,1,120);
    if(number!==null)onMonthsChange(number);
   }} onBlur={()=>{if(selectedMonths===null)setMonthDraft(String(months));}}/><span aria-hidden="true">개월</span></div></div>
   <div><span>하루 판매 목표</span><b>{plan?n(plan.dailySales)+'개':'—'}</b></div>
   <div><span>한 달 판매 목표</span><b>{plan?n(plan.monthlySales)+'개':'—'}</b></div>
  </div>
  {selectedMonths===null&&<p id={`${id}-months-error`} className="mp-error" role="alert">목표 개월 수는 1~120 사이의 정수로 입력해 주세요.</p>}
  <ReorderCalendar schedule={schedule} quantity={quantity} statusId={statusId} invalidMessage={invalidMessage} controls={
   <div className="ds-calendar-controls">
    <label className="ds-calendar-start">판매 시작일<input type="date" value={start} onChange={event=>onDatesChange({...dates,start:event.target.value})}/></label>
    <label className="ds-calendar-start">재발주일<input type="date" min={start||undefined} value={reorder} onChange={event=>onDatesChange({...dates,reorder:event.target.value})} aria-invalid={beforeStart} aria-describedby={statusId}/></label>
    <label className="ds-calendar-start">예상 입고 소요일<span className="sd-stock-number"><input type="number" min={0} max={3650} step={1} value={leadText} aria-invalid={lead===null} aria-describedby={lead===null?`${id}-lead-error`:undefined} onChange={event=>onDatesChange({...dates,lead:event.target.value})}/><span aria-hidden="true">일</span></span></label>
    {lead===null&&<p id={`${id}-lead-error`} className="mp-error" role="alert">입고 소요일은 0~3,650 사이의 정수로 입력해 주세요.</p>}
   </div>
  }/>
  {plan&&selectedMonths!==null&&<>
   {lead!==null&&<details className="mp-story-details"><summary>일정 계산 기준</summary><p>주문 마감 = 판매 목표 기간 {plan.durationDays}일 − 입고 {lead}일. 권장일은 마감보다 최대 {plan.reorderDay-plan.recommendedDay}일 앞당긴 계획이에요.</p><p>여유 기간은 입고 소요일의 25%를 올림하되 최대 7일로 잡은 가정입니다. 실제 공급처 일정과 판매 속도에 맞춰 조정하세요.</p></details>}
   <details className="mp-story-details"><summary>월별 판매 목표와 재고 보기</summary><table className="mp-reorder-table"><caption>균등 판매를 가정한 월말 재고 계획</caption><thead><tr><th scope="col">기간</th><th scope="col">월 판매 목표</th><th scope="col">누적 판매</th><th scope="col">남은 재고</th></tr></thead><tbody>{Array.from({length:selectedMonths},(_,i)=><tr key={i}><th scope="row">{i+1}개월</th><td>{n(plan.monthlySales)}개</td><td>{n(plan.monthlySales*(i+1))}개</td><td>{n(Math.max(0,quantity-plan.monthlySales*(i+1)))}개</td></tr>)}</tbody></table></details>
   <p className="mp-reorder-note">{n(quantity)}개를 {selectedMonths}개월 동안 같은 속도로 판매한다고 가정했어요. 한 달은 30일로 계산해요.</p>
  </>}
 </section>;
}
