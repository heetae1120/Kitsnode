"use client";
import {Children,useRef,useState,type ReactNode} from "react";
import {motion,useReducedMotion} from "framer-motion";
import {ArrowLeft,ArrowRight} from "lucide-react";
export function ReportTabletSlides({children}:{children:ReactNode}){
 const slides=Children.toArray(children),[page,setPage]=useState(0);
 const root=useRef<HTMLDivElement>(null),screen=useRef<HTMLDivElement>(null),touch=useRef<number|null>(null);
 const reduced=useReducedMotion();
 const last=page===slides.length-1;
 function finish(){root.current?.dispatchEvent(new Event("kitsnode:report-continue",{bubbles:true}));}
 function move(next:number){setPage(Math.max(0,Math.min(slides.length-1,next)));screen.current?.scrollTo({top:0});}
 return <div className="kn-tablet-slides" ref={root}>
 <div ref={screen} className="kn-tablet-slide-screen" role="region" aria-label={"수익 보고서 "+(page+1)+" / "+slides.length} tabIndex={0}
 onWheel={e=>{const el=e.currentTarget;if(last&&e.deltaY>30&&el.scrollTop+el.clientHeight>=el.scrollHeight-3){finish();}}}
 onTouchStart={e=>{touch.current=e.touches[0].clientY}}
 onTouchEnd={e=>{const el=e.currentTarget;if(last&&touch.current!==null&&touch.current-e.changedTouches[0].clientY>50&&el.scrollTop+el.clientHeight>=el.scrollHeight-3)finish();touch.current=null}}
 onKeyDown={e=>{if(last&&(e.key==="PageDown"||e.key==="ArrowDown")&&e.currentTarget.scrollTop+e.currentTarget.clientHeight>=e.currentTarget.scrollHeight-3){e.preventDefault();finish();}}}>
 <motion.div key={page} initial={{x:reduced?0:60,opacity:reduced?1:0}} animate={{x:0,opacity:1}} transition={{duration:reduced?0:.5,ease:[.22,1,.36,1]}} className="kn-tablet-slide">{slides[page]}</motion.div>
 </div><nav className="kn-tablet-slide-actions" aria-label="진단 결과 넘기기"><button type="button" className="mp-secondary" disabled={page===0} onClick={()=>move(page-1)}><ArrowLeft size={16}/>이전</button><span aria-live="polite">{page+1} / {slides.length}</span><button type="button" className="mp-primary" onClick={()=>last?finish():move(page+1)}>{last?"진단 이어가기":"다음 페이지"}<ArrowRight size={16}/></button></nav>
 </div>;
}
