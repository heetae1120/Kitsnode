'use client';
import {useRef} from 'react';
import {useReducedMotion} from 'framer-motion';
import {GrowthIllustration} from './growth-illustration';
import {AboutHeroDisciplines} from './about-hero-disciplines';
import {dealWheelCards,dealWheelSlots} from './deal-wheel-data';
import {wheelGeometry,wheelCardPose} from '@/lib/deal-wheel';
import {useDealWheel,type WheelNodes} from './use-deal-wheel';
const base=process.env.NEXT_PUBLIC_BASE_PATH||'';
const initialGeometry=wheelGeometry(1220,760);

export function AboutGalleryHero(){
  const nodes=useRef<WheelNodes>({root:null,viewport:null,stage:null,cards:[],videos:[]});
  useDealWheel(nodes,!!useReducedMotion());
  return <section className="dw-hero" aria-labelledby="kp-hero-title" ref={el=>{nodes.current.root=el;}}>
    <div className="dw-viewport" ref={el=>{nodes.current.viewport=el;}} role="region" aria-label="브랜드 카드 휠. 드래그하거나 좌우 방향키로 살펴보세요. 스페이스 키로 자동 회전을 멈추거나 재생합니다." tabIndex={0}>
      <ul className="sv-visually-hidden">{dealWheelCards.map(card=><li key={card.label}>{card.label}</li>)}</ul>
      <div className="dw-stage" ref={el=>{nodes.current.stage=el;}} style={{top:initialGeometry.originY,transform:initialGeometry.transform}}>
        {dealWheelSlots.map((card,index)=>{const pose=wheelCardPose(index,0,initialGeometry);return <div key={index} className={'dw-card dw-tone-'+card.tone} aria-hidden="true" draggable={false}
          data-card-source={index%dealWheelCards.length} style={{visibility:pose.visible?'visible':'hidden',transform:pose.transform,zIndex:1000-Math.round(pose.away*3)}} ref={el=>{nodes.current.cards[index]=el;}}>
          <div className="dw-front">
            {card.image?<img src={base+card.image} alt="" width={2000} height={1250} loading="eager" decoding="async" draggable={false}/>:card.art?<GrowthIllustration kind={card.art}/>:null}
            {card.video&&<video ref={el=>{nodes.current.videos[index]=el;}} className="dw-preview" src={base+card.video} muted loop playsInline preload="none" aria-hidden="true"
              onPlaying={event=>{const video=event.currentTarget;if(video.dataset.wanted==='true')video.dataset.playing='true';else video.pause();}}
              onPause={event=>{delete event.currentTarget.dataset.playing;}}/>}
            <span className="dw-card-caption">{card.label}</span>
          </div>
        </div>;})}
      </div>
      <div className="dw-floor" aria-hidden="true"/>
      <AboutHeroDisciplines/>
    </div>
    <div className="dw-copy">
      <span className="dw-eyebrow">KITSNODE · BRAND GROWTH PARTNER</span>
      <h1 id="kp-hero-title">순위 말고,<br/><em>브랜드를 남깁니다.</em></h1>
      <p>광고를 줄여도 고객이 찾는 브랜드를 만듭니다.</p>
    </div>
  </section>;
}
