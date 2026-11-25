"use client";
import {useCallback,useEffect,useRef,useState} from 'react';

const lastScene=3;
const wheelGapMs=180;

export function useAgencyMotion(){
  const hero=useRef<HTMLElement>(null);
  const [active,setActive]=useState({scene:0,direction:1});

  const showScene=useCallback((next:number)=>{
    setActive(previous=>next===previous.scene?previous:{scene:next,direction:next>previous.scene?1:-1});
  },[]);

  const step=useCallback((direction:number)=>{
    setActive(previous=>{
      const scene=Math.min(lastScene,Math.max(0,previous.scene+direction));
      return scene===previous.scene?previous:{scene,direction};
    });
  },[]);

  useEffect(()=>{
    const story=hero.current;
    if(!story)return;
    let lastWheel=-Infinity, handledWheel=false, distance=0;
    let touch:{x:number;y:number}|null=null;

    // Wait for a quiet period before treating trackpad momentum as another gesture.
    function onWheel(event:WheelEvent){
      if(event.ctrlKey||event.defaultPrevented||Math.abs(event.deltaX)>=Math.abs(event.deltaY))return;
      if(document.documentElement.scrollHeight>window.innerHeight+2)return;
      event.preventDefault();
      const time=performance.now();
      if(time-lastWheel>wheelGapMs){handledWheel=false;distance=0;}
      lastWheel=time;
      if(handledWheel)return;
      if(distance*event.deltaY<0)distance=0;
      distance+=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?window.innerHeight:1);
      if(Math.abs(distance)<24)return;
      handledWheel=true;
      step(Math.sign(distance));
    }

    function onKey(event:KeyboardEvent){
      if(event.defaultPrevented||event.altKey||event.ctrlKey||event.metaKey||event.repeat)return;
      if(event.target instanceof HTMLElement&&event.target.closest('input,textarea,select,[contenteditable=true],dialog'))return;
      if(event.code==='Space'&&event.target instanceof HTMLElement&&event.target.closest('button,a'))return;
      switch(event.key){
        case 'ArrowDown': case 'PageDown': case ' ':
          event.preventDefault();
          step(event.shiftKey&&event.key===' '?-1:1);
          break;
        case 'ArrowUp': case 'PageUp':
          event.preventDefault();
          step(-1);
          break;
        case 'Home':
          event.preventDefault();showScene(0);break;
        case 'End':
          event.preventDefault();showScene(lastScene);break;
      }
    }

    function onTouchStart(event:TouchEvent){
      touch=event.touches.length===1?{x:event.touches[0].clientX,y:event.touches[0].clientY}:null;
    }
    function onTouchEnd(event:TouchEvent){
      const origin=touch;
      touch=null;
      if(!origin||event.touches.length||document.documentElement.scrollHeight>window.innerHeight+2)return;
      const point=event.changedTouches[0];
      const distance=origin.y-point.clientY;
      if(Math.abs(distance)>=44&&Math.abs(distance)>Math.abs(origin.x-point.clientX)*1.2)step(Math.sign(distance));
    }
    function cancelTouch(){touch=null;}
    function syncHash(){if(window.location.hash==='#diagnosis')showScene(lastScene);}

    syncHash();
    window.addEventListener('hashchange',syncHash);
    window.addEventListener('wheel',onWheel,{passive:false});
    window.addEventListener('keydown',onKey);
    story.addEventListener('touchstart',onTouchStart,{passive:true});
    story.addEventListener('touchend',onTouchEnd,{passive:true});
    story.addEventListener('touchcancel',cancelTouch);
    return ()=>{
      window.removeEventListener('hashchange',syncHash);
      window.removeEventListener('wheel',onWheel);
      window.removeEventListener('keydown',onKey);
      story.removeEventListener('touchstart',onTouchStart);
      story.removeEventListener('touchend',onTouchEnd);
      story.removeEventListener('touchcancel',cancelTouch);
    };
  },[showScene,step]);

  return {hero,...active,showScene,step,lastScene};
}
