'use client';
import {useRef} from 'react';
import {useReducedMotion} from 'framer-motion';
import Link from 'next/link';
import {ArrowDown,ArrowLeft,ArrowRight,ArrowUpRight} from 'lucide-react';
import {GrowthIllustration} from './growth-illustration';
import {DealWheelSky,DealWheelClouds} from './deal-wheel-world';
import {dealWheelCards} from './deal-wheel-data';
import {useDealWheel,type WheelNodes} from './use-deal-wheel';
const base=process.env.NEXT_PUBLIC_BASE_PATH||'';

export function AboutGalleryHero(){
  const nodes=useRef<WheelNodes>({root:null,viewport:null,stage:null,copy:null,loader:null,counter:null,pause:null,cards:[],videos:[]});
  const controls=useDealWheel(nodes,!!useReducedMotion());
  return <section className="dw-hero" aria-labelledby="kp-hero-title" ref={el=>{nodes.current.root=el;}}>
    <div className="dw-viewport" ref={el=>{nodes.current.viewport=el;}} role="region" aria-label="브랜드 카드 휠. 드래그하거나 좌우 방향키로 살펴보세요." tabIndex={0}>
      <DealWheelSky/>
      <div className="dw-stage" ref={el=>{nodes.current.stage=el;}}>
        {dealWheelCards.map((card,index)=><Link key={index} href={card.href} prefetch={false} className={'dw-card dw-tone-'+card.tone} tabIndex={0} draggable={false}
          aria-label={`${card.label} · ${index+1}/34`} ref={el=>{nodes.current.cards[index]=el;}}>
          <div className="dw-front">
            {card.image?<img src={base+card.image} alt="" width={2000} height={1250} loading="eager" decoding="async" draggable={false}/>:card.art?<GrowthIllustration kind={card.art}/>:null}
            {card.video&&<video ref={el=>{nodes.current.videos[index]=el;}} className="dw-preview" src={base+card.video} muted loop playsInline preload="none" aria-hidden="true"
              onPlaying={event=>{const video=event.currentTarget;if(video.dataset.wanted==='true')video.dataset.playing='true';else video.pause();}}
              onPause={event=>{delete event.currentTarget.dataset.playing;}}/>}
            <span className="dw-card-caption">{card.label}<ArrowUpRight size={13}/></span>
          </div>
          <div className="dw-back" aria-hidden="true"><span>K.</span><small>KITSNODE</small></div>
        </Link>)}
      </div>
      <DealWheelClouds/>
      <div className="dw-loader" ref={el=>{nodes.current.loader=el;}}>
        <span role="progressbar" aria-label="카드 준비" aria-valuemin={0} aria-valuemax={100} aria-valuenow={0}>카드 준비 <span ref={el=>{nodes.current.counter=el;}}>0</span>%</span>
        <button type="button" onClick={controls.skip}>모션 건너뛰기 <ArrowRight size={14}/></button>
      </div>
      <div className="dw-controls" aria-label="카드 휠 조작">
        <button type="button" onClick={controls.previous} aria-label="이전 카드"><ArrowLeft size={17}/></button>
        <button type="button" ref={el=>{nodes.current.pause=el;}} onClick={controls.pause} aria-pressed="false">자동 회전 멈춤</button>
        <button type="button" onClick={controls.next} aria-label="다음 카드"><ArrowRight size={17}/></button>
      </div>
    </div>
    <div className="dw-copy" ref={el=>{nodes.current.copy=el;}}>
      <span className="dw-eyebrow">KITSNODE · BRAND GROWTH PARTNER</span>
      <h1 id="kp-hero-title">순위 말고,<br/><em>브랜드를 남깁니다.</em></h1>
      <p>광고를 줄여도 고객이 찾는 브랜드를 만듭니다.</p>
      <a href="#proof" className="dw-proof-link">브랜드 사례 보기 <ArrowDown size={15}/></a>
    </div>
    <noscript><style>{`.about-gallery-page>.tool-topbar,.dw-copy{opacity:1!important;transform:none!important;pointer-events:auto!important}.dw-loader,.dw-controls{display:none!important}.dw-stage{display:flex;gap:12px;position:relative!important;left:0!important;top:30px!important;overflow-x:auto;transform:none!important;padding:20px}.dw-card{position:relative!important;left:0!important;top:0!important;transform:none!important;visibility:visible!important;flex-shrink:0}.dw-clouds{display:none}`}</style></noscript>
  </section>;
}
