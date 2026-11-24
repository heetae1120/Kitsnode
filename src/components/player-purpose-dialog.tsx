"use client";
import {useEffect,useRef} from 'react';
import {ArrowRight,X} from 'lucide-react';
import './player-purpose-dialog.css';

const purposes=[
 {id:'advertising',title:'광고 운영 점검',description:'광고비와 이익을 확인하고 대행사 변경을 검토해요.'},
 {id:'rebranding',title:'브랜드 방향 점검',description:'상품, 메시지, 디자인에서 바꿀 부분을 살펴봐요.'},
] as const;
export type PlayerPurpose=typeof purposes[number]['id'];

export function PlayerPurposeDialog({onSelect,onBack}:{onSelect:(purpose:PlayerPurpose)=>void;onBack:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),first=useRef<HTMLButtonElement>(null);
 useEffect(()=>{const element=dialog.current;element?.showModal();first.current?.focus();return()=>element?.close();},[]);
 return <dialog ref={dialog} className="ds-purpose-dialog" aria-labelledby="ds-purpose-title" onCancel={event=>{event.preventDefault();onBack();}} onKeyDown={event=>{
  if(event.key!=='Tab')return;
  const buttons=event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not([disabled])'),firstButton=buttons[0],lastButton=buttons[buttons.length-1];
  if(event.shiftKey&&document.activeElement===firstButton){event.preventDefault();lastButton?.focus();}
  else if(!event.shiftKey&&document.activeElement===lastButton){event.preventDefault();firstButton?.focus();}
 }}>
  <button type="button" className="ds-purpose-close" data-diagnosis-back aria-label="방문 목적 선택 닫기" onClick={onBack}><X size={22}/></button>
  <h2 id="ds-purpose-title">무엇을 점검하고 싶으세요?</h2>
  <div className="ds-purpose-options">{purposes.map((purpose,index)=><button ref={index===0?first:undefined} type="button" className="ds-purpose-option" key={purpose.id} onClick={()=>onSelect(purpose.id)}><span className="ds-purpose-copy"><strong>{purpose.title}</strong><span>{purpose.description}</span></span><ArrowRight size={19} aria-hidden="true"/></button>)}</div>
 </dialog>;
}
