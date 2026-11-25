"use client";
import {useRef,useState,type ReactNode} from 'react';
import {AdvertisingDiagnosisIntro} from './advertising-diagnosis-intro';

type Props={
 productName:string;
 months:number;
 initialAdIntro?:boolean;
 onAdCheck:()=>void;
 introActions?:ReactNode;
 overview:(showAdIntro:()=>void)=>ReactNode;
};

export function ProfitReportPages({productName,months,initialAdIntro=false,onAdCheck,introActions,overview}:Props){
 const [introOpen,setIntroOpen]=useState(initialAdIntro);
 const report=useRef<HTMLDivElement>(null);
 function showPage(showIntro:boolean){
  setIntroOpen(showIntro);
  requestAnimationFrame(()=>{
   report.current?.focus({preventScroll:true});
   report.current?.scrollIntoView({behavior:'instant',block:'start'});
  });
 }
 return <div className="mp-report-pages" ref={report} tabIndex={-1}>
  {introOpen&&<>
   <AdvertisingDiagnosisIntro productName={productName} months={months} onBack={()=>showPage(false)} onContinue={onAdCheck}/>
   {introActions}
  </>}
  <div hidden={introOpen} inert={introOpen}>{overview(()=>showPage(true))}</div>
 </div>;
}

