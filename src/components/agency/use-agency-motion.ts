"use client";
import {useRef,useState} from 'react';
import gsap from 'gsap';
import {ScrollTrigger} from 'gsap/ScrollTrigger';
import {useGSAP} from '@gsap/react';

gsap.registerPlugin(ScrollTrigger,useGSAP);

export function useAgencyMotion(){
  const root=useRef<HTMLDivElement>(null);
  const [scene,setScene]=useState(0);
  const [enhanced,setEnhanced]=useState(false);
  const [ctaReady,setCtaReady]=useState(false);
  const [tone,setTone]=useState('dark');
  useGSAP(()=>{
    const el=root.current;if(!el)return;
    const media=gsap.matchMedia();
    media.add('(prefers-reduced-motion: no-preference)',()=>{
      const hero=el.querySelector<HTMLElement>('.as-hero');
      const pin=el.querySelector<HTMLElement>('.as-pin');
      if(!hero||!pin)return;
      hero.dataset.motion='on';
      const scenes=gsap.utils.toArray<HTMLElement>('.as-scene',el);
      const progress=el.querySelector<HTMLElement>('.as-progress-fill');
      const current=el.querySelector<HTMLElement>('.as-progress-current');
      let timeline:gsap.core.Timeline|undefined;
      try{
        gsap.set(scenes.slice(1),{autoAlpha:0});
        gsap.set('.as-scene-03',{yPercent:100});
        gsap.from('.as-scene-01 .as-word',{yPercent:i=>110+i*15,duration:.85,stagger:.12,ease:'power4.out',clearProps:'transform'});
        timeline=gsap.timeline({defaults:{ease:'power2.inOut'},onUpdate:()=>{
            const time=timeline?.time()??0;
            const index=time<1.65?0:time<3.65?1:time<6?2:3;
            setScene(index);
            setCtaReady(time>=7.2);
            const trigger=timeline?.scrollTrigger;
            if(trigger?.isActive||trigger?.progress===0)setTone(index===1?'orange':index===2?'light':'dark');
            if(progress)progress.style.transform=`scaleX(${time/8})`;
            if(current)current.textContent=`0${index+1}`;
          },scrollTrigger:{
          trigger:hero,pin,start:'top top',end:()=>`+=${window.innerHeight*(window.innerWidth<760?3.2:4)}`,
          scrub:.65,anticipatePin:1,invalidateOnRefresh:true,
        }});
        timeline
          .to('.as-portal',{scale:16,rotation:45,duration:1.15},.65)
          .to('.as-scene-01 .as-word',{yPercent:-120,stagger:.08,duration:.55},.95)
          .to('.as-scene-01 .as-scene-copy',{opacity:0,duration:.3},1.05)
          .set('.as-scene-02',{autoAlpha:1},1.65)
          .from('.as-scene-02 .as-word',{yPercent:125,xPercent:12,rotation:8,stagger:.13,duration:.7},1.65)
          .from('.as-scene-02 .as-scene-copy',{y:30,opacity:0,duration:.5},2)
          .fromTo('.as-black-star',{rotation:-30,scale:.6},{rotation:110,scale:1,duration:1.9},1.7)
          .to('.as-scene-02 .as-word',{xPercent:-20,yPercent:-125,stagger:.08,duration:.7},3.05)
          .to('.as-scene-03',{autoAlpha:1,yPercent:0,duration:.8},3.25)
          .from('.as-scene-03 .as-word',{yPercent:115,stagger:.1,duration:.6},3.4)
          .from('.as-strategy-keywords span',{y:35,opacity:0,stagger:.1,duration:.45},3.8)
          .from('.as-scene-03 .as-scene-copy',{y:24,opacity:0,duration:.4},4)
          .to('.as-grid-mark',{rotation:90,y:-25,duration:1.6},3.9)
          .to('.as-strategy-disc',{scale:22,duration:.75},5.25)
          .to('.as-scene-03 .as-word',{yPercent:-120,stagger:.06,duration:.65},5.6)
          .set('.as-scene-04',{autoAlpha:1},6)
          .from('.as-scene-04 .as-word',{yPercent:120,stagger:.12,duration:.7},6)
          .from('.as-final-orbit',{scale:.3,rotation:-65,opacity:0,duration:1},6)
          .from('.as-scene-04 .as-scene-copy',{y:25,opacity:0,duration:.5},6.45)
          .from('.as-hero-cta',{y:24,opacity:0,duration:.5},6.7)
          .to('.as-final-orbit',{rotation:25,duration:.7},7.3);
        setEnhanced(true);
        return ()=>{timeline?.scrollTrigger?.kill();timeline?.kill();delete hero.dataset.motion;setEnhanced(false);setScene(0);};
      }catch{
        timeline?.scrollTrigger?.kill(true);
        timeline?.kill();
        const elements=el.querySelectorAll('.as-scene, .as-scene *');
        gsap.killTweensOf(elements);
        delete hero.dataset.motion;
        gsap.set(elements,{clearProps:'all'});
        setEnhanced(false);
      }
    });
    el.querySelectorAll<HTMLElement>('[data-header-tone]').forEach(section=>{
      ScrollTrigger.create({trigger:section,start:'top 76px',end:'bottom 76px',onEnter:()=>setTone(section.dataset.headerTone||'dark'),onEnterBack:()=>setTone(section.dataset.headerTone||'dark')});
    });
    media.add('(prefers-reduced-motion: no-preference)',()=>{
      gsap.utils.toArray<HTMLElement>('[data-as-reveal]',el).forEach(item=>{
        gsap.from(item,{y:45,opacity:0,duration:.9,ease:'power3.out',scrollTrigger:{trigger:item,start:'top 91%',once:true}});
      });
    });
    return ()=>media.revert();
  },{scope:root});
  return {root,scene,enhanced,tone,ctaReady};
}
