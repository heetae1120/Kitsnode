"use client";
import Link from 'next/link';
import {ArrowUpRight} from 'lucide-react';
import {agencyContent as content} from '@/data/agency-content';
import {useAgencyMotion} from './use-agency-motion';
import {MemberMenu} from './member-menu';
import {PublicCategories} from '../public-categories';
import {BrandWordmark} from '../brand-wordmark';
import './agency.css';

function StoryTitle({lines,id,first=false}:{lines:readonly string[];id:string;first?:boolean}){
  const Heading=first?'h1':'h2';
  return <Heading id={id} className="as-story-title">
    {lines.map((line,index)=><span className="as-story-mask" key={line}>{index>0&&' '}<span className="as-story-line">{line}</span></span>)}
  </Heading>;
}

export function AgencyHome(){
  const {hero,scene,direction,showScene,step,lastScene}=useAgencyMotion();
  return <div className="agency-site" id="top">
    <a className="as-skip" href="#main-content" onClick={()=>{if(scene===0)showScene(1);}}>본문으로 건너뛰기</a>
    <header className="as-header">
      <Link href="/" className="as-wordmark" aria-label="kitsnode 홈" onClick={()=>showScene(0)}><BrandWordmark/></Link>
      <PublicCategories/>
      <MemberMenu/>
    </header>
    <main className="as-main" id="main-content" tabIndex={-1}>
      <section className="as-story" ref={hero} data-direction={direction} aria-label="키츠노드의 접근 방식">
        <div className="as-story-stage">
          <section className="as-story-scene as-question" data-active={scene===1} inert={scene!==1} aria-labelledby="as-question-title">
            <div className="as-story-copy">
              <p className="as-story-lead">{content.question.lead}</p>
              <StoryTitle id="as-question-title" lines={content.question.lines} first/>
              <p className="as-story-note">{content.question.description}</p>
            </div>
          </section>
          <section className="as-story-scene as-essence" data-active={scene===2} inert={scene!==2} aria-labelledby="as-essence-title">
            <div className="as-story-copy">
              <StoryTitle id="as-essence-title" lines={content.essence.lines}/>
              <p className="as-story-note">{content.essence.description}</p>
            </div>
          </section>
          <section className="as-story-scene as-answer" id="diagnosis" data-active={scene===3} inert={scene!==3} aria-labelledby="as-answer-title">
            <div className="as-story-copy">
              <p className="as-story-lead">{content.answer.lead}</p>
              <StoryTitle id="as-answer-title" lines={content.answer.lines}/>
            </div>
            <div className="as-cta-reveal">
              <Link href={content.heroCta.href} className="as-story-cta">
                {content.heroCta.label}<ArrowUpRight size={27} aria-hidden="true"/>
              </Link>
            </div>
          </section>
        </div>
        <nav className="as-story-indicator" aria-label="히어로 장면 이동">
          <div className="as-story-controls">
            <button type="button" onClick={()=>step(-1)} aria-disabled={scene===0} aria-label="이전 장면">이전 장면</button>
            <button type="button" onClick={()=>step(1)} aria-disabled={scene===lastScene} aria-label="다음 장면">다음 장면</button>
          </div>
          <progress className="as-story-track" aria-label="히어로 진행" max={lastScene} value={scene}/>
        </nav>
      </section>
    </main>
  </div>;
}
