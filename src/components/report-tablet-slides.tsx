"use client";
import {Children,useRef,useState,type ReactNode} from "react";
import {AnimatePresence,motion,useReducedMotion} from "framer-motion";
import {ArrowLeft,ArrowRight} from "lucide-react";
import '@/app/tools/report-motion.css';
export function ReportTabletSlides({children,heading,beforeNext,onBack,onFinish,initialPage=0,finalActions}:{children:ReactNode;heading:(page:number)=>ReactNode;beforeNext?:(proceed:()=>void)=>void;onBack:()=>void;onFinish:()=>void;initialPage?:0|2;finalActions?:ReactNode}){
 const slides=Children.toArray(children),[page,setPage]=useState<number>(initialPage),[direction,setDirection]=useState(1);
 const root=useRef<HTMLDivElement>(null),screen=useRef<HTMLDivElement>(null);
 const reduced=useReducedMotion(),last=page===slides.length-1;
 function move(next:number){
  const target=Math.max(0,Math.min(slides.length-1,next));if(target===page)return;
  setDirection(target>page?1:-1);setPage(target);
  screen.current?.focus({preventScroll:true});
  root.current?.scrollIntoView({behavior:'instant',block:'start'});
 }
 function next(){if(page===0&&beforeNext){beforeNext(()=>move(1));return;}if(last)onFinish();else move(page+1);}
 return <div className="kn-tablet-slides ds-report-chapters" ref={root}>
  <p className="sd-report-progress" aria-live="polite">결과 {page+1} / {slides.length}</p>
  {heading(page)}
  <div ref={screen} className="kn-tablet-slide-screen" role="region" aria-label={"진단 결과 "+(page+1)+" / "+slides.length} tabIndex={0}>
   <AnimatePresence mode="wait" initial={false} custom={direction}>
    <motion.div key={page} custom={direction} initial="enter" animate="visible" exit="exit"
     variants={{enter:(d:number)=>({x:reduced?0:(d>0?'100%':'-100%'),opacity:reduced?1:0}),visible:{x:0,opacity:1},exit:(d:number)=>({x:reduced?0:(d>0?'-100%':'100%'),opacity:reduced?1:0})}}
     transition={{duration:reduced?0:.19,ease:[.22,1,.36,1]}} className="kn-tablet-slide">{slides[page]}</motion.div>
   </AnimatePresence>
  </div>
  <nav className="kn-tablet-slide-actions" aria-label="진단 결과 넘기기">
   <button type="button" className="mp-secondary ds-report-previous" data-diagnosis-back onClick={page===0?onBack:()=>move(page-1)}><ArrowLeft size={16}/>{page===0?'비용 수정':'이전 결과'}</button>
   <button type="button" className="mp-primary" onClick={next}>{last?'광고 분석 안내 보기':page===0?'재고 일정 보기':'판매 계획 보기'}<ArrowRight size={16}/></button>
  </nav>
  {last&&finalActions}
 </div>;
}
