"use client";
import Link from 'next/link';
import {ArrowDown,ArrowUpRight} from 'lucide-react';
import {agencyContent as content} from '@/data/agency-content';
import {useAgencyMotion} from './use-agency-motion';
import './agency.css';

function TargetMark(){
  return <svg viewBox="0 0 200 200" fill="none" aria-hidden="true"><circle cx="100" cy="100" r="72" stroke="currentColor" strokeWidth="10" strokeDasharray="405 48" transform="rotate(-20 100 100)"/><circle cx="100" cy="100" r="35" stroke="currentColor" strokeWidth="10"/><circle cx="100" cy="100" r="7" fill="currentColor"/></svg>;
}
function ReformMark(){
  return <svg className="as-black-star" viewBox="0 0 200 200" fill="none" aria-hidden="true">{[0,45,90,135].map(angle=><rect key={angle} x="84" y="8" width="32" height="184" rx="2" fill="currentColor" transform={`rotate(${angle} 100 100)`}/>)}<circle cx="100" cy="100" r="22" fill="#ff5a1f"/><circle cx="100" cy="100" r="10" fill="currentColor"/></svg>;
}
function DissectMark(){
  return <svg className="as-grid-mark" viewBox="0 0 200 200" fill="currentColor" aria-hidden="true"><path d="M92 8A84 84 0 0 0 8 92h84Z"/><path d="M108 8a84 84 0 0 1 84 84h-84Z"/><path d="M8 108a84 84 0 0 0 84 84v-84Z"/><path d="M108 108h84a84 84 0 0 1-84 84Z"/></svg>;
}
function ConnectMark(){
  return <svg viewBox="0 0 200 200" fill="none" stroke="currentColor" strokeWidth="22" aria-hidden="true"><path d="M108 43a54 54 0 1 0 0 98"/><path d="M92 59a54 54 0 1 1 0 98"/></svg>;
}
function SceneWords({lines,first=false}:{lines:readonly string[];first?:boolean}){
  const words=lines.map((line,i)=><span className="as-mask" key={line}>{line.split(' ').map((word,j)=><span className="as-token-mask" key={`${line}-${j}`}><span className="as-word" data-line={i}>{word}</span>{j<line.split(' ').length-1?'\u00a0':null}</span>)}</span>);
  return first?<h1 className="as-display as-refined-display">{words}</h1>:<h2 className="as-display as-refined-display">{words}</h2>;
}
export function AgencyHome(){
  const {root,scene,enhanced,tone}=useAgencyMotion();
  return <div className="agency-site as-korean-site as-diagnosis-landing" id="top" ref={root}>
    <a className="as-skip" href="#diagnosis">본문으로 건너뛰기</a>
    <header className="as-header" data-tone={tone}>
      <Link href="/" className="as-wordmark" aria-label="kitsnode 홈">kitsnode<span>®</span></Link>
      <span className="as-header-note">브랜드의 다음을<br/>함께 만듭니다.</span>
      <Link href={content.heroCta.href} className="as-header-diagnosis">상품 진단 <ArrowUpRight size={17}/></Link>
    </header>
    <main className="as-main">
      <section className="as-hero" aria-label="kitsnode의 네 가지 관점">
        <div className="as-pin">
          {content.scenes.map((item,i)=><section key={item.label} className={`as-scene as-scene-0${i+1}`} aria-label={item.label} aria-hidden={enhanced?scene!==i:undefined} inert={enhanced&&scene!==i}>
            <div className="as-scene-label"><span>0{i+1}</span> / {item.label}</div>
            {i===0&&<><span className="as-background-k" aria-hidden="true">K</span><div className="as-portal" aria-hidden="true"><TargetMark/></div></>}
            {i===1&&<><ReformMark/><span className="as-outline-word" aria-hidden="true">다시, 성장</span></>}
            {i===2&&<><div className="as-editorial-grid" aria-hidden="true"/><DissectMark/><div className="as-strategy-disc" aria-hidden="true"/></>}
            {i===3&&<div className="as-final-orbit" aria-hidden="true"><i/><ConnectMark/></div>}
            <div className="as-scene-type"><SceneWords lines={item.lines} first={i===0}/></div>
            {i===2&&<div className="as-strategy-keywords">{content.diagnosisKeywords.map(keyword=><span key={keyword}>{keyword}</span>)}</div>}
            <div className="as-scene-copy as-refined-copy"><h3 className="as-korean-headline">{item.korean.map(line=><span key={line}>{line}</span>)}</h3><p className="as-service-description">{item.description}</p></div>
            <span className="as-scene-index" aria-hidden="true">0{i+1}</span>
          </section>)}
          <div className="as-hero-bottom" aria-hidden="true"><span>내려서 살펴보기 <ArrowDown size={13}/></span><div className="as-progress"><span className="as-progress-current">01</span><i><b className="as-progress-fill"/></i><span>04</span></div><span className="as-hero-location">다르게 생각하고, 앞으로 나아갑니다.</span></div>
        </div>
      </section>
      <section id="diagnosis" className="as-conversion as-section" aria-labelledby="as-conversion-title" data-header-tone="dark">
        <span className="as-conversion-eyebrow">{content.conversion.eyebrow}</span>
        <h2 id="as-conversion-title">{content.conversion.lines.map(line=><span key={line} data-as-reveal>{line}</span>)}</h2>
        <div data-as-reveal><p>{content.conversion.description}</p><Link href={content.heroCta.href} className="as-button as-conversion-cta">{content.heroCta.label}<ArrowUpRight size={22}/></Link></div>
      </section>
    </main>
  </div>;
}
