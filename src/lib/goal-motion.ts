export const GOAL_MOTION_DURATION = 7000;
export const GOAL_COUNT_START = 1650;
export const GOAL_COUNT_END = 2800;

/** Shared visual timing; never changes the calculated profit. */
export function goalMotionFrame(elapsed:number,profit:number){
 const target=Number.isFinite(profit)?Math.round(profit):0;
 const progress=Math.max(0,Math.min(1,(elapsed-GOAL_COUNT_START)/(GOAL_COUNT_END-GOAL_COUNT_START)));
 const count=progress===0?0:progress===1?target:Math.round(target*(1-Math.pow(1-progress,4)));
 const phase=elapsed>=GOAL_MOTION_DURATION?'complete':elapsed>=5000?'invitation':elapsed>=3500?'question':elapsed>=1500?'amount':'period';
 return {target,count,phase,countDone:progress===1,complete:elapsed>=GOAL_MOTION_DURATION};
}
