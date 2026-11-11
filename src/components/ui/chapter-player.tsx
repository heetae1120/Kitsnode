"use client";
// Chapter Player, adapted from the Louis Studios component supplied for this project.
import * as React from 'react';
import {Pause,Play} from 'lucide-react';
import './chapter-player.css';
export interface ChapterPlayerChapter{label:string;start:number}
export interface ChapterPlayerProps{
 navigation?:'tabs'|'dots';src?:string;poster?:string;chapters?:ChapterPlayerChapter[];autoPlay?:boolean;loop?:boolean;muted?:boolean;playbackRate?:number;startAt?:number;duration?:number;children?:React.ReactNode;onChapterChange?:(index:number,chapter:ChapterPlayerChapter)=>void;background?:string[];backgroundRight?:string;accent?:string;accentLine?:string;edgeColors?:string[];tab?:string;tabText?:string;tabActive?:string;tabActiveText?:string;tick?:string;ticks?:number;brand?:string;brandColor?:string;watermark?:boolean;font?:string;ariaLabel?:string;className?:string;style?:React.CSSProperties;
}
const defaults:ChapterPlayerChapter[]=[{label:'Intro',start:0},{label:'Library',start:5},{label:'Rooms',start:11},{label:'Get it',start:18}];
export function ChapterPlayer({navigation='tabs',src,poster,chapters=defaults,autoPlay=true,loop=true,muted=true,playbackRate=1,startAt=0,duration=24,children,onChapterChange,background=['#020002','#130022','#a73dd9','#ea83fe','#fed4ff'],backgroundRight='#8200ff',accent='#9142ff',accentLine='#e6c8ff',edgeColors=['#b44cff','#2a0ce4','#ff9a72','#ffde45','#fff','#e070e0'],tab='#fefefe',tabText='#0b0b0d',tabActive='#020004',tabActiveText='#f4f2f7',tick='rgba(30,0,40,.34)',ticks=44,brand='KITSNODE',brandColor='rgba(255,255,255,.65)',watermark=false,font='inherit',ariaLabel='챕터 플레이어',className='',style}:ChapterPlayerProps){
 const root=React.useRef<HTMLDivElement>(null),video=React.useRef<HTMLVideoElement>(null);
 const [time,setTime]=React.useState(Math.max(0,startAt)),[playing,setPlaying]=React.useState(autoPlay),[length,setLength]=React.useState(duration),[failed,setFailed]=React.useState(false),[reduced,setReduced]=React.useState(false);
 const [visible,setVisible]=React.useState(true);
 const safeLength=Math.max(1,length),list=chapters.length?chapters:defaults;
 const available=list.filter((c,i)=>i===0||c.start<safeLength);
 const active=Math.max(0,available.findLastIndex(c=>time>=c.start));
 const callback=React.useRef(onChapterChange);React.useEffect(()=>{callback.current=onChapterChange;},[onChapterChange]);
 React.useEffect(()=>{callback.current?.(active,available[active]);},[active,chapters]);
 React.useEffect(()=>{const mq=window.matchMedia('(prefers-reduced-motion: reduce)');const update=()=>{setReduced(mq.matches);if(mq.matches)setPlaying(false);};update();mq.addEventListener('change',update);return()=>mq.removeEventListener('change',update);},[]);
 React.useEffect(()=>{const el=root.current;if(!el)return;let intersecting=true;const sync=()=>setVisible(intersecting&&!document.hidden);const io=new IntersectionObserver(([entry])=>{intersecting=entry.isIntersecting;sync();});io.observe(el);document.addEventListener('visibilitychange',sync);return()=>{io.disconnect();document.removeEventListener('visibilitychange',sync);};},[]);
 React.useEffect(()=>{if(src||!playing||!visible)return;let last=0,frame=0;const advance=(now:number)=>{if(last){const delta=Math.min((now-last)/1000,.1)*Math.max(0,playbackRate);setTime(t=>{const next=t+delta;return next>=safeLength?(loop?next%safeLength:safeLength):next;});}last=now;frame=requestAnimationFrame(advance);};frame=requestAnimationFrame(advance);return()=>cancelAnimationFrame(frame);},[src,playing,visible,playbackRate,safeLength,loop]);
 React.useEffect(()=>{if(!loop&&time>=safeLength)setPlaying(false);},[time,safeLength,loop]);
 React.useEffect(()=>{if(!src)setLength(duration);},[duration,src]);
 React.useEffect(()=>{const v=video.current;if(!v)return;v.muted=muted;v.playbackRate=playbackRate;if(playing&&visible){void v.play().catch(()=>setPlaying(false));}else v.pause();},[playing,visible,src,muted,playbackRate]);
 function seek(value:number){const next=Math.min(safeLength,Math.max(0,value));setTime(next);if(video.current)video.current.currentTime=next;}
 function key(event:React.KeyboardEvent){if((event.target as HTMLElement).closest('button,input,a'))return;if(event.key===' '||event.key.toLowerCase()==='k'){event.preventDefault();setPlaying(v=>!v);}else if(event.key==='ArrowRight'){event.preventDefault();seek(time+5);}else if(event.key==='ArrowLeft'){event.preventDefault();seek(time-5);}}
 const chapterEnd=available[active+1]?.start??safeLength;
 const chapterProgress=Math.max(0,Math.min(1,(time-available[active].start)/Math.max(1,chapterEnd-available[active].start)));
 const fmt=(t:number)=>Math.floor(t/60)+':'+String(Math.floor(t%60)).padStart(2,'0');
 const vars={'--cp-accent':accent,'--cp-line':accentLine,'--cp-tab':tab,'--cp-tab-text':tabText,'--cp-active':tabActive,'--cp-active-text':tabActiveText,'--cp-tick':tick,'--cp-edge': 'conic-gradient(from 0deg,'+edgeColors.join(',')+','+edgeColors[0]+')'} as React.CSSProperties;
 return <div ref={root} className={'lscp-root '+className} role="region" aria-label={ariaLabel} onKeyDown={key} style={{...vars,background:'linear-gradient(160deg,'+background.join(',')+')',fontFamily:font,...style}} data-reduced={reduced||undefined}>
 <div className="lscp-tint" aria-hidden style={{background:'radial-gradient(ellipse at right center,'+backgroundRight+',transparent 70%)'}}/>
 {brand&&<div className="lscp-brand" style={{color:brandColor}}><span aria-hidden>✳</span>{brand}</div>}
 <div className="lscp-frame"><div className="lscp-edge" aria-hidden/><div className="lscp-film">
 {src?<video ref={video} src={src} poster={poster} muted={muted} loop={loop} playsInline preload="metadata" onLoadedMetadata={e=>{setLength(Number.isFinite(e.currentTarget.duration)?e.currentTarget.duration:duration);e.currentTarget.currentTime=Math.min(startAt,e.currentTarget.duration||0);setFailed(false);}} onTimeUpdate={e=>setTime(e.currentTarget.currentTime)} onEnded={()=>!loop&&setPlaying(false)} onError={()=>{setFailed(true);setPlaying(false);}}/>:children??<div className="lscp-default"><span>{brand}</span><strong>{available[active].label}</strong></div>}
 {watermark&&<span className="lscp-watermark">{brand}</span>}{failed&&<p className="lscp-unavailable" role="status">영상을 재생할 수 없어요.</p>}
 <button type="button" className="lscp-play" aria-label={playing?'일시정지':'재생'} onClick={()=>setPlaying(v=>!v)} disabled={failed}>{playing?<Pause size={17}/>:<Play size={17}/>}</button>
 </div></div>
 <div className={navigation==='dots'?'lscp-dots':'lscp-chapters'} role="group" aria-label="챕터 선택">{available.map((c,i)=><button type="button" key={c.start+':'+c.label} aria-label={c.label} title={c.label} aria-current={i===active?'true':undefined} onClick={()=>seek(c.start)}>{navigation==='tabs'&&<span>{c.label}</span>}{navigation==='tabs'&&i===active&&<i aria-hidden style={{left:(chapterProgress*100)+'%'}}/>}</button>)}</div>
 {navigation==='tabs'&&<><div className="lscp-timeline"><div className="lscp-ticks" aria-hidden>{Array.from({length:Math.max(2,ticks)},(_,i)=><i key={i} data-passed={i/(ticks-1)<=time/safeLength||undefined}/>)}</div><input type="range" min="0" max={safeLength} step="0.1" value={Math.min(time,safeLength)} aria-label="재생 위치" aria-valuetext={fmt(time)+' / '+fmt(safeLength)+' · '+available[active].label} onChange={e=>seek(Number(e.target.value))}/></div>
 <div className="lscp-time"><span>{String(active+1).padStart(2,'0')} / {String(available.length).padStart(2,'0')}</span><span>{fmt(time)} / {fmt(safeLength)}</span></div></>}
 </div>;
}
export default ChapterPlayer;
