"use client";
import {useRef,useState,type ReactNode} from 'react';
import {AdvertisingDiagnosisIntro,AdvertisingReviewGuide} from './advertising-diagnosis-intro';

type Props={
 productName:string;
 months:number;
 initialAdIntro?:boolean;
 onAdCheck:()=>void;
 introActions?:ReactNode;
 overview:(showAdGuide:()=>void)=>ReactNode;
};

type ReportPage='overview'|'guide'|'intro';
export function ProfitReportPages({productName,months,initialAdIntro=false,onAdCheck,introActions,overview}:Props){
 const [page,setPage]=useState<ReportPage>(initialAdIntro?'intro':'overview');
 const report=useRef<HTMLDivElement>(null);
 function showPage(next:ReportPage){
  setPage(next);
  requestAnimationFrame(()=>{
   const heading=report.current?.querySelector<HTMLElement>(':scope > section h2');
   (heading??report.current)?.focus({preventScroll:true});
   report.current?.scrollIntoView({behavior:'instant',block:'start'});
  });
 }
 return <div className="mp-report-pages" ref={report} tabIndex={-1}>
  {page==='guide'&&<AdvertisingReviewGuide months={months} onBack={()=>showPage('overview')} onContinue={()=>showPage('intro')}/>}
  {page==='intro'&&<>
   <AdvertisingDiagnosisIntro productName={productName} onBack={()=>showPage('guide')} onContinue={onAdCheck}/>
   {introActions}
  </>}
  <div hidden={page!=='overview'} inert={page!=='overview'}>{overview(()=>showPage('guide'))}</div>
 </div>;
}

