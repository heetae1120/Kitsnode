"use client";
import {useRef,useState,type FormEvent} from 'react';
import Link from 'next/link';
import {ArrowDown,ArrowUpRight,ArrowRight,Plus,X,Menu,Copy,Download} from 'lucide-react';
import {agencyContent as content} from '@/data/agency-content';
import {useAgencyMotion} from './use-agency-motion';
import './agency.css';

function Asterisk({className=''}:{className?:string}){
  return <svg className={className} viewBox="0 0 200 200" fill="none" aria-hidden="true">{[0,45,90,135].map(angle=><rect key={angle} x="84" y="8" width="32" height="184" rx="2" fill="currentColor" transform={`rotate(${angle} 100 100)`}/>)}</svg>;
}
function SceneWords({lines,first=false}:{lines:readonly string[];first?:boolean}){
  const words=lines.map((line,i)=><span className="as-mask" key={line}>{line.split(' ').map((word,j)=><span className="as-token-mask" key={`${line}-${j}`}><span className="as-word" data-line={i}>{word}</span>{j<line.split(' ').length-1?'\u00a0':null}</span>)}</span>);
  return first?<h1 className="as-display">{words}</h1>:<h2 className="as-display">{words}</h2>;
}
function WorkArt({id}:{id:string}){
  return <div className={`as-work-art as-work-${id}`} aria-hidden="true">{id==='orbit'?<><span className="as-art-caption">K / EXPERIMENT 001</span><div className="as-work-rings">{[0,1,2,3,4].map(n=><i key={n} style={{'--ring':n} as React.CSSProperties}/>)}</div><span className="as-art-word">BEYOND<br/>THE<br/><em>EXPECTED.</em></span><span className="as-art-bottom">A STUDY IN NEW PERSPECTIVES</span></>:<><span className="as-art-caption">STUDIO STUDY / 002</span><span className="as-signal-type">SIGN<br/>AL<span>↗</span></span><div className="as-signal-bars">{[0,1,2,3,4,5,6,7].map(n=><i key={n}/>)}</div><span className="as-art-bottom">IDEAS THAT MOVE.</span></>}</div>;
}
export function AgencyHome(){
  const {root,scene,enhanced,tone,ctaReady}=useAgencyMotion();
  const menu=useRef<HTMLDialogElement>(null),projectDialog=useRef<HTMLDialogElement>(null);
  const [menuOpen,setMenuOpen]=useState(false);
  const [project,setProject]=useState<(typeof content.work)[number]|null>(null);
  const [status,setStatus]=useState('');
  function closeMenu(){menu.current?.close();setMenuOpen(false);}
  function openProject(item:(typeof content.work)[number]){setProject(item);projectDialog.current?.showModal();}
  function brief(form:HTMLFormElement){const d=new FormData(form);return ['KITSNODE / PROJECT BRIEF',`담당자: ${d.get('name')}`,`이메일: ${d.get('email')}`,`관심 서비스: ${d.get('service')}`,`프로젝트 내용:\n${d.get('message')}`,'이 문서는 작성자가 저장한 초안이며 kitsnode에 전송되지 않았습니다.'].join('\n\n');}
  function saveBrief(e:FormEvent<HTMLFormElement>){e.preventDefault();const file=new Blob([brief(e.currentTarget)],{type:'text/plain;charset=utf-8'});const url=URL.createObjectURL(file);const a=document.createElement('a');a.href=url;a.download='kitsnode-project-brief.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setStatus('브리프 파일을 준비했습니다. kitsnode에 전송되지는 않았습니다.');}
  async function copyBrief(form:HTMLFormElement|null){if(!form||!form.reportValidity())return;try{await navigator.clipboard.writeText(brief(form));setStatus('브리프를 복사했습니다. kitsnode에 전송되지는 않았습니다.');}catch{setStatus('복사 권한을 확인할 수 없습니다. 브리프 파일 저장을 이용해 주세요.');}}
  return <div className="agency-site" id="top" ref={root}>
    <a className="as-skip" href="#about">본문으로 건너뛰기</a>
    <header className="as-header" data-tone={tone}>
      <Link href="/" className="as-wordmark" aria-label="kitsnode 홈">kitsnode<span>®</span></Link>
      <span className="as-header-note">INDEPENDENT<br/>CREATIVE STUDIO</span>
      <nav className="as-desktop-nav" aria-label="주요 메뉴">{content.navigation.map(item=><a key={item.id} href={`#${item.id}`}>{item.label}<span/></a>)}</nav>
      <button type="button" className="as-menu-toggle" aria-label="메뉴 열기" aria-expanded={menuOpen} aria-controls="agency-menu" onClick={()=>{menu.current?.showModal();setMenuOpen(true);}}><Menu size={25}/></button>
    </header>
    <dialog id="agency-menu" className="as-mobile-menu" ref={menu} aria-label="모바일 메뉴" onClose={()=>setMenuOpen(false)}>
      <div className="as-menu-heading"><span className="as-wordmark">kitsnode®</span><button type="button" onClick={closeMenu} aria-label="메뉴 닫기"><X size={28}/></button></div>
      <nav aria-label="모바일 주요 메뉴">{content.navigation.map((item,i)=><a href={`#${item.id}`} key={item.id} onClick={closeMenu}><small>0{i+1}</small>{item.label}<ArrowUpRight/></a>)}</nav><Link href="/tools/" onClick={closeMenu} className="as-menu-tools">상품 진단 도구 <ArrowUpRight size={18}/></Link>
    </dialog>
    <main className="as-main">
      <section className="as-hero" aria-label="kitsnode의 네 가지 관점">
        <div className="as-pin">
          {content.scenes.map((item,i)=><section key={item.label} className={`as-scene as-scene-0${i+1}`} aria-label={item.label} aria-hidden={enhanced?scene!==i:undefined} inert={enhanced&&scene!==i}>
            <div className="as-scene-label"><span>0{i+1}</span> / {item.label}</div>
            {i===0&&<><span className="as-background-k" aria-hidden="true">K</span><div className="as-portal" aria-hidden="true"><Asterisk/></div></>}
            {i===1&&<><Asterisk className="as-black-star"/><span className="as-outline-word" aria-hidden="true">IDEAS</span></>}
            {i===2&&<><div className="as-editorial-grid" aria-hidden="true"/><Asterisk className="as-grid-mark"/><div className="as-strategy-disc" aria-hidden="true"/></>}
            {i===3&&<div className="as-final-orbit" aria-hidden="true"><i/><Asterisk/></div>}
            <div className="as-scene-type"><SceneWords lines={item.lines} first={i===0}/></div>
            {i===2&&<div className="as-strategy-keywords"><span>STRATEGY</span><span>CREATIVE</span><span>PERFORMANCE</span></div>}
            <div className="as-scene-copy"><p>{item.description}</p><span>{item.korean}</span>{i===3&&<a className="as-button as-hero-cta" href={content.heroCta.href} tabIndex={enhanced&&!ctaReady?-1:undefined} aria-hidden={enhanced&&!ctaReady?true:undefined}>{content.heroCta.label} <ArrowUpRight size={22}/></a>}</div>
            <span className="as-scene-index" aria-hidden="true">0{i+1}</span>
          </section>)}
          <div className="as-hero-bottom" aria-hidden="true"><span>SCROLL TO EXPLORE <ArrowDown size={13}/></span><div className="as-progress"><span className="as-progress-current">01</span><i><b className="as-progress-fill"/></i><span>04</span></div><span className="as-hero-location">THINK DIFFERENT. BUILD FORWARD.</span></div>
        </div>
      </section>
      <section id="about" className="as-about as-section" data-header-tone="light">
        <div className="as-section-tag"><span>01 / THE STUDIO</span><span>THOUGHTFULLY DIFFERENT.</span></div>
        <div className="as-about-heading" data-as-reveal><span>Small studio.</span><h2>{content.about.title[0]}<br/><em>{content.about.title[1]}</em></h2><Asterisk/></div>
        <div className="as-about-bottom"><span className="as-coordinate">IDEA → DIRECTION → IMPACT</span><div data-as-reveal><p>{content.about.description}</p><a href="#services" className="as-text-link">우리의 접근 방식 <ArrowDown size={16}/></a></div></div>
      </section>
      <section id="services" className="as-services as-section" data-header-tone="light">
        <div className="as-section-tag"><span>02 / WHAT WE DO</span><span>CONNECTED BY DESIGN.</span></div>
        <div className="as-services-title" data-as-reveal><h2>Good thinking.<br/><em>Real possibilities.</em></h2><p>방향을 정하는 일부터<br/>변화를 만드는 실행까지.</p></div>
        <div className="as-service-list">{content.services.map(item=><a href="#contact" className="as-service-row" key={item.number} data-as-reveal><span className="as-service-no">{item.number}</span><h3>{item.title}<br/><span>{item.subtitle}</span></h3><div><p>{item.korean}</p><span>{item.description}</span></div><span className="as-service-plus"><Plus size={26}/></span></a>)}</div>
        <div className="as-tool-link"><span>숫자로 먼저 확인하고 싶다면.</span><Link href="/tools/">내 상품 수익성 진단 <ArrowUpRight size={18}/></Link><Link href="/tools/keywords/">검색어 찾기 <ArrowUpRight size={18}/></Link></div>
      </section>
      <section id="work" className="as-work as-section" data-header-tone="dark">
        <div className="as-section-tag"><span>03 / CREATIVE EXPLORATIONS</span><span>MADE TO MAKE A DIFFERENCE.</span></div>
        <div className="as-work-heading" data-as-reveal><h2>THINK.<br/><em>MAKE.</em><br/>MOVE.</h2><div><p>가능성을 보여주는<br/>작은 실험들.</p><span>아래 작업은 실제 고객 사례가 아닌<br/>샘플 콘셉트입니다.</span></div></div>
        <div className="as-work-grid">{content.work.map(item=><button type="button" className="as-work-item" key={item.id} onClick={()=>openProject(item)} aria-label={`${item.title} 샘플 콘셉트 상세 보기`} data-as-reveal><div className="as-work-image"><WorkArt id={item.id}/><span className="as-work-open"><ArrowUpRight size={27}/></span></div><div className="as-work-caption"><div><span>SAMPLE CONCEPT / {item.number}</span><h3>{item.title}</h3></div><span>{item.category}</span></div></button>)}</div>
      </section>
      <section id="contact" className="as-contact as-section" data-header-tone="dark">
        <div className="as-section-tag"><span>04 / YOUR NEXT CHAPTER</span><span>LET’S START SOMETHING.</span></div>
        <h2 data-as-reveal>{content.contact.headline.map((line,i)=><span key={line}>{i===1?<em>{line}</em>:line}</span>)}</h2>
        <div className="as-contact-grid"><div data-as-reveal><ArrowRight className="as-contact-arrow"/><h3>함께할 다음 이야기,<br/>여기에서 시작해 주세요.</h3><p>{content.contact.note}</p>{content.contact.email&&<a className="as-text-link" href={`mailto:${content.contact.email}`}>{content.contact.email}<ArrowUpRight size={18}/></a>}</div>
          <form className="as-contact-form" onSubmit={saveBrief} onChange={()=>setStatus('')}><div className="as-form-row"><label>담당자 이름<input name="name" required maxLength={80} autoComplete="name" placeholder="이름을 알려주세요"/></label><label>이메일<input name="email" type="email" required maxLength={180} autoComplete="email" placeholder="you@company.com"/></label></div><label>함께하고 싶은 일<select name="service" required defaultValue=""><option value="" disabled>서비스를 선택해 주세요</option>{content.services.map(item=><option key={item.number} value={item.title}>{item.title} {item.subtitle}</option>)}<option>아직 정리 중이에요</option></select></label><label>프로젝트 이야기<textarea name="message" required minLength={20} maxLength={5000} rows={4} placeholder="브랜드와 목표, 고민하고 있는 내용을 20자 이상 적어주세요."/></label><div className="as-form-actions"><button className="as-button" type="submit">브리프 파일로 저장 <Download size={18}/></button><button type="button" className="as-copy-button" onClick={e=>copyBrief(e.currentTarget.form)}><Copy size={16}/>내용 복사</button></div><p className="as-form-status" role="status" aria-live="polite">{status||'전송 기능 연결 전 · 입력 내용은 이 화면에서만 사용합니다.'}</p></form></div>
      </section>
    </main>
    <footer className="as-footer"><div className="as-footer-top"><Link href="/" className="as-wordmark">kitsnode<span>®</span></Link><span>INDEPENDENT THINKING.<br/>MEANINGFUL CONNECTIONS.</span><nav aria-label="하단 메뉴">{content.navigation.map(item=><a key={item.id} href={`#${item.id}`}>{item.label}</a>)}<Link href="/tools/">Seller tools <ArrowUpRight size={14}/></Link></nav></div><div className="as-footer-bottom"><span>© {new Date().getFullYear()} kitsnode. All rights reserved.</span><span>CREATIVE MARKETING & BRAND CONSULTING</span><a href="#top" onClick={e=>{e.preventDefault();window.scrollTo({top:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}}>BACK TO TOP ↑</a></div></footer>
    <dialog className="as-project-dialog" ref={projectDialog} aria-label="샘플 콘셉트 상세"><button type="button" className="as-dialog-close" onClick={()=>projectDialog.current?.close()} aria-label="샘플 상세 닫기"><X/></button>{project&&<><span className="as-section-tag">SAMPLE CONCEPT / {project.number}</span><h2>{project.title}</h2><p>{project.description}</p><WorkArt id={project.id}/><a className="as-text-link" href="#contact" onClick={()=>projectDialog.current?.close()}>이런 방향의 프로젝트 상담 준비하기 <ArrowUpRight size={18}/></a></>}</dialog>
  </div>;
}
