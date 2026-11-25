"use client";
import Link from 'next/link';
import {ArrowDown,ArrowUpRight} from 'lucide-react';
import {agencyContent as content} from '@/data/agency-content';
import {useAgencyMotion} from './use-agency-motion';
import {MemberMenu} from './member-menu';
import {PublicCategories,SURVEY_HREF} from '../public-categories';
import {BrandWordmark} from '../brand-wordmark';
import './agency.css';

function StoryTitle({lines,id,first=false}:{lines:readonly string[];id:string;first?:boolean}){
  const Heading=first?'h1':'h2';
  return <Heading id={id} className="as-story-title">
    {lines.map((line,index)=><span className="as-story-mask" key={line}>{index>0&&' '}<span className="as-story-line">{line}</span></span>)}
  </Heading>;
}

function MarketGraphic(){
  return <figure className="as-market-graphic">
    <svg viewBox="0 0 500 310" aria-hidden="true">
      <path className="as-market-grid" d="M28 36H472M28 99H472M28 162H472M28 225H472M28 288H472M28 36V288M139 36V288M250 36V288M361 36V288M472 36V288"/>
      <g className="as-market-series">
        <path className="as-market-sales" d="M28 265L93 246L149 251L213 205L273 183L326 127L380 139L428 81L472 51" pathLength="1"/>
        <path className="as-market-reach" d="M28 246L93 205L149 213L213 175L273 145L326 153L380 96L428 105L472 75" pathLength="1"/>
        <path className="as-market-profit" d="M28 257L93 258L149 254L213 261L273 252L326 256L380 248L428 253L472 249" pathLength="1"/>
      </g>
      <g className="as-market-points">
        <circle cx="472" cy="51" r="5"/><circle cx="472" cy="75" r="4"/><circle cx="472" cy="249" r="6"/>
      </g>
    </svg>
    <figcaption><span>개념 그래프</span><span><i/> 노출·매출 ↑</span><span><i/> 이익 정체</span></figcaption>
  </figure>;
}

const nodes=[
  [52,154],[114,57],[129,247],[196,115],[227,201],[291,76],[319,149],[360,236],[425,103],[470,177],
] as const;

function NetworkGraphic(){
  return <svg className="as-network" viewBox="0 0 500 310" fill="none" aria-hidden="true">
    <g className="as-network-orbit"><circle cx="260" cy="155" r="134"/><circle cx="260" cy="155" r="94"/></g>
    <g className="as-network-edges">
      <path d="M52 154L114 57L196 115L129 247L227 201L319 149L291 76L196 115L227 201L360 236L470 177L425 103L319 149L360 236" pathLength="1"/>
      <path d="M52 154L196 115L319 149L470 177M129 247L360 236M291 76L425 103" pathLength="1"/>
    </g>
    {nodes.map(([x,y],index)=><circle key={x} className="as-network-node" cx={x} cy={y} r={[3,4,6].includes(index)?7:3.5}/>)}
    <g className="as-network-labels">
      <text x="196" y="91" textAnchor="middle">분석</text>
      <text x="227" y="229" textAnchor="middle">원인</text>
      <text x="319" y="122" textAnchor="middle">방향</text>
    </g>
  </svg>;
}

export function AgencyHome(){
  const hero=useAgencyMotion();
  return <div className="agency-site" id="top">
    <a className="as-skip" href="#main-content">본문으로 건너뛰기</a>
    <header className="as-header">
      <Link href="/" className="as-wordmark" aria-label="kitsnode 홈"><BrandWordmark/></Link>
      <span className="as-header-note">브랜드의 다음을<br/>함께 만듭니다.</span>
      <PublicCategories/>
      <MemberMenu/>
    </header>
    <main className="as-main" id="main-content" tabIndex={-1}>
      <section className="as-story" ref={hero} aria-label="키츠노드의 접근 방식">
        <div className="as-story-stage">
          <section className="as-story-scene as-question" aria-labelledby="as-question-title">
            <div className="as-story-copy">
              <p className="as-story-lead">{content.question.lead}</p>
              <StoryTitle id="as-question-title" lines={content.question.lines} first/>
              <p className="as-story-note">{content.question.description}</p>
            </div>
            <MarketGraphic/>
          </section>
          <section className="as-story-scene as-essence" aria-labelledby="as-essence-title">
            <div className="as-story-copy">
              <StoryTitle id="as-essence-title" lines={content.essence.lines}/>
              <p className="as-story-note">{content.essence.description}</p>
            </div>
          </section>
          <section className="as-story-scene as-answer" id="diagnosis" aria-labelledby="as-answer-title">
            <div className="as-story-copy">
              <p className="as-story-lead">{content.answer.lead}</p>
              <StoryTitle id="as-answer-title" lines={content.answer.lines}/>
            </div>
            <div className="as-answer-art">
              <NetworkGraphic/>
              <div className="as-cta-reveal">
                <Link href={content.heroCta.href} className="as-story-cta">
                  {content.heroCta.label}<ArrowUpRight size={27} aria-hidden="true"/>
                </Link>
              </div>
            </div>
          </section>
          <div className="as-story-indicator" aria-hidden="true">
            <span className="as-scroll-hint">스크롤 <ArrowDown size={14}/></span>
            <span className="as-story-track"><i/></span>
          </div>
        </div>
      </section>
      <section className="as-capabilities" aria-labelledby="as-capabilities-title">
        <header>
          <h2 id="as-capabilities-title">브랜드 역량과 서비스</h2>
          <Link href="/tools/about/">키츠노드 소개 <ArrowUpRight size={17} aria-hidden="true"/></Link>
        </header>
        <dl>
          {content.services.map(({title,description})=><div key={title}><dt>{title}</dt><dd>{description}</dd></div>)}
        </dl>
        <nav aria-label="브랜드 진단 도구">
          <Link href="/tools/keywords/">검색어 찾기 <ArrowUpRight size={17} aria-hidden="true"/></Link>
          <Link href={SURVEY_HREF}>브랜드 설문 <ArrowUpRight size={17} aria-hidden="true"/></Link>
        </nav>
      </section>
    </main>
  </div>;
}
