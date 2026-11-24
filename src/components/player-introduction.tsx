"use client";

import {useEffect,useRef,type MouseEvent} from 'react';
import Link from 'next/link';
import {motion,useReducedMotion} from 'framer-motion';
import {ArrowDown,ArrowRight} from 'lucide-react';

/** A player-specific entry; the diagnosis starts only when the seller is ready. */
export function PlayerIntroduction({onStart}:{onStart:()=>void}){
 const reduced=useReducedMotion();
 const heading=useRef<HTMLHeadingElement>(null);
 const profitSection=useRef<HTMLElement>(null);
 useEffect(()=>{heading.current?.focus({preventScroll:true});},[]);
 function goToProfit(event:MouseEvent<HTMLAnchorElement>){
  const section=profitSection.current;
  if(!section||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  event.preventDefault();
  const hash=event.currentTarget.hash;
  if(window.location.hash!==hash)window.history.pushState(window.history.state,'',hash);
  section.focus({preventScroll:true});
  section.scrollIntoView({block:'start',behavior:reduced?'instant':'smooth'});
 }
 const reveal={hidden:{opacity:0,y:reduced?0:42,clipPath:reduced?'inset(0)':'inset(100% 0 0)'},visible:{opacity:1,y:0,clipPath:'inset(0)'}};
 return <main className="ds-player-intro" aria-labelledby="ds-player-intro-title">
  <section className="ds-player-opening">
   <h1 id="ds-player-intro-title" ref={heading} tabIndex={-1}>
    {['판매에서','얼마가 남고 있나요?'].map((text,i)=><span className="ds-player-mask" key={text}><motion.span initial="hidden" animate="visible" variants={reveal} transition={{duration:reduced?0:.3,delay:reduced?0:i*.07,ease:[.22,1,.36,1]}}>{text}</motion.span></span>)}
   </h1>
   <motion.div className="ds-player-opening-bottom" initial={{opacity:0,y:reduced?0:20}} animate={{opacity:1,y:0}} transition={{delay:reduced?0:.12,duration:reduced?0:.26}}><p>판매가와 비용을 입력해 상품의 손익을 확인해 보세요.</p><a href="#ds-player-profit" onClick={goToProfit}>점검 항목 보기 <ArrowDown size={19}/></a></motion.div>
   <div className="ds-player-signal" aria-hidden="true"><i/><i/><i/></div>
  </section>
  <section className="ds-player-manifesto" id="ds-player-profit" ref={profitSection} tabIndex={-1} aria-labelledby="ds-player-profit-title">
   <motion.div className="ds-player-statement" initial="hidden" whileInView="visible" viewport={{once:true,amount:.25}} transition={{staggerChildren:reduced?0:.16}}>
    <motion.h2 id="ds-player-profit-title" variants={reveal} transition={{duration:reduced?0:.65}}>판매 구조 점검</motion.h2>
    <motion.p className="ds-player-position" variants={reveal} transition={{duration:reduced?0:.55}}>이익, 운영 비용, 상품 경쟁력을 살펴보고 우선순위를 정하세요.</motion.p>
   </motion.div>
   <ol className="ds-player-principles">{[['01','광고 운영','광고비를 감당할 수 있는지 판매 이익을 확인하세요.'],['02','비용 절감','물류비, 포장비, 인건비에서 줄일 수 있는 항목을 찾아보세요.'],['03','브랜드 개선','고객이 상품의 강점을 이해할 수 있도록 메시지와 디자인을 점검하세요.']].map(([n,title,description])=><motion.li key={n} initial={reduced?false:{opacity:0,y:24}} whileInView={{opacity:1,y:0}} viewport={{once:true,amount:.4}} transition={{duration:.45}}><h3>{title}</h3><p>{description}</p></motion.li>)}</ol>
   <div className="ds-player-actions">
    <Link href="/tools/about/" className="mp-primary ds-player-start">키츠노드 소개 보기 <ArrowRight size={22} aria-hidden="true"/></Link>
    <button type="button" className="mp-secondary" onClick={onStart}>상품 진단 시작</button>
   </div>
  </section>
 </main>;
}
