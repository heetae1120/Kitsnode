'use client';
import {useEffect,type RefObject} from 'react';
import {WHEEL_STEP,wheelCardPose,wheelGeometry,followAngle,decayVelocity,releaseVelocity,shouldPlayPreview} from '@/lib/deal-wheel';

export type WheelNodes = {
  root:HTMLElement|null;viewport:HTMLDivElement|null;stage:HTMLDivElement|null;
  cards:(HTMLDivElement|null)[];videos:(HTMLVideoElement|null)[];
};

export function useDealWheel(nodes:RefObject<WheelNodes>,reduced:boolean){
  useEffect(()=>{
    const n=nodes.current,root=n.root,viewport=n.viewport,stage=n.stage;
    if(!root||!viewport||!stage)return;
    const page=root.closest<HTMLElement>('.about-gallery-page');
    const videoElements=n.videos.filter((video):video is HTMLVideoElement=>!!video);
    const cache=new WeakMap<HTMLElement,Map<string,string>>();
    let alive=true,frame=0,ticking=false,last=performance.now();
    let width=viewport.clientWidth,height=viewport.clientHeight;
    let target=0,spin=0,velocity=0,paused=false,visible=true,focused=false,lastInput=-Infinity;
    let suppressClick=false;
    const drag={active:false,moved:false,id:0,x:0,y:0,startX:0,startY:0,lastMove:0,velocity:0};
    const write=(el:HTMLElement|null,key:string,value:string)=>{
      if(!el)return;let previous=cache.get(el);if(!previous){previous=new Map();cache.set(el,previous);}
      if(previous.get(key)===value)return;previous.set(key,value);el.style.setProperty(key,value);
    };
    const attribute=(el:HTMLElement|null,key:string,value:string)=>{
      if(el&&el.getAttribute(key)!==value)el.setAttribute(key,value);
    };
    function render(){
      const geometry=wheelGeometry(width,height);
      write(stage,'top',geometry.originY.toFixed(3)+'px');write(stage,'transform',geometry.transform);
      for(let index=0;index<n.cards.length;index++){
        const card=n.cards[index];if(!card)continue;
        const pose=wheelCardPose(index,spin,geometry);
        write(card,'visibility',pose.visible?'visible':'hidden');
        if(pose.visible){write(card,'transform',pose.transform);write(card,'z-index',String(1000-Math.round(pose.away*3)));}
        const video=n.videos[index];if(!video)continue;
        const play=shouldPlayPreview(pose.away,pose.visible&&visible&&!document.hidden,reduced,paused);
        const wanted=play?'true':'false';
        if(video.dataset.wanted!==wanted){
          video.dataset.wanted=wanted;
          if(play){video.muted=true;void video.play().catch(()=>{delete video.dataset.playing;});}
          else{video.pause();delete video.dataset.playing;}
        }
      }
    }
    function tick(now:number){
      frame=0;if(!alive)return;ticking=true;
      const dt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;
      if(!reduced&&visible&&!document.hidden){
        if(!paused&&!focused&&!drag.active&&now-lastInput>900)target+=7*dt;
        if(!drag.active){target+=velocity*dt;velocity=decayVelocity(velocity,dt);if(Math.abs(velocity)<.015)velocity=0;}
        spin=followAngle(spin,target,dt);if(Math.abs(target-spin)<.0001)spin=target;
      }else if(reduced){spin=target;velocity=0;}
      render();
      const moving=!reduced&&(!paused&&!focused||drag.active||Math.abs(velocity)>.015||Math.abs(target-spin)>.0001);
      if(visible&&!document.hidden&&moving)wake();
      ticking=false;
    }
    function wake(){if(alive&&!frame){if(!ticking)last=performance.now();frame=requestAnimationFrame(tick);}}
    const turn=(direction:number)=>{target+=direction*WHEEL_STEP;velocity=0;lastInput=performance.now();wake();};
    const togglePause=()=>{
      paused=!paused;
      attribute(root,'data-wheel-paused',String(paused));wake();
    };
    attribute(page,'data-wheel-state','ready');attribute(root,'data-wheel-phase','ready');render();
    const images=n.cards.flatMap(card=>Array.from(card?.querySelectorAll('img')||[]));
    for(const image of images)void image.decode().catch(()=>{if(alive)image.dataset.failed='true';});
    const resize=new ResizeObserver(()=>{width=viewport.clientWidth;height=viewport.clientHeight;wake();});resize.observe(viewport);
    const intersection=new IntersectionObserver(entries=>{visible=!!entries[0]?.isIntersecting;if(visible)wake();else render();},{threshold:0});intersection.observe(viewport);
    const visibility=()=>{if(document.hidden)render();else wake();};document.addEventListener('visibilitychange',visibility);
    const key=(event:KeyboardEvent)=>{
      if(event.target===viewport&&['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();turn(event.key==='ArrowRight'?1:-1);}
      if(event.target===viewport&&event.key===' '){event.preventDefault();togglePause();}
    };
    window.addEventListener('keydown',key,true);
    const down=(event:PointerEvent)=>{
      if(event.button!==0)return;
      if(event.target instanceof Element&&event.target.closest('button'))return;
      suppressClick=false;drag.active=true;drag.moved=false;drag.id=event.pointerId;
      drag.x=drag.startX=event.clientX;drag.y=drag.startY=event.clientY;
      drag.lastMove=performance.now();drag.velocity=0;velocity=0;lastInput=drag.lastMove;wake();
    };
    const move=(event:PointerEvent)=>{
      if(!drag.active||event.pointerId!==drag.id)return;
      const dx=event.clientX-drag.x,dy=event.clientY-drag.startY;
      if(!drag.moved&&Math.abs(dy)>Math.abs(event.clientX-drag.startX)&&Math.abs(dy)>8){drag.active=false;return;}
      if(!drag.moved&&Math.abs(event.clientX-drag.startX)>6){drag.moved=true;suppressClick=true;viewport.setPointerCapture(event.pointerId);}
      if(drag.moved){
        const now=performance.now(),elapsed=Math.max(8,now-drag.lastMove);
        target-=dx*.13;drag.velocity=Math.max(-240,Math.min(240,-dx*.13*1000/elapsed));
        drag.lastMove=now;lastInput=now;wake();
      }
      drag.x=event.clientX;drag.y=event.clientY;
    };
    const up=(event:PointerEvent)=>{
      if(event.pointerId!==drag.id)return;
      const now=performance.now();velocity=drag.moved?releaseVelocity(drag.velocity,drag.lastMove,now,reduced):0;
      drag.active=false;lastInput=now;
      if(viewport.hasPointerCapture(event.pointerId))viewport.releasePointerCapture(event.pointerId);
      wake();
    };
    const cancel=()=>{drag.active=false;velocity=0;wake();};
    const click=(event:MouseEvent)=>{if(suppressClick){event.preventDefault();event.stopPropagation();suppressClick=false;}};
    const wheel=(event:WheelEvent)=>{
      const amount=event.deltaX||event.deltaY;
      const units=event.deltaMode===1?16:event.deltaMode===2?height:1;
      target+=Math.max(-220,Math.min(220,amount*units))*.055;
      velocity=0;lastInput=performance.now();
      if(Math.abs(event.deltaX)>Math.abs(event.deltaY))event.preventDefault();
      wake();
    };
    const focusIn=(event:FocusEvent)=>{focused=event.target instanceof HTMLElement&&event.target.matches(':focus-visible');velocity=0;wake();};
    const focusOut=()=>{focused=false;wake();};
    viewport.addEventListener('pointerdown',down);window.addEventListener('pointermove',move);
    window.addEventListener('pointerup',up);viewport.addEventListener('pointercancel',cancel);
    viewport.addEventListener('click',click,true);viewport.addEventListener('wheel',wheel,{passive:false});
    viewport.addEventListener('focusin',focusIn);viewport.addEventListener('focusout',focusOut);
    wake();
    return()=>{
      alive=false;cancelAnimationFrame(frame);resize.disconnect();intersection.disconnect();
      document.removeEventListener('visibilitychange',visibility);window.removeEventListener('keydown',key,true);
      viewport.removeEventListener('pointerdown',down);window.removeEventListener('pointermove',move);
      window.removeEventListener('pointerup',up);viewport.removeEventListener('pointercancel',cancel);
      viewport.removeEventListener('click',click,true);viewport.removeEventListener('wheel',wheel);
      viewport.removeEventListener('focusin',focusIn);viewport.removeEventListener('focusout',focusOut);
      for(const video of videoElements){video.pause();delete video.dataset.playing;}
      if(page)page.dataset.wheelState='ready';
    };
  },[nodes,reduced]);
}
