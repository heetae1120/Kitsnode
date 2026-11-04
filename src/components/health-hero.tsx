"use client";
import { Activity, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { TiltedGridHero, type TiltedGridImage } from './ui/tilted-grid-hero';

const images:TiltedGridImage[]=[
  {src:'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=900&q=80',alt:'비즈니스 성과를 살펴보는 화면'},
  {src:'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=900&q=80',alt:'지표와 데이터 시각화'},
  {src:'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=900&q=80',alt:'함께 전략을 논의하는 팀'},
  {src:'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=900&q=80',alt:'사업 계획과 예산 검토'},
  {src:'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=900&q=80',alt:'협업하는 업무 공간'},
];
export function HealthHero(){return <section className="hc-hero-reel" aria-label="광고 건강검진 소개"><TiltedGridHero images={images} speed={5} tileHeight={25} axis={62} curve={65} fade={14} className="hc-tilted-hero"><div className="hc-hero-overlay"><div><span className="hc-eyebrow"><Activity size={14}/> KITSNODE · AD HEALTH CHECK</span><h1>광고비를 쓰기 전,<br/><em>남는 돈부터 보세요.</em></h1></div><Link href="/tools/" className="hc-primary">남는 돈 계산하기 <ArrowRight size={17}/></Link><small>약 3분이면 확인할 수 있어요</small></div></TiltedGridHero></section>;}
