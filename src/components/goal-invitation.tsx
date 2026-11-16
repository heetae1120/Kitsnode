"use client";
import {motion,useReducedMotion} from 'framer-motion';

export function GoalInvitation({months,profit}:{months:number;profit:number}){
 const reduced=useReducedMotion();
 return <section id="report-budget" className="mp-story-chapter mp-goal-invitation ds-goal-impact">
  <motion.svg className="ds-goal-orbit" viewBox="0 0 240 240" aria-hidden="true" initial={reduced?false:{rotate:-65,scale:.8,opacity:0}} animate={{rotate:0,scale:1,opacity:1}} transition={{duration:reduced?0:1.1,ease:[.22,1,.36,1]}}>
   <circle cx="120" cy="120" r="106" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="100 26"/>
   <circle cx="120" cy="120" r="86" fill="none" stroke="currentColor" strokeWidth="14" strokeDasharray="20 114"/>
  </motion.svg>
  <motion.div className="ds-goal-impact-copy" initial={reduced?false:{opacity:0,y:24}} animate={{opacity:1,y:0}} transition={{duration:reduced?0:.65,delay:reduced?0:.15}}>
   <p>당신은 <em>{months}개월</em> 동안</p>
   <h2><strong>{Math.round(profit).toLocaleString('ko-KR')}<small>원</small></strong><span>을 벌려고 하는 거예요.</span></h2>
   <p className="ds-goal-question">이게 가능한지,<br/><strong>이제 확인해볼까요?</strong></p>
  </motion.div>
 </section>;
}
