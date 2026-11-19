"use client";
import {useRef,useState} from 'react';
import {motion,useMotionValueEvent,useReducedMotion,useScroll,useTransform,type MotionValue,type MotionStyle} from 'framer-motion';
import {ArrowDown} from 'lucide-react';
const root=process.env.NEXT_PUBLIC_BASE_PATH||'';
const tiles=[
 {kind:'diagnosis',label:'상품 진단 · 예시 화면',image:'/about-gallery/product-diagnosis.jpg',x:-34,y:-29,z:-120,width:34,height:31},
 {kind:'brand',label:'BRAND FIRST',x:35,y:-26,z:-360,width:23,height:38},
 {kind:'keywords',label:'검색어 비교 · 예시 화면',image:'/about-gallery/keyword-comparison.jpg',x:-37,y:29,z:-620,width:31,height:25},
 {kind:'foundation',label:'우리가 만드는 기반',x:35,y:30,z:-880,width:29,height:24},
 {kind:'workspace',label:'직접 판단하는 도구',image:'/about-gallery/tablet-workspace.jpg',x:-32,y:-31,z:-1140,width:26,height:34},
 {kind:'keywords',label:'검색어 비교 · 예시 화면',image:'/about-gallery/keyword-comparison.jpg',x:37,y:-28,z:-1400,width:37,height:27},
 {kind:'brand',label:'BRAND FIRST',x:-37,y:30,z:-1660,width:21,height:35},
 {kind:'diagnosis',label:'상품 진단 · 예시 화면',image:'/about-gallery/product-diagnosis.jpg',x:34,y:31,z:-1920,width:33,height:29},
 {kind:'foundation',label:'우리가 만드는 기반',x:-34,y:-31,z:-2180,width:28,height:28},
] as const;
function GalleryTile({index,progress,reduced}:{index:number;progress:MotionValue<number>;reduced:boolean}){
 const item=tiles[index];
 const z=useTransform(progress,[0,1],[item.z,item.z+2900]);
 const opacity=useTransform(z,[-2400,-1000,360,760],[.28,.72,1,0]);
 return <motion.div className={`ag-tile ag-tile-${index+1} ag-${item.kind}`} style={{'--tile-width':`${item.width}vw`,'--tile-height':`${item.height}svh`,left:`calc(50% + ${item.x}vw)`,top:`calc(50% + ${item.y}svh)`,x:'-50%',y:'-50%',z:reduced?item.z:z,opacity:reduced ? .65 : opacity} as MotionStyle}>
  <span className="ag-tile-label">{item.label}</span>
  {'image' in item?<img src={root+item.image} alt="" width={1265} height={item.kind==='diagnosis'?1266:712} loading={index<3?'eager':'lazy'} decoding="async"/>:item.kind==='brand'?<div className="ag-brand-art"><i/><i/><b>K<span>.</span></b><small>브랜드가 남는 성장</small></div>:<div className="ag-foundation-art"><svg viewBox="0 0 340 150" fill="none"><path d="M0 130H340M0 90H340M0 50H340" stroke="currentColor" opacity=".12"/><path d="M12 126C55 127 67 80 115 89S173 114 207 65S260 82 328 18" stroke="currentColor" strokeWidth="6" strokeLinecap="round"/><circle cx="328" cy="18" r="8" fill="currentColor"/></svg><div><span>상품</span><span>이익</span><span>고객</span></div></div>}
 </motion.div>;
}
export function AboutGalleryHero(){
 const section=useRef<HTMLElement>(null),reduced=!!useReducedMotion();
 const [hidden,setHidden]=useState(false),hiddenRef=useRef(false);
 const {scrollYProgress}=useScroll({target:section,offset:['start start','end end']});
 const zoom=useTransform(scrollYProgress,[0,.28,.5,.72,.9,1],[1,1.25,2.4,5.8,12,18]);
 const opacity=useTransform(scrollYProgress,[0,.65,.9,1],[1,1,0,0]);
 useMotionValueEvent(scrollYProgress,'change',value=>{const next=value>.92;if(next!==hiddenRef.current){hiddenRef.current=next;setHidden(next);}});
 return <section className="ag-scroll" ref={section} aria-labelledby="kp-hero-title"><div className="ag-stage">
  <div className="ag-gallery" aria-hidden="true">{tiles.map((tile,index)=><GalleryTile key={index} index={index} progress={scrollYProgress} reduced={reduced}/>)}</div>
  <motion.div className="ag-copy" style={{'--ag-copy-zoom':reduced?1:zoom,opacity:reduced?1:opacity} as MotionStyle} inert={!reduced&&hidden} aria-hidden={!reduced&&hidden}>
   <span className="ag-eyebrow">KITSNODE · BRAND GROWTH PARTNER</span><h1 id="kp-hero-title">순위 말고,<br/><em>브랜드를 남깁니다.</em></h1><p>광고를 줄여도 고객이 찾는 브랜드를 만듭니다.</p><div className="ag-actions"><a href="#proof" className="ag-secondary">브랜드 사례 보기<ArrowDown size={15}/></a></div>
  </motion.div><span className="ag-scroll-cue" aria-hidden="true">SCROLL TO EXPLORE <ArrowDown size={13}/></span>
 </div></section>;
}
