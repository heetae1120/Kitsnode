'use client';
import {useEffect,useRef} from 'react';

const historyKey='kitsnodeDiagnosisStep';

export function useDiagnosisBack(active:boolean,onBack:()=>void,enabled:boolean){
 const current=useRef({active,onBack});
 const armed=useRef(false);
 useEffect(()=>{current.current={active,onBack};},[active,onBack]);
 useEffect(()=>{
  if(enabled&&active&&!window.history.state?.[historyKey]){
   window.history.pushState({...window.history.state,[historyKey]:true},'');
  }
  if(enabled)armed.current=Boolean(window.history.state?.[historyKey]);
 },[active,enabled]);
 useEffect(()=>{
  if(!enabled)return;
  const pathname=window.location.pathname;
  function previousStep(){
   const shell=document.querySelector('.mp-shell.diagnosis-studio');
   const dialog=shell?.querySelector<HTMLDialogElement>('dialog[open]');
   if(dialog){
    const close=dialog.querySelector<HTMLButtonElement>('[data-diagnosis-back]');
    if(close)close.click();
    else dialog.close();
    return true;
   }
   const previous=Array.from(shell?.querySelectorAll<HTMLButtonElement>('[data-diagnosis-back]')??[])
    .find(button=>!button.closest('[inert],[hidden],[aria-hidden=true]')&&button.getClientRects().length>0);
   if(previous){previous.click();return true;}
   if(!current.current.active)return false;
   current.current.onBack();
   return true;
  }
  function onContextMenu(event:MouseEvent){
   if(event.defaultPrevented||event.button!==2||event.ctrlKey||event.metaKey||event.shiftKey||!(event.target instanceof Element))return;
   if(!event.target.closest('.mp-shell.diagnosis-studio')||event.target.closest('a,input,textarea,select,[contenteditable]')||window.getSelection()?.toString())return;
   if(previousStep())event.preventDefault();
  }
  function onPopState(event:PopStateEvent){
   if(window.location.pathname!==pathname)return;
   const wasArmed=armed.current;
   armed.current=Boolean(event.state?.[historyKey]);
   if(armed.current||!wasArmed)return;
   if(previousStep()){
    window.history.pushState({...event.state,[historyKey]:true},'');
    armed.current=true;
   }else{
    window.history.back();
   }
  }
  window.addEventListener('contextmenu',onContextMenu);
  window.addEventListener('popstate',onPopState);
  return ()=>{
   window.removeEventListener('contextmenu',onContextMenu);
   window.removeEventListener('popstate',onPopState);
  };
 },[enabled]);
}
