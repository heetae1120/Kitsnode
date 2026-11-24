import {dateAfter,daysBetween} from './reorder-calendar';

/** Planning timeline only: 30-day months, steady sales, no safety stock or sales prediction. */
export function reorderTimeline(quantity:number,months:number,leadDays:number){
 if(!Number.isSafeInteger(quantity)||quantity<1||!Number.isSafeInteger(months)||months<1||months>120||!Number.isSafeInteger(leadDays)||leadDays<0||leadDays>3650)return null;
 const durationDays=months*30;
 const reorderDay=Math.max(0,durationDays-leadDays);
 // A visible planning buffer, not a forecast of supplier delays or actual safety stock.
 const bufferDays=Math.min(7,Math.ceil(leadDays/4));
 const recommendedDay=Math.max(0,reorderDay-bufferDays);
 return {durationDays,reorderDay,recommendedDay,bufferDays,dailySales:quantity/durationDays,monthlySales:quantity/months,stockAtReorder:Math.ceil(quantity*(durationDays-reorderDay)/durationDays),lateDays:Math.max(0,leadDays-durationDays)};
}

export function stockAtDay(quantity:number,duration:number,day:number){
 const remaining=Math.max(0,duration-day);
 // Round the same way as the existing order-deadline estimate, with exact integer arithmetic.
 return Number((BigInt(quantity)*BigInt(remaining)+BigInt(duration-1))/BigInt(duration));
}

export function reorderSchedule(plan:NonNullable<ReturnType<typeof reorderTimeline>>, start:string, reorder:string, leadDays:number){
 const recommended=dateAfter(start,plan.recommendedDay);
 const deadline=dateAfter(start,plan.reorderDay);
 const depletion=dateAfter(start,plan.durationDays);
 if(!recommended||!deadline||!depletion)return null;

 const orderDay=daysBetween(start,reorder);
 const arrival=orderDay!==null&&orderDay>=0?dateAfter(reorder,leadDays):null;
 const arrivalDay=arrival&&orderDay!==null?orderDay+leadDays:null;
 const daysAtArrival=arrivalDay===null?null:plan.durationDays-arrivalDay;
 const recommendedBuffer=plan.durationDays-plan.recommendedDay-leadDays;
 const orderWindow=plan.reorderDay-plan.recommendedDay;
 const risk:'pending'|'risk'|'caution'|'safe'=daysAtArrival===null?'pending':daysAtArrival<0?'risk':daysAtArrival===0||daysAtArrival<recommendedBuffer?'caution':'safe';

 return {start,recommended,deadline,depletion,arrival,arrivalDay,daysAtArrival,recommendedBuffer,orderWindow,risk,
  recommendedDay:plan.recommendedDay,deadlineDay:plan.reorderDay,duration:plan.durationDays,leadDays};
}
