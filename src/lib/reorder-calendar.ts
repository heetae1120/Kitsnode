const DAY=86400000;
function dayTimestamp(date:string){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date.startsWith('0000'))return null;
 const time=Date.parse(`${date}T00:00:00Z`);
 return Number.isFinite(time)&&new Date(time).toISOString().slice(0,10)===date?time:null;
}
export function dateAfter(start:string,offset:number){
 const time=dayTimestamp(start);
 if(time===null||!Number.isSafeInteger(offset))return null;
 const shifted=new Date(time+offset*DAY);
 if(!Number.isFinite(shifted.getTime())||shifted.getUTCFullYear()<1||shifted.getUTCFullYear()>9999)return null;
 return shifted.toISOString().slice(0,10);
}
export function daysBetween(start:string,end:string){
 const first=dayTimestamp(start),last=dayTimestamp(end);
 return first===null||last===null?null:(last-first)/DAY;
}
export function calendarMonth(anchor:string,offset=0){
 if(!dateAfter(anchor,0))return null;
 const first=new Date(`${anchor.slice(0,7)}-01T00:00:00Z`);first.setUTCMonth(first.getUTCMonth()+offset);
 const year=first.getUTCFullYear(),month=first.getUTCMonth();
 const count=new Date(Date.UTC(year,month+1,0)).getUTCDate();
 return {label:`${year}년 ${month+1}월`,key:first.toISOString().slice(0,7),cells:[...Array(first.getUTCDay()).fill(null),...Array.from({length:count},(_,i)=>dateAfter(first.toISOString().slice(0,10),i))] as (string|null)[]};
}
