"use client";
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Pause, Play, X } from 'lucide-react';
import Link from 'next/link';
import './sunflower-hero.css';
const labels=['이익 중심 운영','리브랜딩','첫 판매 시작','중국 공장 컨택'];
const stories=[
 {eyebrow:'Profit first',title:<>ROAS만 높다고,<br/>이익이 남을까요?</>,em:'중요한 건 ROI입니다.',description:'광고 매출만 보여주는 보고서 대신, 원가와 광고비를 빼고 남는 이익을 봅니다.'},
 {eyebrow:'Rebranding',title:<>아무것도 없던 시작에서<br/><em>130억</em> 브랜드까지.</>,em:'리브랜딩으로 만든 변화.',description:'상품의 강점부터 브랜드의 방향까지. 0에서 130억을 만든 경험으로 함께합니다.'},
 {eyebrow:'Your first sale',title:<>물건 판매,<br/>시작해보고 싶으신가요?</>,em:'첫 상품부터 같이 준비합니다.',description:'무엇을 팔지, 얼마에 팔지, 얼마가 남을지. 막막한 첫 판매를 하나씩 풀어갑니다.'},
 {eyebrow:'Sourcing partner',title:<>좋은 상품의 시작,<br/>공장부터 연결합니다.</>,em:'중국 공장 컨택도 함께.',description:'원하는 품질과 생산 조건에 맞는 중국 공장을 찾고, 샘플·단가·최소 주문수량을 확인합니다.'}
];
export function HealthHero(){
 const choice=useRef<HTMLDialogElement>(null);const [active,setActive]=useState(0);const story=stories[active];
 const [paused,setPaused]=useState(false);
 const [quiet,setQuiet]=useState(false);
 const [modal,setModal]=useState(false);
 useEffect(()=>{const q=matchMedia('(prefers-reduced-motion: reduce)'); const sync=()=>setQuiet(q.matches);sync();q.addEventListener('change',sync);return()=>q.removeEventListener('change',sync)},[]);
 useEffect(()=>{if(paused||quiet||modal)return;const id=setTimeout(()=>setActive(i=>(i+1)%4),7000);return()=>clearTimeout(id)},[active,paused,quiet,modal]);
 return <><section className="sun-stage" aria-label="키츠노드 서비스 소개" data-still={paused||quiet||modal}>
 <div className="sun-scene" key={active}>
 <svg className="sun-emblem" aria-hidden="true" viewBox="0 0 200 200">
 <defs><linearGradient id="sun-paint" x2=".8" y2="1"><stop stopColor="#fff4a3"/><stop offset=".38" stopColor="#ffd21b"/><stop offset=".78" stopColor="#eaa300"/><stop offset="1" stopColor="#935800"/></linearGradient></defs>
 <g fill="url(#sun-paint)">
 {active===0?Array.from({length:10},(_,i)=><ellipse key={i} cx="100" cy="59" rx="22" ry="52" transform={`rotate(${i*36} 100 100)`}/>):active===1?Array.from({length:5},(_,i)=><rect key={i} x={22+i*9} y={24+i*18} width="125" height="65" rx="18" transform={`rotate(${i*6-24} 100 100)`}/>):active===2?<><path d="M18 71 100 32l82 39-82 42z"/><path d="m18 79 78 39v70l-78-41z"/><path d="m103 118 79-39v68l-79 41z"/></>:<path fillRule="evenodd" d="m83 15 34 0 6 22 18 9 20-11 23 26-14 19 4 18 20 12-9 34-24-1-14 14-2 24-33 9-11-20-20-3-19 14-25-23 10-21-9-17-22-6V83l22-6 10-17-9-20 24-22 19 14 9-1z M133 101a31 31 0 1 0-62 0 31 31 0 1 0 62 0"/>}
 </g></svg>
 <i className="sun-orb" aria-hidden="true"/><i className="sun-coil" aria-hidden="true"/><i className="sun-pebble" aria-hidden="true"/>
 <div className="sun-copy"><h1>{story.title}</h1><h2>{story.em}</h2><p>{story.description}</p></div></div>
 <button className="sun-cta" onClick={()=>{choice.current?.showModal();setModal(true)}}>진단하러 가기 <ArrowRight size={18}/></button>
 <div className="sun-controls" role="group" aria-label="챕터 선택">{labels.map((label,i)=><button key={label} onClick={()=>setActive(i)} aria-pressed={active===i}><small>0{i+1}</small>{label}</button>)}{!quiet&&<button onClick={()=>setPaused(!paused)} aria-label={paused?'자동 재생':'일시 정지'}>{paused?<Play size={15}/>:<Pause size={15}/>}</button>}</div>
 </section> <dialog onClose={()=>setModal(false)} ref={choice} className="hc-stage-dialog" aria-label="진단 단계 선택"><button type="button" className="hc-stage-close" aria-label="단계 선택 닫기" onClick={()=>choice.current?.close()}><X size={22}/></button><div className="hc-stage-cards"><Link href="/tools/" className="hc-stage-card"><img className="hc-stage-art" src={(process.env.NEXT_PUBLIC_BASE_PATH || "")+"/hero-menu/toy-person-0.webp"} alt=""/><span>STARTER</span><h3>스타터</h3><b>판매가 처음이에요</b><p>판매를 시작하기 전, 필요한 금액과 예상 이익을 확인해보세요.</p><strong>진단하러 가기 <ArrowRight size={17}/></strong></Link><Link href="/tools/player/" className="hc-stage-card"><img className="hc-stage-art" src={(process.env.NEXT_PUBLIC_BASE_PATH || "")+"/hero-menu/toy-person-1.webp"} alt=""/><span>PLAYER</span><h3>플레이어</h3><b>판매 경험이 있어요</b><p>광고를 시작하거나, 운영 중인 광고와 대행사 성과를 점검해보세요.</p><strong>점검하러 가기 <ArrowRight size={17}/></strong></Link></div></dialog></>;
}
