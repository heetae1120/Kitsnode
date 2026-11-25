"use client";
import {useId,useState,type PointerEvent,type ReactNode} from 'react';
import {stockAtDay,type reorderSchedule} from '@/lib/reorder-timeline';

type Schedule=NonNullable<ReturnType<typeof reorderSchedule>>;
type MilestoneKind='recommended'|'arrival'|'depletion';
type Milestone={kind:MilestoneKind;label:string;day:number;date:string};
const stateCopy={safe:'안전',caution:'주의',risk:'위험',pending:'일정 확인'};
const formatDate=(date:string)=>date.replaceAll('-','.');
const formatStock=(quantity:number)=>quantity.toLocaleString('ko-KR')+'개';

function Milestones({schedule,quantity}:{schedule:Schedule;quantity:number}){
 const id=useId();
 const [hovered,setHovered]=useState<MilestoneKind|null>(null);
 const [focused,setFocused]=useState<MilestoneKind|null>(null);
 const [pinned,setPinned]=useState<MilestoneKind|null>(null);
 const active=hovered??focused??pinned;
 const {duration,arrivalDay}=schedule;
 const firstDay=Math.min(schedule.recommendedDay,arrivalDay??schedule.recommendedDay);
 const horizon=Math.max(duration,arrivalDay??duration);
 const span=Math.max(1,horizon-firstDay);
 const percent=(day:number)=>(day-firstDay)/span*100;
 const events:Milestone[]=[
  {kind:'recommended',label:'재발주 권장일',day:schedule.recommendedDay,date:schedule.recommended},
 ];
 if(schedule.arrival&&arrivalDay!==null)events.push({kind:'arrival',label:'예상 입고일',day:arrivalDay,date:schedule.arrival});
 events.push({kind:'depletion',label:'예상 재고 소진일',day:duration,date:schedule.depletion});
 events.sort((a,b)=>a.day-b.day);

 // 가까운 날짜는 같은 가로 좌표를 유지하고 세로 위치만 분리합니다.
 const laneEnds=[-Infinity,-Infinity,-Infinity];
 const laneOffsets=[0,-25,25];
 const points=events.map(event=>{
  const x=percent(event.day);
  const lane=laneEnds.findIndex(last=>x-last>=5);
  laneEnds[lane]=x;
  return {...event,x,y:laneOffsets[lane]};
 });
 const segments=[
  {kind:'neutral',start:firstDay,end:schedule.recommendedDay},
  {kind:'buffer',start:schedule.recommendedDay,end:schedule.deadlineDay},
  {kind:'risk',start:schedule.deadlineDay,end:duration},
  {kind:'shortage',start:duration,end:horizon},
 ].filter(segment=>segment.end>segment.start);

 function toggle(kind:MilestoneKind){
  setHovered(null);
  setPinned(current=>current===kind?null:kind);
 }
 function hover(event:PointerEvent,kind:MilestoneKind){
  if(event.pointerType==='mouse'&&window.matchMedia('(hover: hover) and (min-width: 801px)').matches)setHovered(kind);
 }
 return <div className="ds-reorder-timeline" onPointerLeave={()=>setHovered(null)} onKeyDown={event=>{
  if(event.key==='Escape'){setHovered(null);setFocused(null);setPinned(null);}
 }}>
  <h4 className="ds-reorder-chart-title">재발주부터 재고 소진까지</h4>
  <div className="ds-reorder-axis" aria-hidden="true">
   <div className="ds-reorder-track">
    {segments.map(segment=><i key={segment.kind} className={`is-${segment.kind}`} style={{left:percent(segment.start)+'%',width:(segment.end-segment.start)/span*100+'%'}}/>)}
   </div>
   {points.map(({kind,x,y})=><i key={kind} className="ds-reorder-stem" style={{left:x+'%',top:`calc(50% + ${Math.min(0,y)}px)`,height:Math.abs(y)}}/>)}
   {points.map(({kind,x,y})=><span key={kind} className={`ds-reorder-point is-${kind}`} style={{left:x+'%',top:`calc(50% + ${y}px)`}} onPointerEnter={event=>hover(event,kind)} onClick={()=>toggle(kind)}>
    <i className="ds-reorder-symbol"/>
   </span>)}
  </div>
  <ol className="ds-reorder-events" aria-label="주요 일정">
   {points.map(({kind,label,day,date})=><li className={`is-${kind}`} key={kind} onPointerEnter={event=>hover(event,kind)}>
    <button type="button" aria-expanded={active===kind} aria-describedby={active===kind?`${id}-${kind}`:undefined} onFocus={event=>{if(event.currentTarget.matches(':focus-visible'))setFocused(kind);}} onBlur={()=>setFocused(null)} onClick={()=>toggle(kind)}>
     <i className="ds-reorder-symbol" aria-hidden="true"/>
     <span>{label}<time dateTime={date}>{formatDate(date)}</time></span>
    </button>
    {active===kind&&<div className="ds-reorder-tooltip" id={`${id}-${kind}`} role="tooltip">
     <strong>{formatDate(date)}</strong>
     <span>예상 잔여 재고 <b>{formatStock(stockAtDay(quantity,duration,day))}</b></span>
     <span>판매 경과 <b>{day.toLocaleString('ko-KR')}일</b></span>
    </div>}
   </li>)}
  </ol>
  <div className="ds-reorder-windows">
   <span><i className="is-buffer"/>권장일 → 주문 마감 <b>{schedule.orderWindow}일 여유</b></span>
   <span><i className="is-risk"/>주문 마감 → 재고 소진 <b>{duration-schedule.deadlineDay}일</b></span>
   {horizon>duration&&<span><i className="is-shortage"/>입고 전 예상 품절 <b>{horizon-duration}일</b></span>}
  </div>
  {duration>schedule.deadlineDay&&<p className="ds-reorder-legend-note">빨간 구간에 발주하면 입고 전 품절 위험이 있어요.</p>}
 </div>;
}

