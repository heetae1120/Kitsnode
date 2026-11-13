"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Pause, Play } from "lucide-react";
import "./warp-carousel.css";

type Card = { label: string; image?: string; eyebrow: string };
export function WarpCarousel({cards,index,onIndexChange,paused}:{cards:Card[];index:number;onIndexChange:(i:number)=>void;paused:boolean}) {
  const [playing,setPlaying]=useState(true);
  const [reduced,setReduced]=useState(false);
  const [visible,setVisible]=useState(true);
  const start=useRef<number|null>(null);
  useEffect(()=>{
    const mq=matchMedia("(prefers-reduced-motion: reduce)");
    const sync=()=>setReduced(mq.matches);
    const visibility=()=>setVisible(!document.hidden);
    sync(); visibility(); mq.addEventListener("change",sync); document.addEventListener("visibilitychange",visibility);
    return ()=>{mq.removeEventListener("change",sync); document.removeEventListener("visibilitychange",visibility)};
  },[]);
  const go=(delta:number)=>onIndexChange((index+delta+cards.length)%cards.length);
  useEffect(()=>{
    if(!playing||paused||reduced||!visible)return;
    const timer=setTimeout(()=>onIndexChange((index+1)%cards.length),7000);
    return ()=>clearTimeout(timer);
  },[index,playing,paused,reduced,visible,cards.length,onIndexChange]);
  return <div className="kw-deck" role="region" aria-label="서비스 카드" onKeyDown={e=>{if(e.key==="ArrowLeft"||e.key==="ArrowRight"){e.preventDefault();go(e.key==="ArrowLeft"?-1:1)}}}
    onTouchStart={e=>{start.current=e.touches[0].clientX}} onTouchCancel={()=>{start.current=null}} onTouchEnd={e=>{if(start.current!==null){const dx=e.changedTouches[0].clientX-start.current;if(Math.abs(dx)>50)go(dx<0?1:-1);start.current=null}}}>
    {cards.map((c,i)=>{const slot=[0,1,2,-1][(i-index+4)%4];return <button type="button" key={c.label} className="kw-card" aria-pressed={i===index} onClick={()=>onIndexChange(i)} style={{"--slot":slot,"--depth":Math.abs(slot),"--tone":["#aff5dc","#d4caff","#ffd6aa","#b9dcff"][i],zIndex:4-Math.abs(slot)} as CSSProperties}><small>0{i+1} / {c.eyebrow.toUpperCase()}</small><strong>{c.label}</strong><img src={c.image} alt="" draggable={false}/></button>})}
    {!reduced&&<button type="button" className="kw-pause" aria-label={playing?"자동 전환 멈추기":"자동 전환 시작"} onClick={()=>setPlaying(!playing)}>{playing?<Pause size={16}/>:<Play size={16}/>}</button>}
  </div>;
}
