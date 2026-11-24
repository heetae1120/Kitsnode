import {naverPolicyVersion, naverPolicyDigest} from './consent-proof-bridge-v2-candidate.mjs';
// Isolated v2 candidate. The website cannot authorize an invitation by sending
// this message: it only supplies an opaque consent ID and wakes the controller.
const id=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const account=x=>typeof x==='string'&&/^[1-9][0-9]{0,15}$/.test(x);
function senderOk(sender,b,origin,path){try{const u=new URL(sender.url);return sender.frameId===0&&Number.isInteger(sender.tab?.id)&&sender.tab.id===b.siteTabId&&u.origin===origin&&u.pathname===path&&!u.search&&!u.hash;}catch{return false;}}
export async function candidateWebMessageV2({chromeApi,message,sender,now=Date.now,origin='https://heetae1120.github.io',path='/Kitsnode/store/ads/'}={}){
 try{
  const kind=message?.type,keys=Object.keys(message||{}).sort().join(',');
  if(!id(message?.nonce)||!['kitsnode.proof.start.v2','kitsnode.proof.prepare.v2','kitsnode.proof.get.v2','kitsnode.proof.approved.v2'].includes(kind))return {status:'blocked'};
  if(['kitsnode.proof.start.v2','kitsnode.proof.prepare.v2'].includes(kind)&&(keys!=='accountId,consentDigest,consentId,consentVersion,naverPolicyDigest,naverPolicyVersion,nonce,type'||message.naverPolicyVersion!==naverPolicyVersion||message.naverPolicyDigest!==naverPolicyDigest||!id(message.consentId)||!account(message.accountId)||!/^sha256:[a-f0-9]{64}$/.test(message.consentDigest||'')||!/^[A-Za-z0-9._-]{1,64}$/.test(message.consentVersion||'')))return {status:'blocked'};
  if(kind==='kitsnode.proof.get.v2'&&keys!=='nonce,type')return {status:'blocked'};
  if(kind==='kitsnode.proof.approved.v2'&&(keys!=='nonce,requestId,type'||!id(message.requestId)))return {status:'blocked'};
  const web='web_start_'+message.nonce,prep='candidate_prepare_v2_'+message.nonce,proof='candidate_proof_v2_'+message.nonce,signal='candidate_signal_v2_'+message.nonce;
  const vals=await chromeApi.storage.session.get([web,prep,proof]),b=vals[web],nowMs=now();
  if(kind==='kitsnode.proof.start.v2'){
   if(!senderOk(sender,{siteTabId:sender?.tab?.id},origin,path)||!Number.isSafeInteger(nowMs))return {status:'blocked'};
   const same=r=>r?.siteTabId===sender.tab.id&&r.expectedAccountId===message.accountId&&r.expectedConsentId===message.consentId&&r.expectedConsentVersion===message.consentVersion&&r.expectedConsentDigest===message.consentDigest&&r.naverPolicyVersion===message.naverPolicyVersion&&r.naverPolicyDigest===message.naverPolicyDigest&&nowMs>=r.createdAt&&nowMs<r.expiresAt;
   if(b)return same(b)?{status:'started'}:{status:'blocked'};
   const all=await chromeApi.storage.session.get(null);
   if(Object.entries(all).some(([key,r])=>key.startsWith('web_start_')&&r?.siteTabId===sender.tab.id&&r.expiresAt>nowMs))return {status:'blocked'};
   const selectedKey=`selected_account_${sender.tab.id}`,selected=all[selectedKey];
   if(selected?.siteTabId===sender.tab.id&&selected.accountId===message.accountId&&Number.isInteger(selected.naverTabId)&&Number.isSafeInteger(selected.expiresAt)&&nowMs<selected.expiresAt){
    try{
     const selectedTab=await chromeApi.tabs.get(selected.naverTabId),u=new URL(selectedTab.url);
     if(u.origin==='https://ads.naver.com'&&!u.search&&!u.hash&&new RegExp(`^/manage/ad-accounts/${message.accountId}/(?:dashboard|all-campaigns|settings/billing/balance|settings/authorities/members/invited)$`).test(u.pathname)){
      await chromeApi.storage.session.set({[web]:{siteTabId:sender.tab.id,naverTabId:selected.naverTabId,createdAt:nowMs,expiresAt:Math.min(selected.expiresAt,nowMs+600000),state:'account_routing',accountId:message.accountId,expectedAccountId:message.accountId,expectedConsentId:message.consentId,expectedConsentVersion:message.consentVersion,expectedConsentDigest:message.consentDigest,naverPolicyVersion:message.naverPolicyVersion,naverPolicyDigest:message.naverPolicyDigest}});
      await chromeApi.storage.session.remove(selectedKey);
      await chromeApi.tabs.update(selected.naverTabId,{url:`https://ads.naver.com/manage/ad-accounts/${message.accountId}/settings/authorities/members/invited`,active:true});
      return {status:'started'};
     }
    }catch{await chromeApi.storage.session.remove(web);return {status:'unavailable'};}
   }
   let tab;try{tab=await chromeApi.tabs.create({url:'https://ads.naver.com/settings/ad-account'});if(!Number.isInteger(tab?.id))return {status:'unavailable'};await chromeApi.storage.session.set({[web]:{siteTabId:sender.tab.id,naverTabId:tab.id,createdAt:nowMs,expiresAt:nowMs+600000,state:'login_opened',expectedAccountId:message.accountId,expectedConsentId:message.consentId,expectedConsentVersion:message.consentVersion,expectedConsentDigest:message.consentDigest,naverPolicyVersion:message.naverPolicyVersion,naverPolicyDigest:message.naverPolicyDigest}});return {status:'started'};}catch{if(Number.isInteger(tab?.id))try{await chromeApi.tabs.remove(tab.id)}catch{};return {status:'unavailable'};}
  }
  if(kind==='kitsnode.proof.prepare.v2'&&b&&['login_opened','account_routing'].includes(b.state)&&senderOk(sender,b,origin,path)&&nowMs>=b.createdAt&&nowMs<b.expiresAt&&b.expectedAccountId===message.accountId&&b.expectedConsentId===message.consentId&&b.expectedConsentVersion===message.consentVersion&&b.expectedConsentDigest===message.consentDigest&&b.naverPolicyVersion===message.naverPolicyVersion&&b.naverPolicyDigest===message.naverPolicyDigest)return {status:'selecting'};
  if(!b||b.state!=='account_selected'||!Number.isSafeInteger(b.createdAt)||!Number.isSafeInteger(b.expiresAt)||nowMs<b.createdAt||nowMs>=b.expiresAt||!senderOk(sender,b,origin,path))return {status:'blocked'};
  if(kind==='kitsnode.proof.prepare.v2'){
   if(message.naverPolicyVersion!==naverPolicyVersion||message.naverPolicyDigest!==naverPolicyDigest||(b.naverPolicyVersion&&b.naverPolicyVersion!==message.naverPolicyVersion)||(b.naverPolicyDigest&&b.naverPolicyDigest!==message.naverPolicyDigest)||message.accountId!==b.accountId||(b.expectedAccountId&&b.expectedAccountId!==message.accountId)||(b.expectedConsentId&&b.expectedConsentId!==message.consentId)||(b.expectedConsentVersion&&b.expectedConsentVersion!==message.consentVersion)||(b.expectedConsentDigest&&b.expectedConsentDigest!==message.consentDigest))return {status:'blocked'};
   if(vals[prep])return vals[prep].consentId===message.consentId&&vals[prep].accountId===message.accountId&&vals[prep].consentVersion===message.consentVersion&&vals[prep].consentDigest===message.consentDigest&&vals[prep].naverPolicyVersion===message.naverPolicyVersion&&vals[prep].naverPolicyDigest===message.naverPolicyDigest?{status:'pending'}:{status:'blocked'};
   if(vals[proof])return {status:'blocked'};
   await chromeApi.storage.session.set({[prep]:{consentId:message.consentId,accountId:message.accountId,consentDigest:message.consentDigest,consentVersion:message.consentVersion,naverPolicyVersion:message.naverPolicyVersion,naverPolicyDigest:message.naverPolicyDigest,siteTabId:b.siteTabId,naverTabId:b.naverTabId}});
   return {status:'pending'};
  }
  const pending=vals[proof];if(!pending)return kind==='kitsnode.proof.get.v2'&&vals[prep]?{status:'pending'}:{status:'blocked'};
  if(pending.state!=='pending'||pending.siteTabId!==b.siteTabId||pending.naverTabId!==b.naverTabId||pending.accountId!==b.accountId||nowMs>=pending.expiresAt)return {status:'blocked'};
  if(kind==='kitsnode.proof.get.v2')return {status:'ready',request:pending.request};
  if(message.requestId!==pending.request?.requestId)return {status:'blocked'};
  await chromeApi.storage.session.set({[signal]:{requestId:message.requestId}});return {status:'signalled'};
 }catch{return {status:'unavailable'};}
}
