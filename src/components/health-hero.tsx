"use client";
import { useRef } from 'react';
import { ArrowRight, X, Sprout, ChartNoAxesCombined } from 'lucide-react';
import Link from 'next/link';
import { TiltedGridHero, type TiltedGridImage } from './ui/tilted-grid-hero';

const images:TiltedGridImage[]=[
  {src:'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=900&q=80',alt:'비즈니스 성과를 살펴보는 화면'},
  {src:'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=900&q=80',alt:'지표와 데이터 시각화'},
  {src:'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=900&q=80',alt:'함께 전략을 논의하는 팀'},
  {src:'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=900&q=80',alt:'사업 계획과 예산 검토'},
  {src:'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=900&q=80',alt:'협업하는 업무 공간'},
];
export function HealthHero({onPlayer}:{onPlayer:()=>void}){
 const choice=useRef<HTMLDialogElement>(null);
 return <><section className="hc-hero-reel" aria-label="수익 진단 소개"><TiltedGridHero images={images} speed={5} tileHeight={25} axis={62} curve={65} fade={14} className="hc-tilted-hero"><div className="hc-hero-overlay"><div><h1><em>당신의 수익을 진단해보세요</em></h1></div><button type="button" onClick={()=>choice.current?.showModal()} className="hc-primary">진단하러 가기 <ArrowRight size={17}/></button></div></TiltedGridHero></section>
 <dialog ref={choice} className="hc-stage-dialog" aria-labelledby="hc-stage-title">
 <button type="button" className="hc-stage-close" aria-label="단계 선택 닫기" onClick={()=>choice.current?.close()}><X size={22}/></button>
 <span className="hc-stage-eyebrow">CHOOSE YOUR STAGE</span><h2 id="hc-stage-title">지금 어떤 단계에 계신가요?</h2><p>현재 상황에 맞는 진단을 선택해주세요.</p>
 <div className="hc-stage-cards">
 <Link href="/tools/" className="hc-stage-card"><Sprout size={30}/><span>STARTER</span><h3>스타터</h3><b>판매가 처음이에요</b><p>판매를 시작하기 전, 필요한 금액과 예상 이익을 확인해보세요.</p><strong>판매 준비 진단하기 <ArrowRight size={17}/></strong></Link>
 <button type="button" className="hc-stage-card" onClick={()=>{choice.current?.close();onPlayer();}}><ChartNoAxesCombined size={30}/><span>PLAYER</span><h3>플레이어</h3><b>판매 경험이 있어요</b><p>광고를 시작하거나, 운영 중인 광고와 대행사 성과를 점검해보세요.</p><strong>광고 점검하기 <ArrowRight size={17}/></strong></button>
 </div></dialog></>;
}
