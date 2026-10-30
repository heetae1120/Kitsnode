"use client";
import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
export type IntakeAnswers={store:boolean|null;ads:boolean|null;agency:boolean|null;satisfaction:string};
type Screen='store'|'support'|'ads'|'agency'|'satisfaction';
export function HealthIntake({answers,onChange,onComplete}:{answers:IntakeAnswers;onChange:(value:IntakeAnswers)=>void;onComplete:()=>void}){
  const [screen,setScreen]=useState<Screen>('store');
  const screens:Screen[]=['store',...(answers.store===false?['support' as const]:[]),'ads',...(answers.ads===true?['agency' as const]:[]),...(answers.ads===true&&answers.agency===true?['satisfaction' as const]:[])];
  const index=screens.indexOf(screen);
  const valid=screen==='store'?answers.store!==null:screen==='ads'?answers.ads!==null:screen==='agency'?answers.agency!==null:screen==='satisfaction'?!!answers.satisfaction:true;
  function next(){const following=screens[index+1];if(following)setScreen(following);else onComplete();}
  function choose(value:boolean|string){
    if(screen==='store'){onChange({store:!!value,ads:null,agency:null,satisfaction:''});setScreen(value?'ads':'support');}
    if(screen==='ads'){onChange({...answers,ads:!!value,agency:null,satisfaction:''});if(value)setScreen('agency');else onComplete();}
    if(screen==='agency'){onChange({...answers,agency:!!value,satisfaction:''});if(value)setScreen('satisfaction');else onComplete();}
    if(screen==='satisfaction'){onChange({...answers,satisfaction:String(value)});onComplete();}
  }
  const options=screen==='store'?[['O · 운영해 봤어요',true],['X · 아직 없어요',false]]:screen==='ads'?[['네, 집행한 경험이 있습니다.',true],['아니요, 아직 집행해 본 적이 없습니다.',false]]:screen==='agency'?[['광고 대행사를 통해 운영하고 있습니다.',true],['직접 운영하고 있습니다.',false]]:screen==='satisfaction'?[['네','네'],['아니요','아니요'],['잘 모르겠어요','잘 모르겠어요']]:[];
  const current=screen==='store'?answers.store:screen==='ads'?answers.ads:screen==='agency'?answers.agency:answers.satisfaction;
  return <section className="hc-card hc-intake-slide" id="intake"><span className="hc-eyebrow">YOUR SITUATION</span><div className="hc-slide-body" key={screen}><span className="hc-slide-number">{String(index+1).padStart(2,'0')}</span><h2>{screen==='store'?'스마트스토어를 운영해 본 적이 있나요?':screen==='ads'?'지금까지 광고를 집행해 본 경험이 있으신가요?':screen==='agency'?'현재 광고는 어떤 방식으로 운영하고 계신가요?':screen==='satisfaction'?'현재 대행사가 충분한 성과를 내고 있다고 생각하시나요?':'광고 운영, 혼자 고민하지 마세요.'}</h2>{screen==='support'?<p>처음 시작한다면 예상 가격과 원가로 먼저 점검해 보세요. 진단을 마친 뒤 필요한 광고 운영 지원도 함께 정리할 수 있습니다.</p>:<p>답변을 선택하면 다음 질문으로 넘어갑니다. 왼쪽 화살표로 언제든 수정할 수 있어요.</p>}<div className="hc-slide-options">{options.map(([label,value])=><button type="button" key={String(label)} aria-pressed={current===value} onClick={()=>choose(value)}>{current===value&&<Check size={18}/>}<span>{label}</span><ArrowRight size={18}/></button>)}</div></div><div className="hc-slide-nav"><button type="button" aria-label="이전 질문" disabled={index<=0} onClick={()=>setScreen(screens[index-1])}><ArrowLeft size={22}/></button><span>{index+1} / {screens.length}</span><button type="button" aria-label={screen==='support'?'진단 계속하기':'다음 질문'} disabled={!valid} onClick={next}><ArrowRight size={22}/></button></div></section>;
}
