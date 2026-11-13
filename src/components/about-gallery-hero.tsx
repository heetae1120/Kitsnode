"use client";
import {useRef,useState} from 'react';
import {motion,useMotionValueEvent,useReducedMotion,useScroll,useTransform,type MotionValue} from 'framer-motion';
import {ArrowDown} from 'lucide-react';
const root=process.env.NEXT_PUBLIC_BASE_PATH||'';
const tiles=[
 {kind:'diagnosis',label:'상품 진단 · 예시 화면',image:'/about-gallery/product-diagnosis.jpg',scale:1.5,x:-24,y:-12},
 {kind:'brand',label:'BRAND FIRST',scale:1.6,x:25,y:12},
 {kind:'keywords',label:'검색어 비교 · 예시 화면',image:'/about-gallery/keyword-comparison.jpg',scale:1.45,x:-20,y:18},
 {kind:'foundation',label:'우리가 만드는 기반',scale:1.5,x:4,y:20},
 {kind:'workspace',label:'직접 판단하는 도구',image:'/about-gallery/tablet-workspace.jpg',scale:1.55,x:22,y:8},
] as const;
function GalleryTile({index,progress,reduced}:{index:number;progress:MotionValue<number>;reduced:boolean}){
 const item=tiles[index];const scale=useTransform(progress,[0,1],[1,item.scale]);const x=useTransform(progress,[0,1],[0,item.x]);const y=useTransform(progress,[0,1],[0,item.y]);
 return <motion.div className={`ag-tile ag-tile-${index+1} ag-${item.kind}`} style={{scale:reduced?1:scale,x:reduced?0:x,y:reduced?0:y}}><span className="ag-tile-label">{item.label}</span>{'image' in item?<img src={root+item.image} alt="" width={1265} height={index===0?1266:712} loading={index===0?'eager':'lazy'} decoding="async"/>:item.kind==='brand'?<div className="ag-brand-art"><i/><i/><b>K<span>.</span></b><small>브랜드가 남는 성장</small></div>:<div className="ag-foundation-art"><svg viewBox="0 0 340 150" fill="none"><path d="M0 130H340M0 90H340M0 50H340" stroke="currentColor" opacity=".12"/><path d="M12 126C55 127 67 80 115 89S173 114 207 65S260 82 328 18" stroke="currentColor" strokeWidth="6" strokeLinecap="round"/><circle cx="328" cy="18" r="8" fill="currentColor"/></svg><div><span>상품</span><span>이익</span><span>고객</span></div></div>}</motion.div>;
}
export function AboutGalleryHero(){
 const section=useRef<HTMLElement>(null);const reduced=!!useReducedMotion();const [hidden,setHidden]=useState(false);
 const {scrollYProgress}=useScroll({target:section,offset:['start start','end end']});
 const progress=useTransform(scrollYProgress,[0,.92],[0,1]);
 const scale=useTransform(progress,[0,.4,.8,1],[1,1.8,7,18]);const opacity=useTransform(progress,[0,.66,.9,1],[1,1,0,0]);const y=useTransform(progress,[0,1],[0,0]);
 useMotionValueEvent(progress,'change',value=>setHidden(previous=>previous===(value>.9)?previous:value>.9));
 return <section className="ag-scroll" ref={section} aria-labelledby="kp-hero-title"><div className="ag-stage"><motion.div className="ag-zoom-scene" style={{scale:reduced?1:scale,opacity:reduced?1:opacity}}>
 <div className="ag-gallery" aria-hidden="true">{tiles.map((tile,index)=><GalleryTile key={tile.kind} index={index} progress={progress} reduced={reduced}/>)}</div>
 <motion.div className="ag-copy" style={{y:reduced?0:y}} inert={!reduced&&hidden} aria-hidden={!reduced&&hidden}>
  <span className="ag-eyebrow">KITSNODE · BRAND GROWTH PARTNER</span><h1 id="kp-hero-title">순위 말고,<br/><em>브랜드를 남깁니다.</em></h1><p>광고를 줄여도 고객이 찾는 브랜드를 만듭니다.</p><div className="ag-actions"><a href="#proof" className="ag-secondary">브랜드 사례 보기<ArrowDown size={15}/></a></div>
 </motion.div><span className="ag-scroll-cue" aria-hidden="true">SCROLL TO EXPLORE <ArrowDown size={13}/></span>
 </motion.div></div></section>;
}

