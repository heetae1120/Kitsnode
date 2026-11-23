export function createSharedRateLimiter(client) {
 if(typeof client?.rpc!=='function')throw new TypeError('invalid_client');
 return async userId=>{
  if(typeof userId!=='string'||!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(userId))return false;
  const {data,error}=await client.rpc('kits_ads_rate_limit',{p_user_id:userId});
  if(error)throw Error('rate_limit_unavailable');return data===true;
 };
}
