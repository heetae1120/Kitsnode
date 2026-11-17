"use client";
import {useEffect,useRef,useState,type RefObject} from 'react';

/** One guide across input steps, dialogs and report forms; never moves typing focus. */
export function useDiagnosisInputGuide(root:RefObject<HTMLDivElement|null>,enabled:boolean,revision:string){
 const [message,setMessage]=useState('');
 const sync=useRef<(()=>void)|null>(null);
 useEffect(()=>{
  const el=root.current;if(!el||!enabled){setMessage('');return;}
  let active:HTMLElement|null=null,timer:ReturnType<typeof setTimeout>|undefined,frame=0;
  function clear(){if(timer)clearTimeout(timer);active?.removeAttribute('data-guide-active');active?.removeAttribute('data-guide-idle');}
  function find(){
   // Keep the current edit highlighted until blur/Tab, including after its first digit.
   const editing=document.activeElement;
   if(editing instanceof HTMLElement&&el!.contains(editing)&&editing.matches('input:not([type=hidden]):not([type=range]):not([type=checkbox]):not([type=radio]),select,textarea')&&!editing.closest('[inert],[aria-hidden=true],dialog:not([open])'))return editing.closest<HTMLElement>('[data-guide-field]')??editing;
   const candidates=el!.querySelectorAll<HTMLElement>('[data-guide-field],input:not([type=hidden]):not([type=range]):not([type=checkbox]):not([type=radio]),select,textarea');
   for(const field of candidates){
    if(!field.getClientRects().length||field.closest('[inert],[aria-hidden=true],dialog:not([open])'))continue;
    if(field.parentElement?.closest('[data-guide-field]'))continue;
    if(field.hasAttribute('data-guide-field')){if(field.dataset.guideComplete!=='true')return field;continue;}
    const input=field as HTMLInputElement;
    if(input.disabled||input.readOnly||input.value.trim()!=='')continue;
    return field;
   }
   return null;
  }
  function update(reset=false){
   const field=find();
   const wrapper=field?.closest<HTMLElement>('.mp-budget-input')??field?.closest<HTMLElement>('[data-guide-field],.mp-return-handling,.mp-field,.mp-name,.mp-target-input,.mp-conversion-input')??field?.closest<HTMLElement>('.mp-input-wrap,label')??field;
   if(wrapper===active&&!reset)return;
   clear();active=wrapper;
   if(!field||!active){setMessage('');return;}
   const input=field as HTMLInputElement;
   const label=field.dataset.guideField||input.labels?.[0]?.textContent?.trim()||field.getAttribute('aria-label')||'다음 항목';
   active.dataset.guideActive='true';
   setMessage(`다음 입력: ${label}`);
   timer=setTimeout(()=>{
    if(!active)return;
    const unanswered=field.hasAttribute('data-guide-field')?field.dataset.guideComplete!=='true':!(field as HTMLInputElement).value.trim();
    if(!unanswered)return;
    active.dataset.guideIdle='true';
    const hasExample=!!active.querySelector('[data-guide-example],.mp-quick-costs button:first-child');
    setMessage(hasExample?`${label}을 모르겠다면, 주황색 ‘참고값 넣기’를 눌러 입력하세요. 참고값은 실제 비용과 다를 수 있어요.`:`${label}을 입력해 주세요. 입력하면 다음 빈칸을 안내합니다.`);
   },5000);
  }
  const queue=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>update());};
  const activity=()=>update(true);
  const observer=new MutationObserver(queue);
  observer.observe(el,{childList:true,subtree:true,attributes:true,attributeFilter:['data-guide-complete','aria-hidden','inert','open']});
  el.addEventListener('input',activity);el.addEventListener('change',activity);el.addEventListener('click',queue);el.addEventListener('focusin',queue);el.addEventListener('focusout',queue);
  sync.current=queue;queue();
  return()=>{clear();cancelAnimationFrame(frame);observer.disconnect();el.removeEventListener('input',activity);el.removeEventListener('change',activity);el.removeEventListener('click',queue);el.removeEventListener('focusin',queue);el.removeEventListener('focusout',queue);sync.current=null;};
 },[root,enabled]);
 useEffect(()=>{sync.current?.();},[revision]);
 return message;
}
