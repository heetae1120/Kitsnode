"use client";
import {dateAfter} from '@/lib/reorder-calendar';
export function ReorderCalendar({start,recommended,deadline,duration}:{start:string;recommended:number;deadline:number;duration:number}){
 const dates=[dateAfter(start,recommended),dateAfter(start,deadline),dateAfter(start,duration)];
 if(dates.some(date=>!date))return null;
 const events=[
  {title:'재발주 권장',day:recommended,note:'여유 있게 주문하는 날',kind:'recommended'},
  {title:'주문 마감',day:deadline,note:'늦어도 이 날까지 주문',kind:'deadline'},
  {title:'재고 소진',day:duration,note:'계획상 물건이 다 팔리는 날',kind:'depletion'},
 ];
 return <section className="ds-reorder-calendar ds-key-dates" aria-label="재발주 핵심 일정">
  <h3>재발주 일정, 한눈에 보기</h3>
  <ol className="ds-key-date-list">{events.map((event,i)=>{
   const date=dates[i]!;
   return <li key={event.kind} className={`ds-key-date is-${event.kind}`}><span className="ds-key-date-label">{event.title}</span><time dateTime={date}><small>{date.slice(0,4)}년</small><strong>{Number(date.slice(5,7))}월 {Number(date.slice(8,10))}일</strong></time><b>판매 시작 {event.day}일째</b><p>{event.note}</p></li>;
  })}</ol>
  <div className="ds-key-date-gaps"><span>권장일 → 주문 마감 <b>{deadline-recommended}일 여유</b></span><span>주문 마감 → 재고 소진 <b>{duration-deadline}일</b></span></div>
 </section>;
}
