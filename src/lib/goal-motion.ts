export const GOAL_MONTH_END = 1200;
export const GOAL_COUNT_START = 1450;
export const GOAL_COUNT_END = 3450;

function countAt(elapsed:number,start:number,end:number,target:number){
 const progress=Math.max(0,Math.min(1,(elapsed-start)/(end-start)));
 return progress===0?0:progress===1?target:Math.round(target*(1-Math.pow(1-progress,4)));
}

/** Count months first, then the actual calculated profit. Both remain visible. */
export function goalMotionFrame(elapsed:number,months:number,profit:number){
 const targetMonths=Number.isFinite(months)?Math.max(0,Math.round(months)):0;
 const target=Number.isFinite(profit)?Math.round(profit):0;
 return {target,targetMonths,months:countAt(elapsed,0,GOAL_MONTH_END,targetMonths),count:countAt(elapsed,GOAL_COUNT_START,GOAL_COUNT_END,target),phase:elapsed>=GOAL_COUNT_END?'complete':elapsed>=GOAL_COUNT_START?'amount':'months',complete:elapsed>=GOAL_COUNT_END};
}
