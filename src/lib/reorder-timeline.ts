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