export function ReorderCalendar({schedule,quantity,controls,statusId,invalidMessage}:{schedule:Schedule|null;quantity:number;controls:ReactNode;statusId:string;invalidMessage?:string}){
 const id=useId();
 const days=schedule?.daysAtArrival??null;
 const arrivalDay=schedule?.arrivalDay??null;
 const state=schedule?.risk??'pending';
 const metrics=schedule?[
  {label:'예상 입고일',value:schedule.arrival?formatDate(schedule.arrival):'—',date:schedule.arrival},
  {label:'입고 소요 기간',value:schedule.leadDays+'일'},
  {label:'입고 시 남은 판매일',value:days===null?'—':Math.max(0,days)+'일'},
  {label:'입고 시 남은 재고',value:arrivalDay===null?'—':formatStock(stockAtDay(quantity,schedule.duration,arrivalDay))},
 ]:[];
 return <section className="ds-reorder-dashboard" data-risk={state} aria-labelledby={id}>
  <header className="ds-reorder-dashboard-heading">
   <h3 id={id} className="ds-sr-only">재발주 일정표</h3>
  </header>
  {schedule&&<div className="ds-reorder-headline">
   <div><span>재발주 권장일</span><time key={schedule.recommended} dateTime={schedule.recommended}>{formatDate(schedule.recommended)}</time></div>
   <span className="ds-reorder-reserve">{schedule.recommendedBuffer>0?`재고 여유 ${schedule.recommendedBuffer}일 확보`:schedule.recommendedBuffer===0?'권장일 발주 시 재고 여유 0일':`권장일에 발주해도 ${-schedule.recommendedBuffer}일 부족`}</span>
  </div>}
  {controls}
  {schedule&&<>
   <Milestones schedule={schedule} quantity={quantity}/>
   <dl className="ds-reorder-kpis" aria-label="입고 및 재고 지표">
    {metrics.map(({label,value,date})=><div key={label}><dt>{label}</dt><dd><span key={value}>{date?<time dateTime={date}>{value}</time>:value}</span></dd></div>)}
   </dl>
  </>}
  {invalidMessage
   ? <p className="mp-error" id={statusId} role="alert">{invalidMessage}</p>
   : <span id={statusId} className="ds-sr-only" role="status">{stateCopy[state]}{days!==null&&days<0&&` · 예상 품절 기간 ${-days}일`}</span>}
 </section>;
}
