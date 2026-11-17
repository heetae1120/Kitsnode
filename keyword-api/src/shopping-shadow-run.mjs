// Offline comparison and shadow planning only. There is deliberately no
// credential, persistence, scheduler, HTTP route or bid-changing dependency.
// Normalized master rows must come from a separately authenticated source;
// a match is corroboration, not proof of an atomic or exhaustive snapshot.
const adId=v=>typeof v==='string'&&/^nad-[A-Za-z0-9-]{1,100}$/.test(v);
const groupId=v=>typeof v==='string'&&/^grp-[A-Za-z0-9-]{1,100}$/.test(v);
const customer=v=>(typeof v==='string'||Number.isSafeInteger(v))&&/^[1-9][0-9]{0,15}$/.test(String(v))?String(v):null;
const fail=reason=>({status:'unavailable',reason,execution:'disabled'});

export function compareShoppingSources({customerId,adgroupId,live,master,liveAt,masterAt,now=Date.now()}={}) {
 const c=customer(customerId);
 if(!c||!groupId(adgroupId)||![liveAt,masterAt,now].every(Number.isSafeInteger)||liveAt>now||masterAt>now||now-liveAt>300000||now-masterAt>300000)return fail('invalid_or_stale_source');
 if(!Array.isArray(live)||!Array.isArray(master)||live.length>1000||master.length>1000)return fail('invalid_source');
 const normalize=(rows)=>{
  const out=new Map();
  for(const r of rows){
   if(!r||!adId(r.id)||r.adgroupId!==adgroupId||customer(r.customerId)!==c||typeof r.useGroupBid!=='boolean'||out.has(r.id))return null;
   out.set(r.id,r.useGroupBid);
  }
  return out;
 };
 const a=normalize(live),b=normalize(master);if(!a||!b)return fail('invalid_source');
 const onlyLive=[],onlyMaster=[],differentBidMode=[];
 for(const [id,mode] of a){if(!b.has(id))onlyLive.push(id);else if(b.get(id)!==mode)differentBidMode.push(id);}
 for(const id of b.keys())if(!a.has(id))onlyMaster.push(id);
 const mismatch=onlyLive.length+onlyMaster.length+differentBidMode.length>0;
 return {status:mismatch?'mismatch':'observed_consistent',liveCount:a.size,masterCount:b.size,onlyLive,onlyMaster,differentBidMode,complete:false,execution:'disabled'};
}

// A shadow run records what would be considered, never an instruction to send.
// Every outcome remains blocked even when the two observed sources agree.
export function planShoppingShadowRun({illustration,comparison}={}) {
 if(!illustration||illustration.status!=='illustrative'||illustration.scope!=='adgroup'||illustration.execution!=='disabled'||!Number.isSafeInteger(illustration.currentBid)||!Number.isSafeInteger(illustration.proposedBid)||!Array.isArray(illustration.blockers)||!illustration.blockers.every(x=>typeof x==='string'))return fail('invalid_illustration');
 if(!comparison||comparison.execution!=='disabled'||!['mismatch','observed_consistent'].includes(comparison.status))return fail('comparison_unavailable');
 const blockers=[...new Set([...illustration.blockers,'source_completeness_unverified','atomic_update_unavailable',...(comparison.status==='mismatch'?['source_mismatch']:[])])];
 return {status:'shadow_only',currentBid:illustration.currentBid,proposedBid:illustration.proposedBid,comparison:comparison.status,blockers,execution:'disabled'};
}
