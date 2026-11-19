// Fixed destination; the browser cannot choose where its bearer token goes.
const endpoint='https://bjpguxwqxlsteektkhwf.supabase.co/functions/v1/kitsnode-ad-api/performance';
const id=(v,p)=>typeof v==='string'&&new RegExp(`^${p}-[A-Za-z0-9-]{1,100}$`).test(v);
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(v);
const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
export function createAdPerformanceClient({enabled,fetcher=globalThis.fetch}={}) {
 if(enabled!==true)return undefined;
 if(typeof fetcher!=='function')throw Error('invalid_client');
 return Object.freeze({async read(token,body,signal){
  if(typeof token!=='string'||!/^[A-Za-z0-9._-]{1,8192}$/.test(token)||!signal||typeof signal.aborted!=='boolean'||signal.aborted||!body||!uuid(body.connectionId)||!['product','keyword'].includes(body.kind)||!id(body.campaignId,'cmp')||!id(body.groupId,'grp')||!id(body.targetId,body.kind==='product'?'nad':'nkw')||!date(body.since)||!date(body.until)||body.since>body.until)throw Error('invalid_request');
  const {connectionId,kind,campaignId,groupId,targetId,since,until}=body;
  const response=await fetcher(endpoint,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({connectionId,kind,campaignId,groupId,targetId,since,until}),signal,credentials:'omit',redirect:'error',cache:'no-store',referrerPolicy:'no-referrer'});
  if(!response.ok)throw Error('unavailable');const payload=await response.json();if(signal.aborted)throw Error('aborted');
  const result=payload?.result;if(!result||!['observed','no_data','unavailable'].includes(result.status))throw Error('invalid_response');
  if(result.status!=='unavailable'&&(result.targetId!==targetId||result.period?.since!==since||result.period?.until!==until||result.source!=='naver_stats'))throw Error('invalid_response');
  return result;
 }});
}
