const endpoint='https://bjpguxwqxlsteektkhwf.supabase.co/functions/v1/kitsnode-ad-api';
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(v);
const id=(v,p)=>typeof v==='string'&&new RegExp(`^${p}-[A-Za-z0-9-]{1,100}$`).test(v);
const validToken=v=>typeof v==='string'&&/^[A-Za-z0-9._-]{1,8192}$/.test(v);
const itemValid=(action,x)=>{
 if(!x||typeof x!=='object')return false;
 if(action==='connections')return uuid(x.id)&&typeof x.accountId==='string'&&/^[1-9]\d{0,15}$/.test(x.accountId);
 const prefix={campaigns:'cmp',groups:'grp',products:'nad'}[action];
 return Boolean(prefix&&id(x.id,prefix)&&typeof x.name==='string'&&x.name.length<=160&&typeof x.status==='string'&&x.status.length<=50&&(action==='campaigns'||x.bid===null||Number.isSafeInteger(x.bid))&&(action!=='products'||x.useGroupBid===null||typeof x.useGroupBid==='boolean'));
};
export function createShoppingPreviewClient({enabled,fetcher=globalThis.fetch}={}){
 if(enabled!==true)return undefined;
 if(typeof fetcher!=='function')throw TypeError('invalid_client');
 async function call(path,token,body,signal){
  if(!validToken(token)||!signal||typeof signal.aborted!=='boolean'||signal.aborted)throw Error('invalid_request');
  const r=await fetcher(`${endpoint}/${path}`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal,credentials:'omit',redirect:'error',cache:'no-store',referrerPolicy:'no-referrer'});
  if(!r.ok)throw Error('unavailable');const x=await r.json();if(signal.aborted)throw Error('aborted');return x;
 }
 return Object.freeze({
  async catalog(token,body,signal){const x=await call('shopping-catalog',token,body,signal);if(!Array.isArray(x?.items)||x.items.length>500||!x.items.every(v=>itemValid(body?.action,v)))throw Error('invalid_response');return x.items;},
  async preview(token,body,signal){const x=(await call('shopping-bid-preview',token,body,signal))?.result;if(!x||!['unavailable','skipped','proposed','unchanged','illustrative'].includes(x.status))throw Error('invalid_response');if(['illustrative','proposed','unchanged'].includes(x.status)&&(!Number.isSafeInteger(x.currentBid)||!Number.isSafeInteger(x.proposedBid)||x.execution!=='disabled'))throw Error('invalid_response');if(x.status==='illustrative'&&(!Array.isArray(x.blockers)||!x.blockers.every(v=>typeof v==='string')))throw Error('invalid_response');return x;}
 });
}
