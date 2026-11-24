'use client';
import {useEffect,useState} from 'react';

export type DateMode='day'|'range'|'hour';
const pad=(n:number)=>String(n).padStart(2,'0');
export function todayInSeoul(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
export function calendarDays(month:string){
 const [year,m]=month.split('-').map(Number);
 if(!year||!m)return [];
 const first=new Date(Date.UTC(year,m-1,1)).getUTCDay(),count=new Date(Date.UTC(year,m,0)).getUTCDate();
 return [...Array(first).fill(''),...Array.from({length:count},(_,i)=>`${year}-${pad(m)}-${pad(i+1)}`)];
}
export function nextRange(day:string,since:string,until:string):[string,string]{
 if(!since||until||day<since)return [day,''];
 return [since,day];
}
export function AdPerformanceCalendar({mode,since,until,onChange,disabled}:{mode:DateMode;since:string;until:string;onChange:(since:string,until:string)=>void;disabled:boolean}){
 const [month,setMonth]=useState('');
 useEffect(()=>{setMonth(todayInSeoul().slice(0,7));},[]);
 useEffect(()=>{if(since)setMonth(since.slice(0,7));},[since]);
 function move(delta:number){const [y,m]=month.split('-').map(Number),d=new Date(Date.UTC(y,m-1+delta,1));setMonth(`${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}`);}
 function select(day:string){if(mode==='range')onChange(...nextRange(day,since,until));else onChange(day,day);}
 return <div className="ad-calendar" aria-label="조회 날짜 달력">
  <div className="ad-calendar-head"><button type="button" onClick={()=>move(-1)} disabled={disabled||!month} aria-label="이전 달">‹</button><strong>{month?`${month.slice(0,4)}년 ${Number(month.slice(5))}월`:'달력 불러오는 중'}</strong><button type="button" onClick={()=>move(1)} disabled={disabled||!month} aria-label="다음 달">›</button></div>
  <div className="ad-calendar-grid">{['일','월','화','수','목','금','토'].map(d=><span key={d} className="ad-calendar-weekday">{d}</span>)}{calendarDays(month).map((day,i)=>day?<button key={day} type="button" disabled={disabled} aria-label={`${day} 선택`} aria-pressed={day===since||day===until} data-in-range={!!since&&!!until&&day>since&&day<until||undefined} onClick={()=>select(day)}>{Number(day.slice(8))}</button>:<span key={`blank-${i}`}/>)}</div>
 </div>;
}
