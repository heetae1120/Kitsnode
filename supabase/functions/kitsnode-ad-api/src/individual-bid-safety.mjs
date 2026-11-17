// Read-only safety assessment. This module accepts no writer and cannot enable
// execution. A stable read is evidence only; it is not an atomic provider CAS.
const integer=Number.isSafeInteger;
const validBid=n=>integer(n)&&n>=50&&n<=100000&&n%10===0;
const validId=(v,p)=>typeof v==='string'&&new RegExp(`^${p}-[A-Za-z0-9-]{1,100}$`).test(v);
const validStatus=v=>typeof v==='string'&&/^[A-Z_]{1,50}$/.test(v);

export function assessIndividualBidSafety({kind,targetId,groupId,first,second,startedAt,finishedAt,desiredBid}={}) {
 const blockers=['atomic_update_unavailable','write_permission_unverified','campaign_status_unverified','provider_strategy_unverified'];
 const prefix=kind==='product'?'nad':kind==='keyword'?'nkw':null;
 const validSnapshot=s=>s&&s.group&&s.target&&s.group.id===groupId&&s.target.id===targetId&&validStatus(s.group.status)&&validStatus(s.target.status)&&validBid(s.group.bid)&&typeof s.target.useGroupBid==='boolean'&&(s.target.bid===null||validBid(s.target.bid));
 if(!prefix||!validId(targetId,prefix)||!validId(groupId,'grp')||!validSnapshot(first)||!validSnapshot(second))return {status:'blocked',execution:'disabled',blockers:[...blockers,'snapshot_invalid']};
 if(!integer(startedAt)||!integer(finishedAt)||finishedAt<startedAt||finishedAt-startedAt>60000)blockers.push('snapshot_stale');
 if(!validBid(desiredBid))blockers.push('desired_bid_invalid');
 if(first.group.status!==second.group.status||first.group.bid!==second.group.bid||first.target.status!==second.target.status||first.target.useGroupBid!==second.target.useGroupBid||first.target.bid!==second.target.bid)blockers.push('target_changed_during_read');
 if(second.group.status!=='ELIGIBLE')blockers.push('adgroup_inactive');
 if(second.target.status!=='ELIGIBLE')blockers.push('target_inactive');
 if(second.target.useGroupBid)blockers.push('individual_bid_conversion_required');
 const currentBid=second.target.useGroupBid?second.group.bid:second.target.bid;
 if(!validBid(currentBid))blockers.push('current_bid_unavailable');
 return {status:'blocked',execution:'disabled',currentBid:validBid(currentBid)?currentBid:null,conversionRequired:second.target.useGroupBid,blockers};
}

// A timeout or ambiguous reply can represent a completed write. Never declare
// success or recommend an automatic retry from an observation alone.
export function classifyIndividualBidWriteOutcome({requestState,expected,observed}={}) {
 if(requestState==='not_sent')return {status:'not_sent',retry:'disabled'};
 if(requestState!=='accepted')return {status:'unconfirmed',retry:'disabled'};
 const prefix=expected?.kind==='product'?'nad':expected?.kind==='keyword'?'nkw':null;
 if(!prefix||!validId(expected.targetId,prefix)||!validId(expected.groupId,'grp')||!validBid(expected.bid)||!observed||observed.targetId!==expected.targetId||observed.groupId!==expected.groupId||typeof observed.useGroupBid!=='boolean'||!validBid(observed.bid))return {status:'unconfirmed',retry:'disabled'};
 if(observed.useGroupBid!==false||observed.bid!==expected.bid)return {status:'mismatch',retry:'disabled'};
 return {status:'observed_applied',retry:'disabled'};
}
