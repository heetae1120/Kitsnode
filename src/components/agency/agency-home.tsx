"use client";
import Link from 'next/link';
import {ArrowUpRight,ChevronLeft,ChevronRight} from 'lucide-react';
import {agencyContent as content} from '@/data/agency-content';
import {useAgencyMotion} from './use-agency-motion';
import {MemberMenu} from './member-menu';
import {PublicCategories} from '../public-categories';
import {BrandWordmark} from '../brand-wordmark';
import {DaylightMark} from './daylight-mark';
import './agency.css';

function StoryTitle({lines,id,first=false}:{lines:readonly string[];id:string;first?:boolean}){
  const Heading=first?'h1':'h2';
  return <Heading id={id} className="kn-hero-title">
    {lines.map((line,index)=><span className="kn-hero-mask" key={line}>{index>0&&' '}<span className="kn-hero-line" style={{'--line':index} as React.CSSProperties}>{line}</span></span>)}
  </Heading>;
}

export function AgencyHome(){
  const {hero,stage,scene,direction,showScene,step,lastScene}=useAgencyMotion();
  return <div className="kn-home" data-kn-home="" id="top">
    <a className="kn-skip" href="#main-content">본문으로 건너뛰기</a>
    <header className="kn-masthead" data-scene={scene}>
      <Link href="/" className="kn-masthead-mark" aria-label="키츠노드 홈" onClick={()=>showScene(0)}><BrandWordmark/></Link>
      <PublicCategories/>
      <div className="kn-masthead-member"><MemberMenu/></div>
    </header>
    <main className="kn-home-main" id="main-content" tabIndex={-1}>
      <section className="kn-hero" ref={hero} aria-label="키츠노드의 접근 방식">
        <div className="kn-hero-stage" ref={stage} data-scene={scene} data-direction={direction}>
          <div className="kn-hero-sky" aria-hidden="true"><i className="kn-hero-glow"/><i className="kn-hero-beam"/></div>
          <div className="kn-hero-copy">
            {[content.opening,content.precision,content.expansion].map(({lines,description},index)=>(
              <section key={lines[0]} className="kn-hero-scene" data-active={scene===index} inert={scene!==index} aria-labelledby={`kn-hero-title-${index}`}>
                <StoryTitle id={`kn-hero-title-${index}`} lines={lines} first={index===0}/>
                <p className="kn-hero-note">{description}</p>
              </section>
            ))}
            <section className="kn-hero-scene kn-hero-answer" id="diagnosis" data-active={scene===3} inert={scene!==3} aria-labelledby="kn-hero-answer-title">
              <StoryTitle id="kn-hero-answer-title" lines={content.closing.lines}/>
              <Link href={content.heroCta.href} className="kn-hero-cta">
                {content.heroCta.label}<ArrowUpRight size={20} aria-hidden="true"/>
              </Link>
            </section>
          </div>
          <DaylightMark/>
          <nav className="kn-hero-time" aria-label="히어로 장면 이동">
            <span className="kn-hero-rail" aria-hidden="true"><i/></span>
            <div className="kn-hero-controls">
              <button type="button" onClick={()=>step(-1)} aria-disabled={scene===0} aria-label="이전 장면"><ChevronLeft size={20} aria-hidden="true"/></button>
              <button type="button" onClick={()=>step(1)} aria-disabled={scene===lastScene} aria-label="다음 장면"><ChevronRight size={20} aria-hidden="true"/></button>
            </div>
          </nav>
        </div>
      </section>
    </main>
  </div>;
}
