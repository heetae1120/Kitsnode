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
 const amount=Math.abs(profit);
 const {target,targetMonths}=goalMotionFrame(0,months,amount);
 const outcome=profit<0?'의 손실이 예상돼요.':'의 이익이 예상돼요.';
 const question=profit<=0?'가격과 비용을 다시 살펴볼까요?':'이 계획을 더 자세히 살펴볼까요?';
 useEffect(()=>{
  if(!entered||reduced)return;
  const start=performance.now();let frame=0;
  const tick=(now:number)=>{
   const state=goalMotionFrame(now-start,months,amount);
   if(monthNumber.current)monthNumber.current.textContent=format(state.months);
   if(amountNumber.current)amountNumber.current.textContent=format(state.count);
   if(root.current)root.current.dataset.phase=state.phase;
   if(!state.complete)frame=requestAnimationFrame(tick);
  };
  frame=requestAnimationFrame(tick);
  return()=>cancelAnimationFrame(frame);
 },[entered,reduced,months,amount]);
 return <section ref={root} id="report-budget" className="mp-story-chapter mp-goal-invitation ds-goal-impact ds-goal-countup" aria-labelledby={id} data-phase={reduced?'complete':'ready'} style={{'--goal-digits':Math.max(format(target).length+1,8)} as CSSProperties}>
  <h2 id={id} className="ds-sr-only">{targetMonths}개월 동안 {format(target)}원{outcome} {question}</h2>
  <svg className="ds-goal-growth" viewBox="0 0 1000 560" preserveAspectRatio="none" aria-hidden="true">
   <defs><linearGradient id={id+'-growth'} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="currentColor" stopOpacity=".16"/><stop offset="100%" stopColor="currentColor" stopOpacity="0"/></linearGradient></defs>
   <path className="ds-growth-grid" d="M40 120H960M40 240H960M40 360H960M40 480H960"/>
   <path d="M40 510L125 480L210 425L295 450L380 360L465 395L550 300L635 330L720 225L805 245L880 155L960 40V560H40Z" fill={'url(#'+id+'-growth)'} stroke="none"/>
   <motion.path className="ds-growth-line" d="M40 510L125 480L210 425L295 450L380 360L465 395L550 300L635 330L720 225L805 245L880 155L960 40" initial={reduced?false:{pathLength:0}} animate={{pathLength:entered?1:0}} transition={{duration:reduced?0:2.4,ease:[.22,1,.36,1]}}/>
  </svg>
  <div className="ds-goal-impact-copy" aria-hidden="true">
   <p>당신은 <em><span className="ds-goal-number"><span className="ds-goal-number-space">{format(targetMonths)}</span><span ref={monthNumber} data-goal-months>{reduced?format(targetMonths):'0'}</span></span>개월</em> 동안</p>
   <h2><strong><span className="ds-goal-number"><span className="ds-goal-number-space">{format(target)}</span><span ref={amountNumber} data-goal-amount>{reduced?format(target):'0'}</span></span><small>원</small></strong><span>{outcome}</span></h2>
   <p className="ds-goal-question"><strong>{question}</strong></p>
  </div>
 </section>;
}
