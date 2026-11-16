const DAY=86400000;
export function dateAfter(start:string,offset:number){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!Number.isInteger(offset))return null;
 const time=Date.parse(`${start}T00:00:00Z`);if(!Number.isFinite(time)||new Date(time).toISOString().slice(0,10)!==start)return null;
 return new Date(time+offset*DAY).toISOString().slice(0,10);
}
export function calendarMonth(anchor:string,offset=0){
 if(!dateAfter(anchor,0))return null;
 const first=new Date(`${anchor.slice(0,7)}-01T00:00:00Z`);first.setUTCMonth(first.getUTCMonth()+offset);
 const year=first.getUTCFullYear(),month=first.getUTCMonth();
 const count=new Date(Date.UTC(year,month+1,0)).getUTCDate();
 return {label:`${year}년 ${month+1}월`,key:first.toISOString().slice(0,7),cells:[...Array(first.getUTCDay()).fill(null),...Array.from({length:count},(_,i)=>dateAfter(first.toISOString().slice(0,10),i))] as (string|null)[]};
}
