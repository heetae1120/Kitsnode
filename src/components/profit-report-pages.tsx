"use client";
import {useEffect,useLayoutEffect,useRef,useState,type ReactNode} from 'react';
import {motion,useReducedMotion} from 'framer-motion';
import {ArrowLeft,ArrowRight} from 'lucide-react';
import {ReportSignupPrompt} from './report-signup-prompt';
import {AdvertisingDiagnosisIntro} from './advertising-diagnosis-intro';
export function ProfitReportPages({overview,keywords,footer,actions,productName='',initialPage=0,beforeKeywords}:{productName?:string;initialPage?:0|1;overview:ReactNode;keywords:ReactNode;footer?:ReactNode;actions?:ReactNode;beforeKeywords?:(proceed:()=>void)=>void}){
 const [page,setPage]=useState<number>(initialPage);const [height,setHeight]=useState<number>();
 const [signupOpen,setSignupOpen]=useState(false),[continued,setContinued]=useState(initialPage===1);
 const [introOpen,setIntroOpen]=useState(false),[introSeen,setIntroSeen]=useState(initialPage===1);
 const root=useRef<HTMLDivElement>(null),first=useRef<HTMLDivElement>(null),second=useRef<HTMLDivElement>(null);const reduced=useReducedMotion();
 useLayoutEffect(()=>{
  const active=page===0?first.current:second.current;if(!active)return;
  const update=()=>setHeight(Math.ceil(active.getBoundingClientRect().height));update();const observer=new ResizeObserver(update);observer.observe(active);return()=>observer.disconnect();
 },[page,introOpen]);
 useEffect(()=>{const el=root.current;const proceed=()=>requestMove(1);el?.addEventListener("kitsnode:report-continue",proceed);return()=>el?.removeEventListener("kitsnode:report-continue",proceed)},[page,continued,beforeKeywords,introSeen,reduced]);
 function move(next:number){if(next===page)return;setPage(next);requestAnimationFrame(()=>{(next===0?first:second).current?.focus({preventScroll:true});root.current?.scrollIntoView({behavior:reduced?'instant':'smooth',block:'start'});});}
 function requestMove(next:number){const proceed=()=>{if(next===1&&!introSeen){setIntroOpen(true);return;}if(next===1&&!continued){setSignupOpen(true);return;}move(next);};if(next===1&&beforeKeywords){beforeKeywords(proceed);return;}proceed();}
 return <div className="mp-report-pages" ref={root}>
 {introOpen&&<AdvertisingDiagnosisIntro productName={productName} onBack={()=>{setIntroOpen(false);requestAnimationFrame(()=>first.current?.focus({preventScroll:true}));}} onContinue={()=>{setIntroSeen(true);setIntroOpen(false);if(!continued)setSignupOpen(true);else move(1);}}/>}
 <div className="mp-report-existing" hidden={introOpen} inert={introOpen}>
 <nav className="mp-report-page-nav" aria-label="보고서 페이지"><button type="button" aria-current={page===0?'page':undefined} onClick={()=>move(0)}><span>01</span> 수익·예산</button><span className="mp-page-line" aria-hidden="true"/><button type="button" aria-current={page===1?'page':undefined} onClick={()=>requestMove(1)}><span>02</span> 검색어·실행</button></nav>
 <div className="mp-report-page-viewport" style={{height}}><motion.div className="mp-report-page-track" animate={{x:page===0?'0%':'-100%'}} transition={{duration:reduced?0:0.65,ease:[0.22,1,0.36,1]}}>
 <div id="profit-report-overview" className="mp-report-page" ref={first} tabIndex={-1} inert={page!==0} aria-hidden={page!==0}>{overview}</div>
 <div id="profit-report-keywords" className="mp-report-page" ref={second} tabIndex={-1} inert={page!==1} aria-hidden={page!==1}><div className="mp-report-keyword-screen"><span className="mp-report-camera" aria-hidden="true"/>{continued?keywords:null}<div className="mp-report-page-actions ds-report-action-row"><button type="button" className="mp-secondary" onClick={()=>move(0)}><ArrowLeft size={18}/>이전 · 수익·예산</button>{actions&&<div className="ds-report-download-slot">{actions}</div>}<span>02 / 02</span></div><span className="mp-report-home" aria-hidden="true"/></div>{footer}</div>
 </motion.div></div></div>{signupOpen&&<ReportSignupPrompt onClose={()=>setSignupOpen(false)} onContinue={()=>{setContinued(true);setSignupOpen(false);move(1);}}/>}</div>;
}

