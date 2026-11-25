// Descriptive comparison only. Estimates are not actual ranks, do not prove
// that one common bid can satisfy both devices, and never authorize a write.
const fail=reason=>({status:'unavailable',reason,execution:'disabled'});
const validId=(v,p)=>typeof v==='string'&&new RegExp(`^${p}-[A-Za-z0-9-]{1,100}$`).test(v);
export function compareDeviceRankEstimates({kind,targetId,pc,mobile,maxBid,nowMs,maxAgeMs=300000}={}){
 if(!['keyword','product'].includes(kind)||!validId(targetId,kind==='keyword'?'nkw':'nad')||!Number.isSafeInteger(maxBid)||maxBid<50||maxBid>100000||maxBid%10!==0||!Number.isSafeInteger(nowMs)||!Number.isSafeInteger(maxAgeMs)||maxAgeMs<=0)return fail('invalid_input');
 const valid=(row,device)=>row?.ok===true&&row.kind===kind&&row.targetId===targetId&&row.device===device&&row.deviceEchoed===true&&row.execution==='disabled'&&Number.isSafeInteger(row.position)&&row.position>=1&&row.position<=(kind==='product'?4:device==='PC'?10:5)&&Number.isSafeInteger(row.bid)&&row.bid>=50&&row.bid<=100000&&row.bid%10===0&&Number.isSafeInteger(row.fetchedAt)&&row.fetchedAt<=nowMs&&nowMs-row.fetchedAt<=maxAgeMs;
 if(!valid(pc,'PC')||!valid(mobile,'MOBILE'))return fail('estimate_unverified');
 return {status:'comparison_available',execution:'disabled',pc:{position:pc.position,bid:pc.bid,withinCap:pc.bid<=maxBid},mobile:{position:mobile.position,bid:mobile.bid,withinCap:mobile.bid<=maxBid},higherEstimate:Math.max(pc.bid,mobile.bid),bothEstimatesWithinCap:pc.bid<=maxBid&&mobile.bid<=maxBid,simultaneousRank:'unverified',rankGuaranteed:false};
}
