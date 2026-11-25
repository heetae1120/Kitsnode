// Extension-side wiring candidate; runtime/worker and web bridge are separate.
// The caller must establish the single-use user consent, account and tab binding.
import {automaticInviteStep, prepareAutomaticInvite} from './automatic-invite.mjs';
import {executeInviteStep} from './preflight.mjs';
import {sendInvite} from './send-invite.mjs';

export async function runAutomaticInviteInTab({chromeApi, tabId, accountId, viewerId, consent, locks, waitForPolicy, wait, authorizePolicy, beforeSend, onStage, maxPolls, expiresAt=Infinity, now=Date.now}) {
  if (!chromeApi?.tabs || !chromeApi?.scripting || !Number.isInteger(tabId) || typeof waitForPolicy !== 'function' || typeof wait !== 'function') return {status:'blocked'};
  const url=`https://ads.naver.com/manage/ad-accounts/${accountId}/settings/authorities/members/invited`;
  const bindingStatus = async () => {
    if(now()>=expiresAt)return 'binding_expired';
    const tabs=await chromeApi.tabs.query({active:true,currentWindow:true});
    if(tabs.length!==1||tabs[0].id!==tabId)return 'tab_changed';
    return tabs[0].url===url?'bound':'tab_navigated';
  };
  const bound=async()=>await bindingStatus()==='bound';
  const execute=async(action,expectedAccount,expectedViewer)=>{
    const binding=await bindingStatus();if(binding!=='bound')return action==='fill'?binding:'unverified';
    const result=await chromeApi.scripting.executeScript({target:{tabId},func:automaticInviteStep,args:[{action,accountId:expectedAccount,viewerId:expectedViewer}]});
    return result?.length===1 && typeof result[0].result==='string' ? result[0].result : 'unverified';
  };
  const send=async expected => {
    if (!await bound() || expected.accountId!==accountId || expected.viewerId!==viewerId) return {status:'tab_changed'};
    const result=await sendInvite({chromeApi,execute:async(...args)=>now()<expiresAt?executeInviteStep(...args):'unverified',locks,
      confirmAction:async details=>now()<expiresAt&&details.accountId===accountId&&details.viewerId===viewerId&&details.recipientId==='kitsnode'&&consent?.approved===true&&(!beforeSend||await beforeSend(details)===true)});
    return {status:result};
  };
  return prepareAutomaticInvite({execute,waitForPolicy,wait,send,consent,accountId,viewerId,authorizePolicy,onStage,maxPolls});
}
