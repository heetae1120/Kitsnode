import {shoppingScopeFingerprint} from './shopping-shadow-run.mjs';
import {assessIndividualBidSafety} from './individual-bid-safety.mjs';
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(v);
const id=(v,p)=>typeof v==='string'&&new RegExp(`^${p}-[A-Za-z0-9-]{1,100}$`).test(v);
const fail=reason=>({ok:false,reason});
const validNumbers=r=>[r.referenceBid,r.minBid,r.maxBid,r.maxChange].every(Number.isSafeInteger)&&r.referenceBid>=50&&r.referenceBid<=100000&&r.minBid>=50&&r.maxBid<=100000&&r.minBid<=r.maxBid&&r.minBid%10===0&&r.maxBid%10===0&&r.maxChange>=10&&r.maxChange<=100000;

// This service has no writer, execution flag, scheduler, or automatic actions.
// compare and preview are server-side functions, never browser-supplied results.
export function createShoppingShadowService({verifySession,memberAllowed,getBinding,catalog,compare,preview,store}){
 if(![verifySession,memberAllowed,getBinding,catalog,compare,preview].every(x=>typeof x==='function')||!store||!['save','list','append','history'].every(x=>typeof store[x]==='function'))throw TypeError('invalid_dependencies');
 async function actor(token){try{const u=await verifySession(token);return uuid(u?.id)&&await memberAllowed(u.id)===true?u.id:null}catch{return null}}
 return async(token,input)=>{
  const user=await actor(token);if(!user)return fail('unauthorized');
  if(!input||!['save','saveTarget','list','simulate','history'].includes(input.action)||!uuid(input.connectionId))return fail('invalid_input');
  try{
   const binding=await getBinding(user,input.connectionId);if(!binding||binding.userId!==user||binding.status!=='read_connected'||!Number.isSafeInteger(binding.revision))return fail('connection_required');
   if(input.action==='list'){const rules=await store.list(user,input.connectionId);return Array.isArray(rules)&&rules.length<=100?{ok:true,rules}:fail('too_many_rules')}
   if(input.action==='save'||input.action==='saveTarget'){
    const targetType=input.action==='save'?'group':input.targetType,targetId=input.action==='save'?input.adgroupId:input.targetId;
    if(!['group','product','keyword'].includes(targetType)||!id(targetId,targetType==='group'?'grp':targetType==='product'?'nad':'nkw')||(targetType==='group'&&targetId!==input.adgroupId))return fail('invalid_input');
    if(!id(input.campaignId,'cmp')||!id(input.adgroupId,'grp')||!validNumbers(input)||(input.expectedVersion!==null&&(!Number.isSafeInteger(input.expectedVersion)||input.expectedVersion<0)))return fail('invalid_input');
    const groups=await catalog(token,{action:targetType==='keyword'?'keywordGroups':'groups',connectionId:input.connectionId,campaignId:input.campaignId});
    if(!groups?.ok||groups.items.filter(x=>x.id===input.adgroupId).length!==1)return fail('target_unavailable');
    if(targetType!=='group'){const targets=await catalog(token,{action:targetType==='keyword'?'keywords':'products',connectionId:input.connectionId,campaignId:input.campaignId,groupId:input.adgroupId});if(!targets?.ok||targets.items.filter(x=>x.id===targetId).length!==1)return fail('target_unavailable');}
    if(await actor(token)!==user)return fail('unauthorized');
    const rule=await store.save(user,{...input,targetType,targetId});return rule?{ok:true,rule}:fail('conflict');
   }
   if(!uuid(input.ruleId))return fail('invalid_input');
   const rules=await store.list(user,input.connectionId);if(!Array.isArray(rules)||rules.length>100)return fail('too_many_rules');
   const found=rules.filter(r=>r.id===input.ruleId&&r.connection_id===input.connectionId);if(found.length!==1)return fail('not_found');const r=found[0];
   if(input.action==='history'){const entries=await store.history(user,r.id);return Array.isArray(entries)?{ok:true,entries}:fail('unavailable')}
   const common={connectionId:input.connectionId,campaignId:r.campaign_id,adgroupId:r.adgroup_id};
   if(r.target_type&&r.target_type!=='group'){
    const startedAt=Date.now();
    const read=async()=>{const groups=await catalog(token,{action:r.target_type==='keyword'?'keywordGroups':'groups',connectionId:input.connectionId,campaignId:r.campaign_id});const targets=await catalog(token,{action:r.target_type==='keyword'?'keywords':'products',connectionId:input.connectionId,campaignId:r.campaign_id,groupId:r.adgroup_id});const selected=targets?.items?.filter(x=>x.id===r.target_id),group=groups?.items?.filter(x=>x.id===r.adgroup_id);return groups?.ok&&targets?.ok&&selected?.length===1&&group?.length===1?{group:group[0],target:selected[0]}:null;};
    const first=await read(),second=await read(),finishedAt=Date.now();
    if(!first||!second)return fail('target_unavailable');
    const target=second.target,group=second.group,current=target.useGroupBid===true?group.bid:target.useGroupBid===false?target.bid:null;
    const usable=Number.isSafeInteger(current)&&current>=r.min_bid&&current<=r.max_bid&&current%10===0;
    const bounded=Math.max(r.min_bid,Math.min(r.max_bid,Math.ceil(r.reference_bid/10)*10)),limit=Math.floor(r.max_change/10)*10;
    const proposed=usable?current+Math.max(-limit,Math.min(limit,bounded-current)):null;
    const safety=assessIndividualBidSafety({kind:r.target_type,targetId:r.target_id,groupId:r.adgroup_id,first,second,startedAt,finishedAt,desiredBid:proposed});
    const result={status:'shadow_only',execution:'disabled',comparison:'not_applicable',currentBid:usable?current:null,proposedBid:proposed,referenceBid:r.reference_bid,minBid:r.min_bid,maxBid:r.max_bid,maxChange:r.max_change,blockers:[...new Set([...safety.blockers,...(!usable?['current_outside_bounds']:[])])]};
    if(await actor(token)!==user)return fail('unauthorized');
    const entryId=await store.append(user,r.id,r.version,binding.revision,result);return uuid(entryId)?{ok:true,entryId,result}:fail('state_changed');
   }
   const comparison=await compare(token,common);
   const simulated=await preview(token,{...common,scope:'adgroup',referenceBid:r.reference_bid,minBid:r.min_bid,maxBid:r.max_bid,maxChange:r.max_change});
   const blockers=['atomic_update_unavailable','source_completeness_unverified'];
   let comparisonStatus=['observed_consistent','mismatch'].includes(comparison?.status)?comparison.status:'unavailable';
   if(comparisonStatus==='observed_consistent'){
    const previewFingerprint=shoppingScopeFingerprint(simulated?.observedProducts);
    if(typeof comparison.liveFingerprint!=='string'||!previewFingerprint)comparisonStatus='unavailable';
    else if(comparison.liveFingerprint!==previewFingerprint)comparisonStatus='changed';
   }
   if(comparisonStatus!=='observed_consistent')blockers.push(comparisonStatus==='mismatch'?'source_mismatch':comparisonStatus==='changed'?'source_changed':'comparison_unavailable');
   if(Array.isArray(simulated?.blockers))blockers.push(...simulated.blockers.filter(x=>typeof x==='string'));
   const result={status:'shadow_only',execution:'disabled',comparison:comparisonStatus,comparisonReason:typeof comparison?.reason==='string'?comparison.reason:null,reportAt:typeof comparison?.reportAt==='string'?comparison.reportAt:null,liveCount:Number.isSafeInteger(comparison?.liveCount)?comparison.liveCount:null,masterCount:Number.isSafeInteger(comparison?.masterCount)?comparison.masterCount:null,referenceBid:r.reference_bid,minBid:r.min_bid,maxBid:r.max_bid,maxChange:r.max_change,currentBid:Number.isSafeInteger(simulated?.currentBid)?simulated.currentBid:null,proposedBid:Number.isSafeInteger(simulated?.proposedBid)?simulated.proposedBid:null,simulationReason:typeof simulated?.reason==='string'?simulated.reason:null,blockers:[...new Set(blockers)]};
   if(await actor(token)!==user)return fail('unauthorized');
   const entryId=await store.append(user,r.id,r.version,binding.revision,result);return uuid(entryId)?{ok:true,entryId,result}:fail('state_changed');
  }catch{return fail('unavailable')}
 };
}

export function createShoppingShadowStore(client){
 if(typeof client?.rpc!=='function')throw TypeError('invalid_client');
 async function rpc(name,args){const {data,error}=await client.rpc(name,args);if(error)throw Error('store_error');return data}
 return Object.freeze({
  save:(user,r)=>rpc('kits_shopping_shadow_save',{p_user_id:user,p_connection_id:r.connectionId,p_campaign_id:r.campaignId,p_adgroup_id:r.adgroupId,p_reference_bid:r.referenceBid,p_min_bid:r.minBid,p_max_bid:r.maxBid,p_max_change:r.maxChange,p_expected_version:r.expectedVersion,p_target_type:r.targetType,p_target_id:r.targetId}),
  list:(user,connection)=>rpc('kits_shopping_shadow_list',{p_user_id:user,p_connection_id:connection}),
  append:(user,rule,version,revision,result)=>rpc('kits_shopping_shadow_append',{p_user_id:user,p_rule_id:rule,p_rule_version:version,p_connection_revision:revision,p_result:result}),
  history:(user,rule)=>rpc('kits_shopping_shadow_history',{p_user_id:user,p_rule_id:rule})
 });
}
