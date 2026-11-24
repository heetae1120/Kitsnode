"use client";
import {Children,useRef,useState,type ReactNode} from "react";
import {AnimatePresence,motion,useReducedMotion} from "framer-motion";
import {ArrowLeft,ArrowRight} from "lucide-react";
import '@/app/tools/report-motion.css';
export function ReportTabletSlides({children,beforeNext,onBack}:{children:ReactNode;beforeNext?:(proceed:()=>void)=>void;onBack:()=>void}){
 const slides=Children.toArray(children),[page,setPage]=useState(0),[direction,setDirection]=useState(1);
 const root=useRef<HTMLDivElement>(null),screen=useRef<HTMLDivElement>(null);
 const reduced=useReducedMotion(),last=page===slides.length-1;
 function finish(){root.current?.dispatchEvent(new Event("kitsnode:report-continue",{bubbles:true}));}
 function move(next:number){
  const target=Math.max(0,Math.min(slides.length-1,next));if(target===page)return;
  setDirection(target>page?1:-1);setPage(target);
  screen.current?.focus({preventScroll:true});
  root.current?.scrollIntoView({behavior:'instant',block:'start'});
 }
 function next(){if(page===0&&beforeNext){beforeNext(()=>move(1));return;}if(last)finish();else move(page+1);}
 return <div className="kn-tablet-slides ds-report-chapters" ref={root}>
  <div ref={screen} className="kn-tablet-slide-screen" role="region" aria-label={"수익 보고서 "+(page+1)+" / "+slides.length} tabIndex={0}>
   <AnimatePresence mode="wait" initial={false} custom={direction}>
    <motion.div key={page} custom={direction} initial="enter" animate="visible" exit="exit"
     variants={{enter:(d:number)=>({x:reduced?0:(d>0?'100%':'-100%'),opacity:reduced?1:0}),visible:{x:0,opacity:1},exit:(d:number)=>({x:reduced?0:(d>0?'-100%':'100%'),opacity:reduced?1:0})}}
     transition={{duration:reduced?0:.38,ease:[.22,1,.36,1]}} className="kn-tablet-slide">{slides[page]}</motion.div>
   </AnimatePresence>
  </div>
  <nav className="kn-tablet-slide-actions" aria-label="진단 결과 넘기기">
   <button type="button" className="mp-primary" onClick={next}>{last?'확인하러 가기':page===0?'그럼 재고는 어떨까요?':'이제 판매 목표를 확인해볼까요?'}<ArrowRight size={16}/></button>
   <span aria-live="polite">{page+1} / {slides.length}</span>
   <button type="button" className="mp-secondary ds-report-previous" data-diagnosis-back onClick={page===0?onBack:()=>move(page-1)}><ArrowLeft size={16}/>{page===0?'이전 · 비용 입력':'이전'}</button>
  </nav>
 </div>;
}
