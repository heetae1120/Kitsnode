/**
 * Read-only weekly schedule evaluation. Slots begin Monday at 00:00 in Seoul;
 * slot 167 is Sunday 23:00–24:00. A null schedule is deliberately unset,
 * rather than implicitly enabling a user's historical rules.
 *
 * This module does not trigger simulations, contact providers, or make bids.
 */
export const SHADOW_SCHEDULE_TIMEZONE = 'Asia/Seoul';
export const SHADOW_SCHEDULE_SLOT_COUNT = 168;
const DAY_INDEX = Object.freeze({Mon:0,Tue:1,Wed:2,Thu:3,Fri:4,Sat:5,Sun:6});
const DAY_NAME = Object.freeze(['mon','tue','wed','thu','fri','sat','sun']);
const FORMATTER = new Intl.DateTimeFormat('en-US',{
 timeZone:SHADOW_SCHEDULE_TIMEZONE,weekday:'short',hour:'2-digit',hourCycle:'h23'
});

export function validShadowSchedule(schedule){
 return schedule!==null && typeof schedule==='object' && !Array.isArray(schedule) &&
  Object.keys(schedule).sort().join(',')==='slots,timezone' &&
  schedule.timezone===SHADOW_SCHEDULE_TIMEZONE && typeof schedule.slots==='string' && /^[01]{168}$/.test(schedule.slots);
}

export function evaluateShadowSchedule(schedule,nowMs=Date.now()){
 if(schedule==null)return {status:'unset',timezone:SHADOW_SCHEDULE_TIMEZONE};
 if(!validShadowSchedule(schedule)||!Number.isSafeInteger(nowMs))return {status:'invalid',timezone:SHADOW_SCHEDULE_TIMEZONE};
 const time=new Date(nowMs);if(!Number.isFinite(time.getTime()))return {status:'invalid',timezone:SHADOW_SCHEDULE_TIMEZONE};
 try{
  const parts=FORMATTER.formatToParts(time);
  const weekday=parts.find(p=>p.type==='weekday')?.value;
  const hourText=parts.find(p=>p.type==='hour')?.value;
  const weekdayIndex=DAY_INDEX[weekday],hour=Number(hourText);
  if(!Number.isInteger(weekdayIndex)||!/^\d{2}$/.test(hourText||'')||!Number.isInteger(hour)||hour<0||hour>23)return {status:'invalid',timezone:SHADOW_SCHEDULE_TIMEZONE};
  const slotIndex=weekdayIndex*24+hour;
  return {status:schedule.slots[slotIndex]==='1'?'on':'off',timezone:SHADOW_SCHEDULE_TIMEZONE,day:DAY_NAME[weekdayIndex],hour,slotIndex};
 }catch{return {status:'invalid',timezone:SHADOW_SCHEDULE_TIMEZONE}}
}
