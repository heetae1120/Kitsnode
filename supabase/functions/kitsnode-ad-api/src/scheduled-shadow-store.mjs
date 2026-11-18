// Server-only RPC adapter. No timer, browser session, provider connection or
// mutation endpoint is created here. Construct with a server service client.
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(v);
const integer=v=>Number.isSafeInteger(v)&&v>=0;
const validContext=x=>x&&uuid(x.ruleId)&&uuid(x.connectionId)&&integer(x.ruleVersion)&&integer(x.slotStartMs)&&x.slotStartMs%3600000===0;
const validClaim=x=>validContext(x)&&uuid(x.claimId);
export function createScheduledShadowStore(client){
 if(typeof client?.rpc!=='function')throw TypeError('invalid_client');
 async function rpc(name,args){const {data,error}=await client.rpc(name,args);if(error)throw Error('store_error');return data}
 const contextArgs=x=>({p_rule_id:x.ruleId,p_rule_version:x.ruleVersion,p_connection_id:x.connectionId,p_slot_start_ms:x.slotStartMs});
 return Object.freeze({
  async loadCandidates({slotStartMs,limit,afterId=null}={}){if(!integer(slotStartMs)||slotStartMs%3600000!==0||!integer(limit)||limit<1||limit>1000||(afterId!==null&&!uuid(afterId)))throw Error('invalid_input');return rpc('kits_shadow_schedule_candidates',{p_slot_start_ms:slotStartMs,p_limit:limit,p_after_id:afterId})},
  async claimSlot(context){if(!validContext(context))throw Error('invalid_input');return rpc('kits_shadow_schedule_claim_v2',contextArgs(context))},
  async inspectUnresolved(){return rpc('kits_shadow_schedule_unresolved',{})},
  async checkRule(context){
   if(!validContext(context))return null;
   const x=await rpc('kits_shadow_schedule_check_rule',contextArgs(context));
   if(!x||!uuid(x.userId)||!integer(x.connectionRevision)||x.ruleId!==context.ruleId||x.ruleVersion!==context.ruleVersion||x.connectionId!==context.connectionId||x.slotStartMs!==context.slotStartMs)return null;
   return x;
  },
  async checkClaim(context){
   if(!validClaim(context))return null;
   const x=await rpc('kits_shadow_schedule_check',{p_claim_id:context.claimId,...contextArgs(context)});
   if(!x||!uuid(x.userId)||!integer(x.connectionRevision))return null;
   if(x.ruleId!==context.ruleId||x.ruleVersion!==context.ruleVersion||x.connectionId!==context.connectionId||x.slotStartMs!==context.slotStartMs)return null;
   return x;
  },
  async appendClaim(context){
   if(!validClaim(context)||!uuid(context.userId)||!integer(context.connectionRevision)||!context.result||context.result.status!=='shadow_only'||context.result.execution!=='disabled')return null;
   return rpc('kits_shadow_schedule_append',{p_claim_id:context.claimId,...contextArgs(context),p_user_id:context.userId,p_connection_revision:context.connectionRevision,p_result:context.result});
  },
  async finish(context){
   if(!validClaim(context)||!['recorded','skipped','uncertain'].includes(context.state))return false;
   return (await rpc('kits_shadow_schedule_finish',{p_claim_id:context.claimId,...contextArgs(context),p_state:context.state,p_entry_id:context.entryId??null,p_reason:context.reason??null}))===true;
  }
 });
}
