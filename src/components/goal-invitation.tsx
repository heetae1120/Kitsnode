"use client";
import {useEffect,useId,useRef,type CSSProperties} from 'react';
import {motion,useInView,useReducedMotion} from 'framer-motion';
import {goalMotionFrame} from '@/lib/goal-motion';
import './goal-invitation.css';

const ease=[.22,1,.36,1] as const;
const format=(value:number)=>value.toLocaleString('ko-KR');

export function GoalInvitation({months,profit}:{months:number;profit:number}){
 const root=useRef<HTMLElement>(null),counter=useRef<HTMLSpanElement>(null);
 const id=useId(),reduced=useReducedMotion();
 const entered=useInView(root,{once:true,amount:.3});
 const target=goalMotionFrame(0,profit).target;
 useEffect(()=>{
  if(!entered||reduced)return;
  const start=performance.now();let frame=0;
  const tick=(now:number)=>{
   const state=goalMotionFrame(now-start,profit);
   if(counter.current)counter.current.textContent=format(state.count);
   if(root.current){root.current.dataset.phase=state.phase;root.current.dataset.countDone=String(state.countDone);}
   if(!state.complete)frame=requestAnimationFrame(tick);
  };
  frame=requestAnimationFrame(tick);
  return()=>cancelAnimationFrame(frame);
 },[entered,reduced,profit]);
 const stage=(delay:number,duration:number,hold=.8)=>({initial:{opacity:0,y:28},animate:entered?{opacity:[0,1,1,0],y:[28,0,0,-48]}:{opacity:0,y:28},transition:{delay,duration,times:[0,.14,hold,1],ease}});
 return <section ref={root} id="report-budget" className="mp-story-chapter mp-goal-invitation ds-goal-impact ds-goal-cinema" aria-labelledby={id} data-phase={reduced?'complete':'ready'}>
  <h2 id={id} className="ds-sr-only">당신은 {months}개월 동안 {format(target)}원을 벌려고 하는 거예요. 이게 가능한지, 이제 확인해볼까요?</h2>
  {reduced?<div className="ds-goal-static" aria-hidden="true"><p>당신은 {months}개월 동안</p><strong className="ds-goal-amount" style={{'--goal-digits':Math.max(format(target).length+1,8)} as CSSProperties}>{format(target)}<small>원</small></strong><p>을 벌려고 하는 거예요.</p><p className="ds-goal-final">이게 가능한지,<br/>이제 확인해볼까요?</p></div>:
  <div className="ds-goal-viewport" aria-hidden="true">
   <motion.div className="ds-goal-stage ds-goal-period" {...stage(0,1.5)}>
    <span className="ds-goal-label">당신은</span>
    <div className="ds-goal-period-type"><motion.strong initial={{y:90,scale:1.12,filter:'blur(12px)'}} animate={entered?{y:0,scale:1,filter:'blur(0px)'}:undefined} transition={{delay:.16,duration:.65,ease}}>{months}</motion.strong><span>개월</span></div>
    <motion.span className="ds-goal-label" initial={{opacity:0}} animate={entered?{opacity:1}:undefined} transition={{delay:.6,duration:.35}}>동안</motion.span>
   </motion.div>
   <motion.div className="ds-goal-stage ds-goal-money" {...stage(1.5,2,.98)} animate={entered?{opacity:[0,1,1,0],y:[28,0,0,-24],scale:[1,1,1,.94]}:{opacity:0,y:28,scale:1}}>
    <span className="ds-goal-label">목표 수익</span>
    <motion.div className="ds-goal-amount" style={{'--goal-digits':Math.max(format(target).length+1,8)} as CSSProperties} initial={{scale:1}} animate={entered?{scale:[1,1.06,1]}:undefined} transition={{delay:2.95,duration:.24,times:[0,.25,1],ease}}>
     <span className="ds-goal-amount-reserve">{format(target)}<small>원</small></span>
     <strong className="ds-goal-counter"><span ref={counter}>0</span><small>원</small></strong>
    </motion.div>
    <span className="ds-goal-label">을 벌려고 하는 거예요.</span>
   </motion.div>
   <motion.div className="ds-goal-stage ds-goal-question-stage" {...stage(3.5,1.5)}>
    <div className="ds-goal-question-type"><motion.span initial={{opacity:0,y:28}} animate={entered?{opacity:1,y:0}:undefined} transition={{delay:3.55,duration:.4,ease}}>이게</motion.span>{' '}<motion.strong initial={{opacity:0,y:28}} animate={entered?{opacity:1,y:0}:undefined} transition={{delay:3.72,duration:.4,ease}}>가능한지,</motion.strong></div>
   </motion.div>
   <motion.div className="ds-goal-stage ds-goal-invitation-stage" initial={{opacity:0,y:64}} animate={entered?{opacity:1,y:0}:undefined} transition={{delay:5,duration:.7,ease}}><p className="ds-goal-final">이제 확인해볼까요?</p></motion.div>
  </div>}
 </section>;
}
