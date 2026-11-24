"use client";
import {useEffect,useRef} from 'react';
import {useInView,useReducedMotion} from 'framer-motion';
import {GOAL_COUNT_END,GOAL_COUNT_START,goalMotionFrame} from '@/lib/goal-motion';

const format=(value:number)=>value.toLocaleString('ko-KR');

export function GoalInvitation({months,profit,quantity}:{months:number;profit:number;quantity:number}){
 const root=useRef<HTMLElement>(null),amountNumber=useRef<HTMLSpanElement>(null);
 const reduced=useReducedMotion();
 const entered=useInView(root,{once:true,amount:.3});
 const amount=Math.abs(profit);
 const {target,targetMonths}=goalMotionFrame(0,months,amount);
 const outcome=profit<0?'예상 손실':profit>0?'예상 이익':'예상 손익';
 useEffect(()=>{
  if(!entered||reduced)return;
  const start=performance.now();let frame=0;
  const tick=(now:number)=>{
   const progress=Math.max(0,Math.min((now-start)/360,1));
   const state=goalMotionFrame(GOAL_COUNT_START+progress*(GOAL_COUNT_END-GOAL_COUNT_START),months,amount);
   if(amountNumber.current)amountNumber.current.textContent=format(state.count);
   if(!state.complete)frame=requestAnimationFrame(tick);
  };
  frame=requestAnimationFrame(tick);
  return()=>cancelAnimationFrame(frame);
 },[entered,reduced,months,amount]);
 return <section ref={root} id="report-budget" className="sd-result-lead sd-goal-summary" aria-label="판매 목표와 예상 손익">
  <p>{format(targetMonths)}개월 안에 {format(quantity)}개를 모두 판매할 경우</p>
  <h2>{outcome} · 광고비 반영 전</h2>
  <strong className={profit<0?'is-loss':undefined}>
   <span className="ds-sr-only">{format(target)}원</span>
   <span aria-hidden="true"><span ref={amountNumber} data-goal-amount>{format(target)}</span>원</span>
  </strong>
  <small>전량 판매를 가정한 금액이에요. 실제 판매량은 상품의 검색 수요와 구매 전환에 따라 달라져요.</small>
 </section>;
}
