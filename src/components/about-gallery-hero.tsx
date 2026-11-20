"use client";
import {useRef,useState} from 'react';
import {motion,useMotionValueEvent,useReducedMotion,useScroll,useTransform,type MotionValue,type MotionStyle} from 'framer-motion';
import {ArrowDown} from 'lucide-react';
import {GrowthIllustration} from './growth-illustration';
const root=process.env.NEXT_PUBLIC_BASE_PATH||'';
const tiles=[
 {kind:'photo',image:'/about-gallery/brand-making.webp',x:-34,y:-26,z:-120,width:36,height:30},
 {kind:'photo',image:'/about-gallery/brand-people.webp',x:29,y:29,z:-420,width:34,height:28},
 {kind:'growth',art:'trend',tone:'paper',x:-14,y:-37,z:-700,width:24,height:24},
 {kind:'growth',art:'bars',tone:'dark',x:17,y:-37,z:-980,width:33,height:32},
 {kind:'growth',art:'steps',tone:'paper',x:40,y:-19,z:-1260,width:40,height:33},
 {kind:'growth',art:'arrow',tone:'orange',x:43,y:12,z:-1540,width:36,height:37},
 {kind:'growth',art:'compound',tone:'paper',x:0,y:40,z:-1820,width:42,height:34},
 {kind:'growth',art:'milestones',tone:'dark',x:-30,y:29,z:-2100,width:54,height:38},
 {kind:'growth',art:'columns',tone:'orange',x:-43,y:7,z:-2300,width:50,height:36},
] as const;
function GalleryTile({index,progress,reduced}:{index:number;progress:MotionValue<number>;reduced:boolean}){
 const item=tiles[index];
 const z=useTransform(progress,[0,1],[item.z,item.z+2900]);
 const opacity=useTransform(z,[-2600,-1000,360,600],[.65,.85,1,0]);
 const travel=useTransform(z,[item.z,0,400,600],[1,1.04,1.6,2.5]);
 return <motion.div className={`ag-tile ag-tile-${index+1} ag-${item.kind}${'tone' in item?' ag-growth-'+item.tone:''}`} style={{'--tile-width':`${item.width}vw`,'--tile-height':`${item.height}svh`,'--tile-ray-x':`${item.x}vw`,'--tile-ray-y':`${item.y}svh`,'--tile-depth':reduced?item.z:z,'--tile-travel':reduced?1:travel,x:'-50%',y:'-50%',z:reduced?item.z:z,opacity:reduced ? .8 : opacity} as MotionStyle}>
  {'image' in item?<img src={root+item.image} alt="" width={2000} height={1250} loading="eager" decoding="async"/>:<GrowthIllustration kind={item.art}/>}
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
