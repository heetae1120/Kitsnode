"use client";
import Link from 'next/link';
import {ArrowDown,ArrowUpRight} from 'lucide-react';
import {agencyContent as content} from '@/data/agency-content';
import {useAgencyMotion} from './use-agency-motion';
import './agency.css';
import {MemberMenu} from './member-menu';
import {PublicCategories} from '../public-categories';
import {BrandWordmark} from '../brand-wordmark';

function TargetMark(){
  return <svg viewBox="0 0 200 200" fill="none" aria-hidden="true"><circle cx="100" cy="100" r="72" stroke="currentColor" strokeWidth="10" strokeDasharray="405 48" transform="rotate(-20 100 100)"/><circle cx="100" cy="100" r="35" stroke="currentColor" strokeWidth="10"/><circle cx="100" cy="100" r="7" fill="currentColor"/></svg>;
}
function DissectMark(){
  return <svg className="as-grid-mark" viewBox="0 0 200 200" fill="currentColor" aria-hidden="true"><path d="M92 8A84 84 0 0 0 8 92h84Z"/><path d="M108 8a84 84 0 0 1 84 84h-84Z"/><path d="M8 108a84 84 0 0 0 84 84v-84Z"/><path d="M108 108h84a84 84 0 0 1-84 84Z"/></svg>;
}
function SceneWords({lines,first=false}:{lines:readonly string[];first?:boolean}){
  const words=lines.map((line,i)=><span className="as-mask" key={line}>{line.split(' ').map((word,j)=><span className="as-token-mask" key={`${line}-${j}`}><span className="as-word" data-line={i}>{word}</span>{j<line.split(' ').length-1?'\u00a0':null}</span>)}</span>);
  return first?<h1 className="as-display as-refined-display">{words}</h1>:<h2 className="as-display as-refined-display">{words}</h2>;
}
function DiagnosisShortcut({floating=false,hidden=false}:{floating?:boolean;hidden?:boolean}){
  return <Link href={content.heroCta.href} className={`as-button as-diagnosis-shortcut${floating?' as-floating-diagnosis':''}`} hidden={hidden}>
    바로 진단하러 가기<ArrowUpRight size={20} aria-hidden="true"/>
  </Link>;
}
export function AgencyHome(){
  const {root,scene,enhanced,shortcutDocked,showFloatingDiagnosis,jumpToDiagnosis}=useAgencyMotion();
  return <div className="agency-site as-korean-site as-diagnosis-landing" id="top" ref={root}>
    <a className="as-skip" href="#diagnosis" onClick={event=>{if(jumpToDiagnosis())event.preventDefault();}}>본문으로 건너뛰기</a>
    <header className="as-header">
      <Link href="/" className="as-wordmark" aria-label="kitsnode 홈"><BrandWordmark/></Link>
      <span className="as-header-note">브랜드의 다음을<br/>함께 만듭니다.</span>
      <PublicCategories/>
      <MemberMenu/>
    </header>
    <main className="as-main">
      <section className="as-hero" aria-label="키츠노드 상품 진단 안내">
        <div className="as-pin">
          {content.scenes.map((item,i)=><section key={item.label} className={`as-scene ${i===0?'as-scene-01':'as-scene-03'}`} aria-label={item.label} aria-hidden={enhanced?scene!==i:undefined} inert={enhanced&&scene!==i}>
            <div className="as-scene-label">{item.label}</div>
            {i===0&&<><span className="as-background-k" aria-hidden="true">K</span><div className="as-portal" aria-hidden="true"><TargetMark/></div></>}
            {i===1&&<><div className="as-editorial-grid" aria-hidden="true"/><DissectMark/></>}
            <div className="as-scene-type"><SceneWords lines={item.lines} first={i===0}/></div>
            {i===1&&<div className="as-strategy-keywords">{content.diagnosisKeywords.map(keyword=><span key={keyword}>{keyword}</span>)}</div>}
            <div className="as-scene-copy as-refined-copy"><h3 className="as-korean-headline">{item.korean.map(line=><span key={line}>{line}</span>)}</h3><p className="as-service-description">{item.description}</p></div>
            {i===1&&<DiagnosisShortcut hidden={enhanced&&!shortcutDocked}/>}
          </section>)}
          <section id="diagnosis" className="as-scene as-conversion as-section" aria-labelledby="as-conversion-title" aria-hidden={enhanced?scene!==2:undefined} inert={enhanced&&scene!==2}>
            <div className="as-conversion-copy">
              <h2 id="as-conversion-title">{content.conversion.lines.map(line=><span key={line}>{line}</span>)}</h2>
              <p>{content.conversion.description}</p>
            </div>
            <Link href={content.heroCta.href} className="as-button as-conversion-cta">
              {content.heroCta.label}<ArrowUpRight size={28} aria-hidden="true"/>
            </Link>
          </section>
          <div className="as-hero-bottom" aria-hidden="true">
            <span>{scene<2?'내려서 살펴보기':null}{scene<2&&<ArrowDown size={13}/>}</span>
            <div className="as-progress"><i><b className="as-progress-fill"/></i></div>
          </div>
        </div>
      </section>
    </main>
    <DiagnosisShortcut floating hidden={!showFloatingDiagnosis}/>
  </div>;
}
