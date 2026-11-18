"use client";
import {useEffect,useId,useRef,type CSSProperties} from 'react';
import {motion,useInView,useReducedMotion} from 'framer-motion';
import {goalMotionFrame} from '@/lib/goal-motion';
import './goal-invitation.css';

const format=(value:number)=>value.toLocaleString('ko-KR');

export function GoalInvitation({months,profit}:{months:number;profit:number}){
 const root=useRef<HTMLElement>(null),monthNumber=useRef<HTMLSpanElement>(null),amountNumber=useRef<HTMLSpanElement>(null);
 const id=useId(),reduced=useReducedMotion();
 const entered=useInView(root,{once:true,amount:.3});
 const {target,targetMonths}=goalMotionFrame(0,months,profit);
 useEffect(()=>{
  if(!entered||reduced)return;
  const start=performance.now();let frame=0;
  const tick=(now:number)=>{
   const state=goalMotionFrame(now-start,months,profit);
   if(monthNumber.current)monthNumber.current.textContent=format(state.months);
   if(amountNumber.current)amountNumber.current.textContent=format(state.count);
   if(root.current)root.current.dataset.phase=state.phase;
   if(!state.complete)frame=requestAnimationFrame(tick);
  };
  frame=requestAnimationFrame(tick);
  return()=>cancelAnimationFrame(frame);
 },[entered,reduced,months,profit]);
 return <section ref={root} id="report-budget" className="mp-story-chapter mp-goal-invitation ds-goal-impact ds-goal-countup" aria-labelledby={id} data-phase={reduced?'complete':'ready'} style={{'--goal-digits':Math.max(format(target).length+1,8)} as CSSProperties}>
  <h2 id={id} className="ds-sr-only">당신은 {targetMonths}개월 동안 {format(target)}원을 벌려고 하는 거예요. 이게 가능한지, 이제 확인해볼까요?</h2>
  <motion.svg className="ds-goal-orbit" viewBox="0 0 240 240" aria-hidden="true" initial={reduced?false:{rotate:-65,scale:.8,opacity:0}} animate={{rotate:0,scale:1,opacity:1}} transition={{duration:reduced?0:1.1,ease:[.22,1,.36,1]}}>
   <circle cx="120" cy="120" r="106" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="100 26"/>
   <circle cx="120" cy="120" r="86" fill="none" stroke="currentColor" strokeWidth="14" strokeDasharray="20 114"/>
  </motion.svg>
  <div className="ds-goal-impact-copy" aria-hidden="true">
   <p>당신은 <em><span className="ds-goal-number"><span className="ds-goal-number-space">{format(targetMonths)}</span><span ref={monthNumber} data-goal-months>{reduced?format(targetMonths):'0'}</span></span>개월</em> 동안</p>
   <h2><strong><span className="ds-goal-number"><span className="ds-goal-number-space">{format(target)}</span><span ref={amountNumber} data-goal-amount>{reduced?format(target):'0'}</span></span><small>원</small></strong><span>을 벌려고 하는 거예요.</span></h2>
   <p className="ds-goal-question">이게 가능한지,<br/><strong>이제 확인해볼까요?</strong></p>
  </div>
 </section>;
}
