// Isolated read-only candidate, not mounted in production. The binding adapter
// must read server-owned approval evidence and current owner consent, not user
// metadata or client-supplied account/customer IDs.
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
const account=x=>typeof x==='string'&&/^[1-9][0-9]{0,15}$/.test(x);
const entity=x=>typeof x==='string'&&/^cmp-[A-Za-z0-9-]{1,100}$/.test(x);
const unavailable=reason=>({ok:false,reason});
export function createOperatorCampaignService({verifySession,verifyOperator,getApprovedBinding,memberAllowed,readerForCustomer}) {
 if(![verifySession,verifyOperator,getApprovedBinding,memberAllowed,readerForCustomer].every(x=>typeof x==='function'))throw TypeError('invalid_dependencies');
 const actor=async token=>{const p=await verifySession(token);return uuid(p?.id)&&await verifyOperator(p.id)===true?p.id:null};
 const bindingValid=(b,id)=>b&&b.id===id&&uuid(b.userId)&&account(b.customerId)&&b.status==='read_connected'&&b.evidenceVerified===true&&Number.isSafeInteger(b.revision)&&b.revision>=0;
 return async(token,input)=>{
  try {
   const operator=await actor(token);if(!operator)return unavailable('unauthorized');
   if(!input||Object.keys(input).join(',')!=='connectionId'||!uuid(input.connectionId))return unavailable('invalid_input');
   const binding=await getApprovedBinding(input.connectionId);if(!bindingValid(binding,input.connectionId)||await memberAllowed(binding.userId)!==true)return unavailable('connection_required');
   const result=await readerForCustomer(binding.customerId).campaigns();if(!result?.ok||!Array.isArray(result.data)||result.data.length>10000)return unavailable('upstream_unavailable');
   if(result.data.some(x=>!entity(x.nccCampaignId)||String(x.customerId)!==binding.customerId)||new Set(result.data.map(x=>x.nccCampaignId)).size!==result.data.length)return unavailable('invalid_response');
   if(await actor(token)!==operator||await memberAllowed(binding.userId)!==true)return unavailable('unauthorized');
   const current=await getApprovedBinding(input.connectionId);if(!bindingValid(current,input.connectionId)||current.userId!==binding.userId||current.customerId!==binding.customerId||current.revision!==binding.revision)return unavailable('connection_changed');
   return {ok:true,items:result.data.map(x=>({id:x.nccCampaignId,name:typeof x.name==='string'?x.name.slice(0,160):'',status:typeof x.status==='string'&&/^[A-Z_]{1,50}$/.test(x.status)?x.status:'UNKNOWN',type:typeof x.campaignTp==='string'&&/^[A-Z_]{1,50}$/.test(x.campaignTp)?x.campaignTp:'UNKNOWN'}))};
  } catch {return unavailable('unavailable')}
 };
}
