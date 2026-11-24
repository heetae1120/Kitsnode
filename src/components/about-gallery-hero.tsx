'use client';
import {useEffect,useState} from 'react';
import {useReducedMotion} from 'framer-motion';

const base=process.env.NEXT_PUBLIC_BASE_PATH||'';
const disciplines=[
  {label:'Product', title:'팔리는 상품의 조건을 찾습니다.', description:'검색 수요와 판매 비용을 살펴, 상품의 가격과 판매 방향을 정합니다.', image:'/hero-menu/mint-0.webp'},
  {label:'Pop-up', title:'고객이 브랜드를 만나는 공간.', description:'상품을 직접 경험하고 기억할 수 있는 팝업을 기획합니다.', image:'/about-gallery/brand-people.webp'},
  {label:'Branding', title:'다시 찾는 브랜드를 만듭니다.', description:'상품, 메시지, 디자인에 하나의 방향을 담습니다.', image:'/about-gallery/brand-making.webp'},
] as const;

export function AboutGalleryHero(){
  const [current,setCurrent]=useState(0);
  const [playing,setPlaying]=useState(true);
  const [hovered,setHovered]=useState(false);
  const [focused,setFocused]=useState(false);
  const reduced=useReducedMotion();
  useEffect(()=>{
    if(reduced||!playing||hovered||focused)return;
    const timer=window.setInterval(()=>setCurrent(index=>(index+1)%disciplines.length),5600);
    return ()=>window.clearInterval(timer);
  },[reduced,playing,hovered,focused]);
  return <section className="dw-hero" aria-label="키츠노드 프로젝트 분야">
    <div className="dw-landing" onPointerEnter={event=>{if(event.pointerType==='mouse')setHovered(true);}} onPointerLeave={()=>setHovered(false)}
      onFocus={()=>setFocused(true)} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setFocused(false);}}>
      <div className="dw-landing-scenes">
        {disciplines.map((item,index)=><div key={item.label} id={'about-discipline-'+index} className="dw-landing-scene" data-active={current===index}
          aria-hidden={current!==index}>
          <img className="dw-landing-image" src={base+item.image} alt="" fetchPriority={index===0?'high':undefined} decoding="async"/>
          <div className="dw-landing-copy">
            <h2>{item.title}</h2>
            <p>{item.description}</p>
          </div>
        </div>)}
      </div>
      <div className="dw-landing-controls">
        <div className="dw-disciplines" role="group" aria-label="프로젝트 분야 선택">
          {disciplines.map(({label},index)=><button key={label} type="button" className="dw-discipline" aria-controls={'about-discipline-'+index}
            aria-pressed={current===index} onClick={()=>{setCurrent(index);setPlaying(false);}}>{label}</button>)}
        </div>
        <button type="button" className="dw-rotation" onClick={()=>setPlaying(value=>!value)}>{playing?'일시정지':'자동 전환'}</button>
      </div>
    </div>
    <div className="dw-copy">
      <span className="dw-eyebrow">KITSNODE · BRAND GROWTH PARTNER</span>
      <h1>순위 말고,<br/><em>브랜드를 남깁니다.</em></h1>
      <p>광고를 줄여도 고객이 찾는 브랜드를 만듭니다.</p>
    </div>
  </section>;
}
