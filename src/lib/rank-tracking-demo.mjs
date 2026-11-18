import {createRankObservationTracking,recordRankObservation,summarizeRankObservationTracking} from '../../keyword-api/src/rank-observation-tracker.mjs';

// Synthetic observations are generated locally, never from a user's account.
// Fixed relative times avoid implying a real change occurred at a particular date.
export function runRankTrackingDemo({pcTarget=2,mobileTarget=3}={}) {
 const changeAt=1_800_000_000_000;
 let tracking=createRankObservationTracking({id:'rank-demo',changeAt,bid:100,targets:{pc:pcTarget,mobile:mobileTarget}});
 for(const [minutes,device,rank] of [[10,'pc',4],[10,'mobile',5],[20,'pc',2],[20,'mobile',null],[30,'pc',1],[30,'mobile',2]]){
  const at=changeAt+minutes*60000;
  const result=rank===null?{status:'unavailable'}:{status:'available',kind:'instant',rank,observedAt:at,source:'simulation'};
  tracking=recordRankObservation(tracking,{minutes,device,requestedAt:at,receivedAt:at,result});
 }
 return summarizeRankObservationTracking(tracking);
}
