const nonceOk=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const senderOk=s=>{try{const u=new URL(s.url);return Number.isInteger(s.tab?.id)&&s.frameId===0&&u.origin==='https://heetae1120.github.io'&&u.pathname==='/Kitsnode/store/ads/'&&!u.search&&!u.hash;}catch{return false}};
export async function accountDiscovery({chromeApi,message,sender,now=Date.now}={}){
 if(!senderOk(sender)||!nonceOk(message?.nonce)||Object.keys(message).sort().join(',')!=='nonce,type'||!['kitsnode.account.start.v1','kitsnode.account.get.v1'].includes(message.type))return {status:'blocked'};
 const key=`account_discovery_${message.nonce}`;
 try{
  if(message.type==='kitsnode.account.start.v1'){
   const all=await chromeApi.storage.session.get(null),stamp=now();
   if(Object.entries(all).some(([k,v])=>k.startsWith('account_discovery_')&&v?.siteTabId===sender.tab.id&&v.expiresAt>stamp))return {status:'blocked'};
   const tab=await chromeApi.tabs.create({url:'https://ads.naver.com/settings/ad-account'});
   if(!Number.isInteger(tab?.id))return {status:'blocked'};
   await chromeApi.storage.session.set({[key]:{siteTabId:sender.tab.id,naverTabId:tab.id,expiresAt:stamp+600000}});
   return {status:'started'};
  }
  const record=(await chromeApi.storage.session.get(key))[key];
  if(!record||record.siteTabId!==sender.tab.id||now()>=record.expiresAt)return {status:'blocked'};
  const tab=await chromeApi.tabs.get(record.naverTabId),u=new URL(tab.url);
  if(u.origin!=='https://ads.naver.com'||u.search||u.hash)return {status:'selecting'};
  const match=u.pathname.match(/^\/manage\/ad-accounts\/([1-9][0-9]{0,15})\/(?:dashboard|all-campaigns|settings\/billing\/balance|settings\/authorities\/members\/invited)$/);
  if(!match)return {status:'selecting'};
  await chromeApi.storage.session.remove(key);
  return {status:'selected',accountId:match[1]};
 }catch{return {status:'blocked'}}
}
