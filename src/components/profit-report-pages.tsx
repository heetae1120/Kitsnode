"use client";
import {useRef,useState,type ReactNode} from 'react';
import {AdvertisingDiagnosisIntro} from './advertising-diagnosis-intro';

type Props={
 productName:string;
 initialAdIntro?:boolean;
 onAdCheck:()=>void;
 overview:(showAdIntro:()=>void)=>ReactNode;
};

export function ProfitReportPages({productName,initialAdIntro=false,onAdCheck,overview}:Props){
 const [introOpen,setIntroOpen]=useState(initialAdIntro);
 const report=useRef<HTMLDivElement>(null);
 function backToReport(){
  setIntroOpen(false);
  requestAnimationFrame(()=>{
   report.current?.focus({preventScroll:true});
   report.current?.scrollIntoView({behavior:'instant',block:'start'});
  });
 }
 return <div className="mp-report-pages" ref={report} tabIndex={-1}>
  {introOpen&&<AdvertisingDiagnosisIntro productName={productName} onBack={backToReport} onContinue={onAdCheck}/>}
  <div hidden={introOpen} inert={introOpen}>{overview(()=>setIntroOpen(true))}</div>
 </div>;
}

