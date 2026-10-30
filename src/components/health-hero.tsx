"use client";
import { Activity, ArrowRight } from 'lucide-react';
import { TiltedGridHero, type TiltedGridImage } from './ui/tilted-grid-hero';

const images:TiltedGridImage[]=[
  {src:'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=900&q=80',alt:'비즈니스 성과를 살펴보는 화면'},
  {src:'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=900&q=80',alt:'지표와 데이터 시각화'},
  {src:'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=900&q=80',alt:'함께 전략을 논의하는 팀'},
  {src:'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=900&q=80',alt:'사업 계획과 예산 검토'},
  {src:'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=900&q=80',alt:'협업하는 업무 공간'},
];
export function HealthHero(){return <section className="hc-hero-reel" aria-label="광고 건강검진 소개"><TiltedGridHero images={images} speed={5} tileHeight={25} axis={62} curve={65} fade={14} className="hc-tilted-hero"><div className="hc-hero-overlay"><div><span className="hc-eyebrow"><Activity size={14}/> KITSNODE · AD HEALTH CHECK</span><h1>광고의 다음 장면,<br/><em>숫자로 선명하게.</em></h1><p>이익을 남길지, 회전을 높일지.<br/>내 목표에 맞는 광고비를 함께 찾습니다.</p></div><a className="hc-primary" href="#intake">내 광고 검진 시작 <ArrowRight size={17}/></a><small>약 3분 · 내 사업의 목표와 숫자로 시작하는 진단</small></div></TiltedGridHero></section>;}
