import {createRankObservationTracking,recordRankObservation,summarizeRankObservationTracking} from './rank-observation-tracker.mjs';

// Simulation-only service. Storage and authorization are injected; no provider
// write, actual observation source, HTTP route or scheduler is installed.
// Store commits MUST atomically check owner, target, current authorization,
// expected revision and request ID. The test store does not authenticate its
// caller and does not protect a revocation race; it is never production-ready.
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(x);
const target=x=>typeof x==='string'&&/^(?:nkw|nad)-[A-Za-z0-9-]{1,100}$/.test(x);
const fail=reason=>({status:'unavailable',reason});
export function createRankTrackingTestService({verifyUser,authorizeTarget,store,now=Date.now}={}){
 if(![verifyUser,authorizeTarget,now,store?.create,store?.get,store?.commit].every(x=>typeof x==='function'))throw TypeError('invalid_dependencies');
 async function owner(token,connectionId,targetId){
  if(typeof token!=='string'||!token||!uuid(connectionId)||!target(targetId))return null;
  const u=await verifyUser(token);if(!u||!uuid(u.id))return null;
  return await authorizeTarget(u.id,connectionId,targetId)===true?u.id:null;
 }
 return Object.freeze({
  async start({token,connectionId,targetId,trackingId,changeAt,bid,targets}={}){
   try{const userId=await owner(token,connectionId,targetId);if(!userId||!uuid(trackingId))return fail('not_authorized');
    const t=now();if(!Number.isSafeInteger(t)||!Number.isSafeInteger(changeAt)||changeAt>t)return fail('invalid_time');
    const tracking=createRankObservationTracking({id:trackingId,changeAt,bid,targets,mode:'simulation'});
    const created=await store.create({userId,connectionId,targetId,tracking});return created===true?{status:'created',trackingId}:fail('not_created');
   }catch{return fail('not_created')}
  },
  async observe({token,connectionId,targetId,trackingId,requestId,minutes,device,result}={}){
   try{const userId=await owner(token,connectionId,targetId);if(!userId||!uuid(trackingId)||!uuid(requestId))return fail('not_authorized');
    const row=await store.get({userId,connectionId,targetId,trackingId});if(!row||!Number.isSafeInteger(row.version)||row.tracking?.mode!=='simulation')return fail('not_found');
    const t=now();if(!Number.isSafeInteger(t)||t<0)return fail('invalid_time');
    const tracking=recordRankObservation(row.tracking,{minutes,device,requestedAt:t,receivedAt:t,result});
    if(await authorizeTarget(userId,connectionId,targetId)!==true)return fail('not_authorized');
    const commit=await store.commit({userId,connectionId,targetId,trackingId,requestId,expectedVersion:row.version,tracking});
    if(commit==='saved')return {status:'recorded',trackingId};
    return fail(commit==='duplicate'?'duplicate_request':commit==='conflict'?'concurrent_change':'not_saved');
   }catch{return fail('invalid_or_unavailable')}
  },
  async history({token,connectionId,targetId,trackingId}={}){
   try{const userId=await owner(token,connectionId,targetId);if(!userId||!uuid(trackingId))return fail('not_authorized');
    const row=await store.get({userId,connectionId,targetId,trackingId});if(!row||row.tracking?.mode!=='simulation')return fail('not_found');
    return {status:'ok',trackingId,mode:'simulation',summary:summarizeRankObservationTracking(row.tracking)};
   }catch{return fail('not_available')}
  }
 });
}
