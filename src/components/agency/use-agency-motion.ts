"use client";
import {useRef} from 'react';
import gsap from 'gsap';
import {ScrollTrigger} from 'gsap/ScrollTrigger';
import {useGSAP} from '@gsap/react';

gsap.registerPlugin(ScrollTrigger,useGSAP);

export function useAgencyMotion(){
  const hero=useRef<HTMLElement>(null);

  useGSAP(()=>{
    const story=hero.current;
    if(!story)return;
    const stage=story.querySelector<HTMLElement>('.as-story-stage');
    if(!stage)return;

    const media=gsap.matchMedia();
    media.add('(prefers-reduced-motion: no-preference) and (min-height: 590px)',()=>{
      story.dataset.motion='on';
      const timeline=gsap.timeline({
        defaults:{ease:'power2.inOut'},
        scrollTrigger:{trigger:story,start:'top top',end:'bottom bottom',scrub:true},
      });
      timeline
        .from('.as-question .as-story-line',{yPercent:(index)=>index===0?0:14,opacity:(index)=>index===0?1:.76,duration:.24},0)
        .from('.as-market-series path',{strokeDashoffset:.27,duration:.49,stagger:.04},0)
        .from('.as-market-points',{opacity:.25,duration:.4},.12)
        .to('.as-question .as-story-copy',{yPercent:-24,autoAlpha:0,duration:.48},.56)
        .to('.as-market-graphic',{scale:1.09,xPercent:-12,autoAlpha:0,duration:.59},.51)
        .set('.as-question',{visibility:'hidden'},1.1)
        .from('.as-essence',{autoAlpha:0,duration:.41},.72)
        .from('.as-essence .as-story-line',{yPercent:108,duration:.47,stagger:.12},.75)
        .from('.as-essence .as-story-note',{y:18,autoAlpha:0,duration:.32},1.13)
        .to('.as-essence .as-story-copy',{yPercent:-22,autoAlpha:0,duration:.46},1.59)
        .set('.as-essence',{visibility:'hidden'},2.05)
        .from('.as-answer',{autoAlpha:0,duration:.4},1.73)
        .from('.as-answer .as-story-line',{yPercent:110,duration:.43,stagger:.12},1.75)
        .from('.as-network-orbit',{opacity:0,scale:.76,transformOrigin:'50% 50%',duration:.63},1.74)
        .from('.as-network-node',{x:(index)=>index%2===0?-34:42,y:(index)=>index%3===0?33:-32,opacity:0,duration:.58,stagger:.022},1.72)
        .from('.as-network-edges path',{strokeDashoffset:1,duration:.63,stagger:.06,ease:'power2.out'},1.91)
        .from('.as-network-labels',{autoAlpha:0,duration:.32},2.16)
        .from('.as-cta-reveal',{y:20,autoAlpha:0,duration:.32},2.28)
        .to('.as-scroll-hint',{autoAlpha:0,duration:.28},2.4)
        .to('.as-story-track i',{scaleX:1,duration:3,ease:'none'},0);

      return ()=>{delete story.dataset.motion;};
    });
    return ()=>media.revert();
  },{scope:hero});

  return hero;
}
