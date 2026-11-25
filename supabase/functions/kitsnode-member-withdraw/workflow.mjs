const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
// All adapters must use the verified subject, be retryable, and fail closed.
// This module alone does not provision database functions or a deployed endpoint.
export function createSelfWithdrawalWorkflow({intent,blockAccess,stopAds,deleteRelated,deleteAuth,verifyAbsent}) {
 if(!intent?.begin||!intent?.complete||![blockAccess,stopAds,deleteRelated,deleteAuth,verifyAbsent].every(x=>typeof x==='function'))throw Error('invalid_dependencies');
 return async subject=>{
  if(!uuid(subject))return {status:'unavailable'};
  try {
   const record=await intent.begin(subject);
   if(record?.durable!==true||record.subject!==subject||!uuid(record.requestId))return {status:'unavailable'};
   const context={subject,requestId:record.requestId};
   if(record.completed===true)return await verifyAbsent(context)===true?{status:'complete'}:{status:'pending'};
   if(await blockAccess(context)!==true)return {status:'pending'};
   if(await stopAds(context)!=='stopped')return {status:'pending'};
   if(await deleteRelated(context)!==true)return {status:'pending'};
   if(await deleteAuth(context)!==true)return {status:'pending'};
   if(await verifyAbsent(context)!==true)return {status:'pending'};
   if(await intent.complete(context)!==true)return {status:'pending'};
   return {status:'complete'};
  }catch{return {status:'pending'}}
 };
}
