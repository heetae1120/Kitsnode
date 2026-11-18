"use client";

import {useEffect,useRef} from 'react';
import {motion,useReducedMotion} from 'framer-motion';
import {ArrowDown,ArrowRight} from 'lucide-react';

/** A player-specific entry; the diagnosis starts only when the seller is ready. */
export function PlayerIntroduction({onStart}:{onStart:()=>void}){
 const reduced=useReducedMotion();
 const heading=useRef<HTMLHeadingElement>(null);
 useEffect(()=>{heading.current?.focus({preventScroll:true});},[]);
 const reveal={hidden:{opacity:0,y:reduced?0:42,clipPath:reduced?'inset(0)':'inset(100% 0 0)'},visible:{opacity:1,y:0,clipPath:'inset(0)'}};
 return <main className="ds-player-intro" aria-labelledby="ds-player-intro-title">
  <section className="ds-player-opening">
   <h1 id="ds-player-intro-title" ref={heading} tabIndex={-1}>
    {['광고대행사 전화,','오늘도 받으셨나요?'].map((text,i)=><span className="ds-player-mask" key={text}><motion.span initial="hidden" animate="visible" variants={reveal} transition={{duration:reduced?0:.65,delay:reduced?0:.15+i*.18,ease:[.22,1,.36,1]}}>{text}</motion.span></span>)}
   </h1>
   <motion.div className="ds-player-opening-bottom" initial={{opacity:0,y:reduced?0:20}} animate={{opacity:1,y:0}} transition={{delay:reduced?0:.65,duration:reduced?0:.5}}><p>“ROAS 올려드릴게요.”<br/>지금 중요한 건, 그 숫자가 아닙니다.</p><a href="#ds-player-profit">그럼 무엇부터 봐야 할까요? <ArrowDown size={19}/></a></motion.div>
   <div className="ds-player-signal" aria-hidden="true"><i/><i/><i/></div>
  </section>
  <section className="ds-player-manifesto" id="ds-player-profit">
   <motion.div initial="hidden" whileInView="visible" viewport={{once:true,amount:.25}} transition={{staggerChildren:reduced?0:.16}}>
    <motion.h2 variants={reveal} transition={{duration:reduced?0:.65}}>그래서,<br/><em>얼마가 남았나요?</em></motion.h2>
    <motion.p className="ds-player-position" variants={reveal} transition={{duration:reduced?0:.55}}>상품과 자금 상황을 살펴<br/>지금 광고가 필요한지부터 판단합니다.</motion.p>
   </motion.div>
   <ol className="ds-player-principles">{[['01','상품 하나의 이익','원가와 수수료, 광고비를 반영해\n한 개 팔 때 실제로 남는 이익을 확인합니다.'],['02','원가 절감의 기회','3PL(제3자 물류), 패키지, 인건비 등\n비용 구조를 점검하고 절감 가능성을 찾습니다.'],['03','광고의 방향성','지금 광고를 집행해도 되는 상태인지 판단하고,\n적합한 광고 유형과 운영 방향을 점검합니다.']].map(([n,title,description])=><motion.li key={n} initial={reduced?false:{opacity:0,y:24}} whileInView={{opacity:1,y:0}} viewport={{once:true,amount:.4}} transition={{duration:.45}}><span>{n}</span><h3>{title}</h3><p>{description}</p></motion.li>)}</ol>
   <button type="button" className="mp-primary ds-player-start" onClick={onStart}>내 광고 수익 점검하기 <ArrowRight size={22}/></button>
  </section>
 </main>;
}
