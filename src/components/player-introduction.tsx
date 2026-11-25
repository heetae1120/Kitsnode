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
    {['또 상위노출, 또 ROAS.','그래서 얼마가 남았나요?'].map((text,i)=><span className="ds-player-mask" key={text}><motion.span initial="hidden" animate="visible" variants={reveal} transition={{duration:reduced?0:.3,delay:reduced?0:i*.07,ease:[.22,1,.36,1]}}>{text}</motion.span></span>)}
   </h1>
   <motion.div className="ds-player-opening-bottom" initial={{opacity:0,y:reduced?0:20}} animate={{opacity:1,y:0}} transition={{delay:reduced?0:.12,duration:reduced?0:.26}}><p>검색 순위가 오르고 광고 수익률(ROAS)이 좋아졌다면, 정산 뒤에 남는 돈도 늘었을까요?</p><a href="#ds-player-profit" onClick={goToProfit}>보고서 다시 보기 <ArrowDown size={19}/></a></motion.div>
   <div className="ds-player-signal" aria-hidden="true"><i/><i/><i/></div>
  </section>
  <section className="ds-player-manifesto" id="ds-player-profit" ref={profitSection} tabIndex={-1} aria-labelledby="ds-player-profit-title">
   <motion.div className="ds-player-statement" initial="hidden" whileInView="visible" viewport={{once:true,amount:.25}} transition={{staggerChildren:reduced?0:.16}}>
    <motion.h2 id="ds-player-profit-title" variants={reveal} transition={{duration:reduced?0:.65}}>그 보고서에서, 빠진 질문들.</motion.h2>
   </motion.div>
   <ol className="ds-player-principles">{[
    ['“상위에 올랐습니다”','광고를 끈 뒤에도 내 상품을 찾아오는 고객이 있나요?'],
    ['“ROAS가 개선됐습니다”','광고비에 원가, 수수료, 반품비까지 빼면 주문 한 건에 얼마가 남나요?'],
    ['“매출이 늘었습니다”','더 많이 팔린 만큼 이익도 늘었나요?'],
   ].map(([title,description])=><motion.li key={title} initial={reduced?false:{opacity:0,y:24}} whileInView={{opacity:1,y:0}} viewport={{once:true,amount:.4}} transition={{duration:reduced?0:.45}}><h3>{title}</h3><p>{description}</p></motion.li>)}</ol>
   <div className="ds-player-actions">
    <Link href="/tools/about/#kp-approach" className="mp-primary ds-player-start">키츠노드는 어떻게 보나요? <ArrowRight size={22} aria-hidden="true"/></Link>
    <button type="button" className="mp-secondary" onClick={onStart}>상품 진단 시작</button>
   </div>
  </section>
 </main>;
}
