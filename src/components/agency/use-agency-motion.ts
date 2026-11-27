"use client";
import {useCallback,useEffect,useRef,useState} from 'react';

const lastScene=3;

/** Time-of-day keys, one per scene: dawn, noon, dusk, night. */
const keys=[
  {bg:[245,241,232],ink:[23,23,23],sub:[94,90,81],line:[216,211,200],glow:[255,181,46,.34],gx:86,gy:10,mark:[255,181,46],shade:1.25,beam:0,mx:0,my:0},
  {bg:[246,244,239],ink:[23,23,23],sub:[94,90,81],line:[216,211,200],glow:[255,214,140,.2],gx:62,gy:-14,mark:[255,194,79],shade:1.25,beam:1,mx:-.28,my:-.55},
  {bg:[242,230,218],ink:[23,23,23],sub:[89,79,71],line:[221,204,190],glow:[255,120,73,.32],gx:90,gy:96,mark:[255,120,73],shade:.92,beam:0,mx:-.12,my:.1},
  {bg:[24,27,50],ink:[244,245,250],sub:[185,189,214],line:[52,57,92],glow:[52,72,223,.42],gx:80,gy:12,mark:[244,245,250],shade:.4,beam:0,mx:0,my:-.2},
] as const;

const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
const smooth=(t:number,from=.3,to=.7)=>{const x=Math.min(1,Math.max(0,(t-from)/(to-from)));return x*x*(3-2*x);};
const rgb=(c:readonly number[])=>`rgb(${c.slice(0,3).map(Math.round).join(' ')})`;

/** Paints the stage for a continuous time value between 0 (dawn) and 3 (night). */
function paint(stage:HTMLElement,time:number){
  const i=Math.min(lastScene-1,Math.floor(time));
  const a=keys[i],b=keys[i+1];
  // Light to dark flips text contrast, so that change happens in a narrow band and
  // the text colour switches once, at the same point the scene changes.
  const flips=a.bg[0]>128!==b.bg[0]>128;
  const t=flips?smooth(time-i,.44,.56):smooth(time-i);
  const textT=flips?(time-i<.5?0:1):t;
  const lerp=(x:readonly number[],y:readonly number[])=>x.map((v,n)=>mix(v,y[n],t));
  const glow=lerp(a.glow,b.glow);
  const set=(name:string,value:string)=>stage.style.setProperty(name,value);
  set('--kn-hero-bg',rgb(lerp(a.bg,b.bg)));
  const text=(x:readonly number[],y:readonly number[])=>x.map((v,n)=>mix(v,y[n],textT));
  set('--kn-hero-ink',rgb(text(a.ink,b.ink)));
  set('--kn-hero-sub',rgb(text(a.sub,b.sub)));
  set('--kn-hero-line',rgb(lerp(a.line,b.line)));
  set('--kn-hero-glow',`rgb(${glow.slice(0,3).map(Math.round).join(' ')} / ${glow[3].toFixed(3)})`);
  set('--kn-hero-gx',mix(a.gx,b.gx,t).toFixed(2)+'%');
  set('--kn-hero-gy',mix(a.gy,b.gy,t).toFixed(2)+'%');
  set('--kn-hero-mark',rgb(lerp(a.mark,b.mark)));
  set('--kn-hero-shade',mix(a.shade,b.shade,t).toFixed(3));
  set('--kn-hero-beam',mix(a.beam,b.beam,t).toFixed(3));
  set('--kn-hero-mx',mix(a.mx,b.mx,t).toFixed(3));
  set('--kn-hero-my',mix(a.my,b.my,t).toFixed(3));
  set('--kn-hero-progress',(time/lastScene).toFixed(4));
}

/**
 * Scroll-linked hero: the page scrolls natively through a tall section while the
 * stage stays pinned. Nothing intercepts the wheel, touch or keyboard.
 */
export function useAgencyMotion(){
  const hero=useRef<HTMLElement>(null);
  const stage=useRef<HTMLDivElement>(null);
  const [active,setActive]=useState({scene:0,direction:1});

  const sceneTop=useCallback((scene:number)=>{
    const section=hero.current;
    if(!section)return 0;
    const top=section.getBoundingClientRect().top+window.scrollY;
    return top+(section.offsetHeight-window.innerHeight)*scene/lastScene;
  },[]);

  const showScene=useCallback((next:number)=>{
    const scene=Math.min(lastScene,Math.max(0,next));
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({top:Math.ceil(sceneTop(scene)),behavior:reduced?'instant':'smooth'});
  },[sceneTop]);

  const current=useRef(0);
  current.current=active.scene;
  const step=useCallback((direction:number)=>showScene(current.current+direction),[showScene]);

  useEffect(()=>{
    const section=hero.current,canvas=stage.current;
    if(!section||!canvas)return;
    let frame=0;
    function update(){
      frame=0;
      if(!section||!canvas)return;
      const range=Math.max(1,section.offsetHeight-window.innerHeight);
      const progress=Math.min(1,Math.max(0,-section.getBoundingClientRect().top/range));
      const time=progress*lastScene;
      // Paint on the page root so the header follows the same time of day.
      paint(canvas.closest<HTMLElement>('.kn-home')??canvas,time);
      const scene=Math.round(time);
      setActive(previous=>scene===previous.scene?previous:{scene,direction:scene>previous.scene?1:-1});
    }
    const request=()=>{if(!frame)frame=requestAnimationFrame(update);};
    function syncHash(){
      if(window.location.hash!=='#diagnosis')return;
      requestAnimationFrame(()=>window.scrollTo({top:Math.ceil(sceneTop(lastScene)),behavior:'instant'}));
    }
    update();
    syncHash();
    window.addEventListener('scroll',request,{passive:true});
    window.addEventListener('resize',request);
    window.addEventListener('hashchange',syncHash);
    return ()=>{
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll',request);
      window.removeEventListener('resize',request);
      window.removeEventListener('hashchange',syncHash);
    };
  },[sceneTop]);

  return {hero,stage,...active,showScene,step,lastScene};
}
