// Isolated v2 candidate; no production listener or live server adapter.
import {createConsentProof} from './consent-proof-bridge-v2-candidate.mjs';
import {captureAdvertiser} from './automatic-start.mjs';
export async function createCandidateConsentWorkflowV2({chromeApi,nonce,tabId,accountId,viewerId,expiresAt,wait,redeemTransport,beginTransport,now=Date.now}={}){
 if(typeof wait!=='function'||typeof redeemTransport!=='function'||typeof beginTransport!=='function'||!Number.isFinite(expiresAt))throw Error('invalid_dependencies');
 const web='web_start_'+nonce,prep='candidate_prepare_v2_'+nonce,pkey='candidate_proof_v2_'+nonce,skey='candidate_signal_v2_'+nonce;
 const binding=(await chromeApi.storage.session.get(web))[web],stamp=now();
 if(!binding||binding.state!=='account_selected'||binding.naverTabId!==tabId||binding.accountId!==accountId||!Number.isInteger(binding.siteTabId)||stamp<binding.createdAt||stamp>=binding.expiresAt||stamp>=expiresAt)throw Error('invalid_binding');
 const tabs=await chromeApi.tabs.query({active:true,currentWindow:true});
 if(tabs.length!==1||tabs[0].id!==tabId||tabs[0].url!==`https://ads.naver.com/manage/ad-accounts/${accountId}/settings/authorities/members/invited`)throw Error('invalid_tab');
 const observed=await chromeApi.scripting.executeScript({target:{tabId},func:captureAdvertiser});
 if(observed?.length!==1||observed[0]?.result?.accountId!==accountId||observed[0]?.result?.viewerId!==viewerId)throw Error('invalid_viewer');
 let proof,attempted=false;
 const validBinding=b=>b&&b.state==='account_selected'&&b.accountId===accountId&&b.naverTabId===tabId&&b.siteTabId===binding.siteTabId;
 return Object.freeze({
  async authorizePolicy(details){
   if(attempted||details?.accountId!==accountId||details?.viewerId!==viewerId)return false;attempted=true;
   for(let i=0;i<600;i++){
    if(now()>=expiresAt||now()>=binding.expiresAt)return false;
    const values=await chromeApi.storage.session.get([web,prep,pkey,skey]),current=values[web],prepared=values[prep];
    if(!validBinding(current))return false;
    if(!proof&&prepared){
     if(prepared.siteTabId!==binding.siteTabId||prepared.naverTabId!==tabId||prepared.accountId!==accountId)return false;
     try{proof=await createConsentProof({consentId:prepared.consentId,accountId,viewerId,consentDigest:prepared.consentDigest,consentVersion:prepared.consentVersion,naverPolicyVersion:prepared.naverPolicyVersion,naverPolicyDigest:prepared.naverPolicyDigest});}catch{return false;}
     await chromeApi.storage.session.set({[pkey]:{state:'pending',siteTabId:binding.siteTabId,naverTabId:tabId,accountId,request:proof.request,expiresAt:Math.min(expiresAt,binding.expiresAt)}});
    }
    if(proof&&values[skey]?.requestId===proof.request.requestId)return proof.redeem(redeemTransport);
    await wait();
   }
   return false;
  },
  async beginSend(details){
   if(!proof||details?.accountId!==accountId||details?.viewerId!==viewerId||details?.recipientId!=='kitsnode'||now()>=expiresAt||now()>=binding.expiresAt)return false;
   if(!validBinding((await chromeApi.storage.session.get(web))[web]))return false;
   return proof.beginSend(beginTransport);
  },
 });
}
