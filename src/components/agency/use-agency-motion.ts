"use client";
import {useEffect,useRef,useState} from 'react';
import gsap from 'gsap';
import {ScrollTrigger} from 'gsap/ScrollTrigger';
import {useGSAP} from '@gsap/react';

gsap.registerPlugin(ScrollTrigger,useGSAP);

export function useAgencyMotion(){
  const root=useRef<HTMLDivElement>(null);
  const heroTimeline=useRef<gsap.core.Timeline>(null);
  const focusDiagnosis=useRef(false);
  const [scene,setScene]=useState(0);
  const [enhanced,setEnhanced]=useState(false);
  const [showShortcut,setShowShortcut]=useState(false);

  function jumpToDiagnosis(){
    const timeline=heroTimeline.current;
    const trigger=timeline?.scrollTrigger;
    if(!timeline||!trigger)return false;
    const link=root.current?.querySelector<HTMLElement>('.as-conversion-cta');
    const alreadyActive=link?.closest('#diagnosis')?.getAttribute('aria-hidden')==='false';
    focusDiagnosis.current=!alreadyActive;
    window.scrollTo({top:trigger.end,behavior:'instant'});
    trigger.update();
    timeline.progress(1);
    if(alreadyActive)link?.focus({preventScroll:true});
    return true;
  }

  useEffect(()=>{
    if(scene===2&&focusDiagnosis.current){
      focusDiagnosis.current=false;
      root.current?.querySelector<HTMLElement>('.as-conversion-cta')?.focus({preventScroll:true});
    }
  },[scene]);

  useGSAP(()=>{
    const el=root.current;
    const hero=el?.querySelector<HTMLElement>('.as-hero');
    const pin=hero?.querySelector<HTMLElement>('.as-pin');
    const diagnosis=pin?.querySelector<HTMLElement>('#diagnosis');
    const diagnosisLink=diagnosis?.querySelector('.as-conversion-cta');
    if(!hero||!pin||!diagnosis||!diagnosisLink)return;

    const media=gsap.matchMedia();
    media.add('(prefers-reduced-motion: no-preference)',()=>{
      hero.dataset.motion='on';
      const strategy=pin.querySelector('.as-scene-03');
      const progress=pin.querySelector('.as-progress-fill');
      const strategyStart=1.15;
      const diagnosisStart=2.85;
      const duration=4.15;

      gsap.set([strategy,diagnosis],{yPercent:100});
      gsap.from('.as-scene-01 .as-word',{yPercent:110,duration:.8,stagger:.11,ease:'power4.out',clearProps:'transform'});
      const timeline=gsap.timeline({
        defaults:{ease:'power2.inOut'},
        onUpdate(this:gsap.core.Timeline){
          const time=this.time();
          setScene(time<strategyStart+.4?0:time<diagnosisStart+.4?1:2);
        },
        scrollTrigger:{
          trigger:hero,pin,start:'top top',
          end:()=>`+=${pin.clientHeight*(window.innerWidth<=760?2.2:2.7)}`,
          scrub:.4,anticipatePin:1,invalidateOnRefresh:true,
        },
      });
      timeline
        .to('.as-portal',{scale:1.65,rotation:32,duration:.9},.55)
        .to('.as-scene-01 .as-scene-type',{y:-40,duration:.55},strategyStart)
        .to(strategy,{yPercent:0,duration:.85},strategyStart)
        .from('.as-scene-03 .as-word',{yPercent:90,stagger:.07,duration:.6},strategyStart+.18)
        .from('.as-grid-mark',{rotation:-50,scale:.72,duration:.95},strategyStart+.15)
        .to('.as-scene-03 .as-scene-type',{y:-40,duration:.55},diagnosisStart)
        .to(diagnosis,{yPercent:0,duration:.85},diagnosisStart)
        .from('.as-conversion-copy',{y:36,duration:.7},diagnosisStart+.12)
        .from(diagnosisLink,{y:28,duration:.6},diagnosisStart+.35)
        .to(progress,{scaleX:1,duration,ease:'none'},0);
      heroTimeline.current=timeline;
      setEnhanced(true);
      const jumpFrame=location.hash==='#diagnosis'?requestAnimationFrame(()=>{
        ScrollTrigger.refresh();
        jumpToDiagnosis();
      }):0;
      return ()=>{
        cancelAnimationFrame(jumpFrame);
        heroTimeline.current=null;
        delete hero.dataset.motion;
        setEnhanced(false);
        setScene(0);
      };
    });
    const shortcut=ScrollTrigger.create({
      trigger:hero,
      start:'top -48px',
      endTrigger:diagnosisLink,
      end:()=>hero.dataset.motion==='on'?'max':'top bottom',
      refreshPriority:-1,
      onToggle:({isActive})=>setShowShortcut(isActive),
      onRefresh:({isActive})=>setShowShortcut(isActive),
    });
    return ()=>{
      shortcut.kill();
      media.revert();
    };
  },{scope:root});
  return {root,scene,enhanced,jumpToDiagnosis,showFloatingDiagnosis:showShortcut&&(!enhanced||scene<2)};
}
