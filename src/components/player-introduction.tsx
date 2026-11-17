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
   <motion.p className="ds-player-kicker" initial={{opacity:0}} animate={{opacity:1}} transition={{duration:reduced?0:.5}}>PLAYER / 광고를 시작하기 전에</motion.p>
   <h1 id="ds-player-intro-title" ref={heading} tabIndex={-1}>
    {['광고대행사 전화,','오늘도 받으셨나요?'].map((text,i)=><span className="ds-player-mask" key={text}><motion.span initial="hidden" animate="visible" variants={reveal} transition={{duration:reduced?0:.65,delay:reduced?0:.15+i*.18,ease:[.22,1,.36,1]}}>{text}</motion.span></span>)}
   </h1>
   <motion.div className="ds-player-opening-bottom" initial={{opacity:0,y:reduced?0:20}} animate={{opacity:1,y:0}} transition={{delay:reduced?0:.65,duration:reduced?0:.5}}><p>“ROAS 올려드릴게요.”<br/>이제는 다른 질문이 필요합니다.</p><a href="#ds-player-profit">어떤 질문일까요? <ArrowDown size={19}/></a></motion.div>
   <div className="ds-player-signal" aria-hidden="true"><i/><i/><i/></div>
  </section>
  <section className="ds-player-manifesto" id="ds-player-profit">
   <motion.div initial="hidden" whileInView="visible" viewport={{once:true,amount:.25}} transition={{staggerChildren:reduced?0:.16}}>
    <motion.p variants={reveal} transition={{duration:reduced?0:.55}}>매출이 몇 배인지보다,</motion.p>
    <motion.h2 variants={reveal} transition={{duration:reduced?0:.65}}>그래서,<br/><em>얼마가 남았나요?</em></motion.h2>
    <motion.p className="ds-player-position" variants={reveal} transition={{duration:reduced?0:.55}}>우리는 ROAS를 약속하지 않습니다.<br/>원가와 수수료, 광고비를 빼고<br/>실제로 남는 이익부터 봅니다.</motion.p>
   </motion.div>
   <ol className="ds-player-principles">{[['01','상품 하나의 이익','한 개 팔 때 실제로 얼마가 남는지.'],['02','쓸 수 있는 광고비','남는 이익 안에서 얼마까지 쓸 수 있는지.'],['03','다음 광고의 방향','어떤 검색어와 비용부터 점검할지.']].map(([n,title,description])=><motion.li key={n} initial={reduced?false:{opacity:0,y:24}} whileInView={{opacity:1,y:0}} viewport={{once:true,amount:.4}} transition={{duration:.45}}><span>{n}</span><h3>{title}</h3><p>{description}</p></motion.li>)}</ol>
   <button type="button" className="mp-primary ds-player-start" onClick={onStart}>내 광고 수익 점검하기 <ArrowRight size={22}/></button>
  </section>
 </main>;
}
