// Dependency-injected test composition only. No route, scheduler, credentials,
// persistence implementation or production provider is installed here. The
// durable reserve dependency must atomically enforce request uniqueness and
// current authorization before any future deployment can use this service.
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(v);
const targetId=(value,prefix)=>typeof value==='string'&&new RegExp(`^${prefix}-[A-Za-z0-9-]{1,100}$`).test(value);
const bid=(n,kind)=>Number.isSafeInteger(n)&&n>=(kind==='keyword'?70:50)&&n<=100000&&n%10===0;
const fail=reason=>({status:'blocked',reason,retry:'disabled'});
export function createIndividualBidManualTestService({enabled=false,verifyUser,loadRule,loadBinding,loadApproval,loadSnapshot,reserve,finish,adapterForBinding,now=Date.now}={}){
 if(![verifyUser,loadRule,loadBinding,loadApproval,loadSnapshot,reserve,finish,adapterForBinding,now].every(x=>typeof x==='function'))throw TypeError('invalid_dependencies');
 return Object.freeze({async execute({token,requestId,ruleId,desiredBid,confirm,allowGroupConversion=false}={}){
  if(enabled!==true)return fail('write_disabled');
  if(typeof token!=='string'||!token||!uuid(requestId)||!uuid(ruleId)||confirm!==true||typeof allowGroupConversion!=='boolean')return fail('invalid_input');
  let user,rule,binding,approval,snapshot,started;try{
   user=await verifyUser(token);if(!user||!uuid(user.id))return fail('unauthenticated');
   rule=await loadRule(user.id,ruleId);
   if(!rule||rule.id!==ruleId||rule.userId!==user.id||!uuid(rule.connectionId)||!Number.isSafeInteger(rule.version)||rule.version<0||!['product','keyword'].includes(rule.kind)||!targetId(rule.groupId,'grp')||!targetId(rule.targetId,rule.kind==='product'?'nad':'nkw'))return fail('rule_unavailable');
   const {kind}=rule;
   if(!bid(rule.minBid,kind)||!bid(rule.maxBid,kind)||rule.minBid>rule.maxBid||!Number.isSafeInteger(rule.maxChange)||rule.maxChange<0||!bid(desiredBid,kind)||desiredBid<rule.minBid||desiredBid>rule.maxBid)return fail('bid_out_of_bounds');
   binding=await loadBinding(user.id,rule.connectionId);
   if(!binding||binding.userId!==user.id||binding.id!==rule.connectionId||binding.status!=='read_connected'||!Number.isSafeInteger(binding.revision)||binding.revision<0||!/^[1-9][0-9]{0,15}$/.test(String(binding.customerId??'')))return fail('connection_unavailable');
   approval=await loadApproval(user.id,binding.id);
   started=now();if(!Number.isSafeInteger(started)||started<0)return fail('invalid_clock');
   if(!approval||approval.userId!==user.id||approval.connectionId!==binding.id||approval.connectionRevision!==binding.revision||approval.writeAllowed!==true||!Number.isSafeInteger(approval.expiresAt)||approval.expiresAt<=started)return fail('write_approval_required');
   snapshot=await loadSnapshot(binding,rule);
   const checkTime=now();
   if(!snapshot||snapshot.customerId!==String(binding.customerId)||snapshot.groupId!==rule.groupId||snapshot.targetId!==rule.targetId||snapshot.kind!==kind||typeof snapshot.useGroupBid!=='boolean'||!(snapshot.bid===null||bid(snapshot.bid,kind))||(snapshot.useGroupBid&&!bid(snapshot.groupBid,'product'))||!Number.isSafeInteger(snapshot.observedAt)||!Number.isSafeInteger(checkTime)||checkTime<snapshot.observedAt||checkTime-snapshot.observedAt>60000)return fail('snapshot_unavailable');
   const current=snapshot.useGroupBid?snapshot.groupBid:snapshot.bid;
   if(!bid(current,snapshot.useGroupBid?'product':kind))return fail('current_bid_unavailable');
   if(Math.abs(desiredBid-current)>rule.maxChange)return fail('change_limit_exceeded');
   if(snapshot.useGroupBid&&allowGroupConversion!==true)return fail('conversion_not_authorized');
   // Keep immutable values even if a caller's repository reuses object references.
   user={...user};rule={...rule};binding={...binding};approval={...approval};snapshot={...snapshot};
   // Contract: the store atomically verifies account/rule versions and current
   // approval while inserting a unique, durable requestId before write.
   if(await reserve({requestId,userId:user.id,connectionId:binding.id,connectionRevision:binding.revision,ruleId:rule.id,ruleVersion:rule.version,kind,targetId:rule.targetId,groupId:rule.groupId,desiredBid,currentBid:current,conversionAuthorized:allowGroupConversion})!==true)return fail('reservation_rejected');
  }catch{return fail('verification_unavailable')}
  let result,adapter,recheckOk=false;
  try{
   adapter=await adapterForBinding(binding);if(typeof adapter?.changeAndVerify!=='function')throw Error('invalid_adapter');
   const currentUser=await verifyUser(token),currentRule=await loadRule(user.id,rule.id),currentBinding=await loadBinding(user.id,binding.id),currentApproval=await loadApproval(user.id,binding.id),checkTime=now();
   recheckOk=currentUser?.id===user.id&&currentRule?.id===rule.id&&currentRule?.userId===rule.userId&&currentRule?.connectionId===rule.connectionId&&currentRule?.version===rule.version&&currentRule?.kind===rule.kind&&currentRule?.targetId===rule.targetId&&currentRule?.groupId===rule.groupId&&currentRule?.minBid===rule.minBid&&currentRule?.maxBid===rule.maxBid&&currentRule?.maxChange===rule.maxChange&&currentBinding?.id===binding.id&&currentBinding?.userId===user.id&&currentBinding?.status==='read_connected'&&currentBinding?.revision===binding.revision&&String(currentBinding?.customerId)===String(binding.customerId)&&currentApproval?.userId===user.id&&currentApproval?.connectionId===binding.id&&currentApproval?.connectionRevision===binding.revision&&currentApproval?.writeAllowed===true&&Number.isSafeInteger(currentApproval?.expiresAt)&&Number.isSafeInteger(checkTime)&&checkTime>=snapshot.observedAt&&checkTime-snapshot.observedAt<=60000&&currentApproval.expiresAt>checkTime;
  }catch{/* Verification failure blocks the write and is recorded below. */}
  if(!recheckOk)result={status:'blocked',reason:'authorization_changed',retry:'disabled'};
  else try{
   // These checks reduce the window but cannot atomically bind a Naver write
   // to a database authorization or prevent a concurrent provider change.
   result=await adapter.changeAndVerify({kind:rule.kind,targetId:rule.targetId,groupId:rule.groupId,desiredBid,expectedBid:snapshot.bid,expectedUseGroupBid:snapshot.useGroupBid,allowGroupConversion});
   if(!result||!['blocked','observed_applied','mismatch','unconfirmed','not_sent'].includes(result.status)||result.retry!=='disabled')throw Error('invalid_result');
   if(result.status==='observed_applied'&&(result.observedBid!==desiredBid||result.observedUseGroupBid!==false))result={...result,status:'unconfirmed'};
  }catch{result={status:'unconfirmed',retry:'disabled'}}
  // No raw provider data or errors are passed to the audit store or caller.
  const outcome={status:result.status,...(result.reason==='authorization_changed'?{reason:'authorization_changed'}:{}),retry:'disabled',observedBid:bid(result.observedBid,rule.kind)?result.observedBid:null,observedUseGroupBid:typeof result.observedUseGroupBid==='boolean'?result.observedUseGroupBid:null};
  try{if(await finish({requestId,userId:user.id,outcome})!==true)return {status:'audit_unconfirmed',retry:'disabled'};}catch{return {status:'audit_unconfirmed',retry:'disabled'}}
  return outcome;
 }});
}
