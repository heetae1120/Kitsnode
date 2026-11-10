"use client";
import {useLayoutEffect,useRef,useState,type ReactNode} from 'react';
import {motion,useReducedMotion} from 'framer-motion';
import {ArrowLeft,ArrowRight} from 'lucide-react';
import {ReportSignupPrompt} from './report-signup-prompt';
export function ProfitReportPages({overview,keywords,footer}:{overview:ReactNode;keywords:ReactNode;footer?:ReactNode}){
 const [page,setPage]=useState(0);const [height,setHeight]=useState<number>();
 const [signupOpen,setSignupOpen]=useState(false),[continued,setContinued]=useState(false);
 const root=useRef<HTMLDivElement>(null),first=useRef<HTMLDivElement>(null),second=useRef<HTMLDivElement>(null);const reduced=useReducedMotion();
 useLayoutEffect(()=>{
  const active=page===0?first.current:second.current;if(!active)return;
  const update=()=>setHeight(Math.ceil(active.getBoundingClientRect().height));update();const observer=new ResizeObserver(update);observer.observe(active);return()=>observer.disconnect();
 },[page]);
 function move(next:number){if(next===page)return;setPage(next);requestAnimationFrame(()=>{(next===0?first:second).current?.focus({preventScroll:true});root.current?.scrollIntoView({behavior:reduced?'instant':'smooth',block:'start'});});}
 function requestMove(next:number){if(next===1&&!continued){setSignupOpen(true);return;}move(next);}
 return <div className="mp-report-pages" ref={root}>
 <nav className="mp-report-page-nav" aria-label="보고서 페이지"><button type="button" aria-current={page===0?'page':undefined} onClick={()=>move(0)}><span>01</span> 수익·예산</button><span className="mp-page-line" aria-hidden="true"/><button type="button" aria-current={page===1?'page':undefined} onClick={()=>requestMove(1)}><span>02</span> 검색어·실행</button></nav>
 <div className="mp-report-page-viewport" style={{height}}><motion.div className="mp-report-page-track" animate={{x:page===0?'0%':'-100%'}} transition={{duration:reduced?0:0.65,ease:[0.22,1,0.36,1]}}>
 <div id="profit-report-overview" className="mp-report-page" ref={first} tabIndex={-1} inert={page!==0} aria-hidden={page!==0}>{overview}<div className="mp-report-page-actions"><span>다음 화면에서 검색어와 광고를 확인하세요</span><button type="button" className="mp-primary" onClick={()=>requestMove(1)}>다음 · 검색어 고르기<ArrowRight size={18}/></button></div></div>
 <div id="profit-report-keywords" className="mp-report-page" ref={second} tabIndex={-1} inert={page!==1} aria-hidden={page!==1}><div className="mp-report-keyword-screen"><span className="mp-report-camera" aria-hidden="true"/>{continued?keywords:null}<div className="mp-report-page-actions"><button type="button" className="mp-secondary" onClick={()=>move(0)}><ArrowLeft size={18}/>이전 · 수익·예산</button><span>02 / 02</span></div><span className="mp-report-home" aria-hidden="true"/></div>{footer}</div>
 </motion.div></div>{signupOpen&&<ReportSignupPrompt onClose={()=>setSignupOpen(false)} onContinue={()=>{setContinued(true);setSignupOpen(false);move(1);}}/>}</div>;
}
