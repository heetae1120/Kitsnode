"use client";
import {useState} from 'react';
import {calendarMonth,dateAfter} from '@/lib/reorder-calendar';
export function ReorderCalendar({start,recommended,deadline,duration}:{start:string;recommended:number;deadline:number;duration:number}){
 const [offset,setOffset]=useState(0);
 const recommendDate=dateAfter(start,recommended),deadlineDate=dateAfter(start,deadline),endDate=dateAfter(start,duration);
 const month=recommendDate?calendarMonth(recommendDate,offset):null;
 if(!month||!recommendDate||!deadlineDate||!endDate)return null;
 const earlier=month.key>start.slice(0,7),later=month.key<endDate.slice(0,7);
 return <section className="ds-reorder-calendar" aria-label="재발주 일정 달력">
  <header><button type="button" disabled={!earlier} aria-label="이전 달" onClick={()=>setOffset(v=>v-1)}>←</button><h3 aria-live="polite">{month.label}</h3><button type="button" disabled={!later} aria-label="다음 달" onClick={()=>setOffset(v=>v+1)}>→</button></header>
  <div className="ds-calendar-dates"><span>권장 <b>{recommendDate}</b></span><span>주문 마감 <b>{deadlineDate}</b></span><span>재고 소진 <b>{endDate}</b></span></div>
  <div className="ds-calendar-week" aria-hidden="true">{['일','월','화','수','목','금','토'].map(d=><span key={d}>{d}</span>)}</div>
  <ol className="ds-calendar-grid" aria-label={`${month.label} 날짜별 재발주 일정`}>{month.cells.map((date,i)=>{
   const safe=date&&date>=start&&date<=deadlineDate,risk=date&&date>deadlineDate&&date<=endDate;
   const events=date?[...(date===start?['판매 시작']:[]),...(date===recommendDate?['재발주 권장']:[]),...(date===deadlineDate?['주문 마감']:[]),...(date===endDate?['재고 소진']:[])]:[];
   return <li key={date??`blank-${i}`} className={[safe?'is-safe':'',risk?'is-risk':'',date===recommendDate?'is-recommended':'',date===deadlineDate?'is-deadline':'',date?'':'is-empty'].join(' ')}>{date&&<><time dateTime={date}>{Number(date.slice(-2))}</time>{events.map(event=><span key={event}>{event}</span>)}</>}</li>;
  })}</ol>
  <div className="ds-calendar-legend"><span><i/>마감 전 주문 가능</span><span><i/>입고 전 품절 위험</span><span><i/>권장 재발주일</span></div>
 </section>;
}
