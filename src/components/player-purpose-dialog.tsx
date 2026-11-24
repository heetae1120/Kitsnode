"use client";
import {useEffect,useRef} from 'react';
import {ArrowRight,X} from 'lucide-react';
import './player-purpose-dialog.css';

const purposes=[
 {id:'advertising',title:'광고 운영과 대행사 변경을 점검하고 싶어요',description:'현재 광고의 수익을 살펴보고, 운영 방향과 대행사 변경을 함께 검토해요.'},
 {id:'rebranding',title:'브랜드의 새로운 방향을 찾고 있어요',description:'상품과 메시지를 재정비하고 리브랜딩을 고민하고 있어요.'},
] as const;
export type PlayerPurpose=typeof purposes[number]['id'];

export function PlayerPurposeDialog({onSelect,onBack}:{onSelect:(purpose:PlayerPurpose)=>void;onBack:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),first=useRef<HTMLButtonElement>(null);
 useEffect(()=>{const element=dialog.current;element?.showModal();first.current?.focus();return()=>element?.close();},[]);
 return <dialog ref={dialog} className="ds-purpose-dialog" aria-labelledby="ds-purpose-title" aria-describedby="ds-purpose-description" onCancel={event=>{event.preventDefault();onBack();}} onKeyDown={event=>{
  if(event.key!=='Tab')return;
  const buttons=event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not([disabled])'),firstButton=buttons[0],lastButton=buttons[buttons.length-1];
  if(event.shiftKey&&document.activeElement===firstButton){event.preventDefault();lastButton?.focus();}
  else if(!event.shiftKey&&document.activeElement===lastButton){event.preventDefault();firstButton?.focus();}
 }}>
  <button type="button" className="ds-purpose-close" data-diagnosis-back aria-label="방문 목적 선택 닫기" onClick={onBack}><X size={22}/></button>
  <h2 id="ds-purpose-title">어떤 이유로<br/><em>찾아오셨나요?</em></h2>
  <p id="ds-purpose-description">지금 고민에 가장 가까운 항목을 선택해 주세요.</p>
  <div className="ds-purpose-options">{purposes.map((purpose,index)=><button ref={index===0?first:undefined} type="button" className="ds-purpose-option" key={purpose.id} onClick={()=>onSelect(purpose.id)}><span className="ds-purpose-index">0{index+1}</span><span className="ds-purpose-copy"><strong>{purpose.title}</strong><span>{purpose.description}</span></span><ArrowRight size={19} aria-hidden="true"/></button>)}</div>
 </dialog>;
}
