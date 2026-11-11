"use client";
import { useRef, useState } from 'react';
import { ArrowRight, X, Sprout, ChartNoAxesCombined, TrendingUp, PackageCheck, Factory, Target } from 'lucide-react';
import Link from 'next/link';
import { ChapterPlayer, type ChapterPlayerChapter } from './ui/chapter-player';
const chapters:ChapterPlayerChapter[]=[{label:'이익 중심 운영',start:0},{label:'리브랜딩',start:7},{label:'첫 판매 시작',start:14},{label:'중국 공장 컨택',start:21}];
const stories=[
 {eyebrow:'01 / PROFIT FIRST',title:<>ROAS만 높다고,<br/>이익이 남을까요?</>,em:'중요한 건 ROI입니다.',description:'광고 매출만 보여주는 보고서 대신, 원가와 광고비를 빼고 남는 이익을 봅니다.',Icon:Target},
 {eyebrow:'02 / REBRANDING',title:<>아무것도 없던 시작에서<br/><em>130억</em> 브랜드까지.</>,em:'리브랜딩으로 만든 변화.',description:'상품의 강점부터 브랜드의 방향까지. 0에서 130억을 만든 경험으로 함께합니다.',Icon:TrendingUp},
 {eyebrow:'03 / YOUR FIRST SALE',title:<>물건 판매,<br/>시작해보고 싶으신가요?</>,em:'첫 상품부터 같이 준비합니다.',description:'무엇을 팔지, 얼마에 팔지, 얼마가 남을지. 막막한 첫 판매를 하나씩 풀어갑니다.',Icon:PackageCheck},
 {eyebrow:'04 / SOURCING PARTNER',title:<>좋은 상품의 시작,<br/>공장부터 연결합니다.</>,em:'중국 공장 컨택도 함께.',description:'원하는 품질과 생산 조건에 맞는 중국 공장을 찾고, 샘플·단가·최소 주문수량을 확인합니다.',Icon:Factory}
];
export function HealthHero(){
 const choice=useRef<HTMLDialogElement>(null);const [active,setActive]=useState(0);const story=stories[active];const Icon=story.Icon;
 return <><section className="hc-chapter-hero" aria-label="KITSNODE 브랜드와 서비스 소개"><ChapterPlayer chapters={chapters} duration={28} brand="KITSNODE" ariaLabel="키츠노드 서비스 소개 · 4개 챕터" onChapterChange={index=>setActive(index)}><div className={'hc-brand-scene hc-brand-scene-'+active} key={active}><div className="hc-brand-copy"><span>{story.eyebrow}</span><h1>{story.title}</h1><h2>{story.em}</h2><p>{story.description}</p></div><div className="hc-brand-art" aria-hidden><div className="hc-art-orbit"/><div className="hc-art-icon"><Icon size={55} strokeWidth={1.4}/></div>{active===0?<><div className="hc-art-metric"><span>매출보다 남는 이익</span><b>ROI</b><small>판매 비용 + 마케팅비용까지</small></div><div className="hc-art-bars">{[30,47,42,66,63,85,100].map((h,i)=><i key={i} style={{height:h+'%'}}/>)}</div></>:active===1?<div className="hc-art-growth"><span>FROM ZERO</span><b>0 <ArrowRight size={30}/> 130억</b><svg viewBox="0 0 240 100"><path d="M5 93 C50 93 35 70 75 76 S110 42 145 49 S187 30 235 5" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round"/></svg></div>:active===2?<div className="hc-art-steps"><span>01 상품 선택</span><span>02 수익 확인</span><span>03 판매 시작 <ArrowRight size={17}/></span></div>:<div className="hc-art-steps"><span>품질 · 샘플 확인</span><span>단가 · 생산 조건</span><span>공장 컨택 <ArrowRight size={17}/></span></div>}</div></div></ChapterPlayer><div className="hc-chapter-action"><button type="button" onClick={()=>choice.current?.showModal()} className="hc-primary">진단하러 가기 <ArrowRight size={17}/></button></div></section>
 <dialog ref={choice} className="hc-stage-dialog" aria-labelledby="hc-stage-title">
 <button type="button" className="hc-stage-close" aria-label="단계 선택 닫기" onClick={()=>choice.current?.close()}><X size={22}/></button>
 <span className="hc-stage-eyebrow">CHOOSE YOUR STAGE</span><h2 id="hc-stage-title">지금 어떤 단계에 계신가요?</h2><p>현재 상황에 맞는 진단을 선택해주세요.</p>
 <div className="hc-stage-cards">
 <Link href="/tools/" className="hc-stage-card"><Sprout size={30}/><span>STARTER</span><h3>스타터</h3><b>판매가 처음이에요</b><p>판매를 시작하기 전, 필요한 금액과 예상 이익을 확인해보세요.</p><strong>판매 준비 진단하기 <ArrowRight size={17}/></strong></Link>
 <Link href="/tools/player/" className="hc-stage-card"><ChartNoAxesCombined size={30}/><span>PLAYER</span><h3>플레이어</h3><b>판매 경험이 있어요</b><p>광고를 시작하거나, 운영 중인 광고와 대행사 성과를 점검해보세요.</p><strong>광고 점검하기 <ArrowRight size={17}/></strong></Link>
 </div></dialog></>;
}
