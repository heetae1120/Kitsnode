'use client';

import {useEffect, useRef, useState} from 'react';
import Link from 'next/link';
import {memberBrowserClient} from '@/lib/member-browser-client';
import {saveMemberReturn} from '@/lib/member-return';
import {createAdConnectionTransport} from '@/lib/ad-connection-transport.mjs';
import {AdConnectionPanel} from './ad-connection-panel';
import {AdPerformancePanel} from './ad-performance-panel';
import {StoreBadge, StoreButton, StoreCard} from './store-ui';
import {ArrowLeft, ArrowRight, Check, LockKeyhole, RefreshCw} from 'lucide-react';

const transport=createAdConnectionTransport({enabled:process.env.NEXT_PUBLIC_AD_CONNECTION_ENABLED==='true'});
const performanceReady=process.env.NEXT_PUBLIC_AD_ANALYSIS_PERFORMANCE_READY==='true' && process.env.NEXT_PUBLIC_AD_PERFORMANCE_ENABLED==='true';
type State='loading'|'signed-out'|'connected'|'pending'|'not-connected'|'unavailable';

/** UI gate only. Server endpoints must independently authenticate and authorize. */
export function AdvertiserAnalysis(){
 const [user,setUser]=useState<string|null>(null),[state,setState]=useState<State>('loading'),[refresh,setRefresh]=useState(0);
 const [step,setStep]=useState<1|2|null>(null);
 const current=useRef<string|null>(null),lastConnection=useRef<'connected'|'pending'|'not-connected'|null>(null);
 useEffect(()=>{
  const client=memberBrowserClient();if(!client){setState('unavailable');return;}
  let mounted=true,version=0;
  const apply=(id:string|null)=>{version++;if(current.current!==id){current.current=id;lastConnection.current=null;setStep(null);setState(id?'loading':'signed-out');}else if(!id){setState('signed-out');}setUser(id);};
  const {data:{subscription}}=client.auth.onAuthStateChange((_event,session)=>{if(mounted)apply(session?.user?.id??null);});
  const initial=version;void client.auth.getSession().then(({data})=>{if(mounted&&initial===version)apply(data.session?.user?.id??null);}).catch(()=>{if(mounted)setState('unavailable');});
  return ()=>{mounted=false;current.current=null;subscription.unsubscribe();};
 },[]);
 useEffect(()=>{
  if(!user)return;
  if(!transport){setState('unavailable');return;}
  const controller=new AbortController(),owner=user;if(lastConnection.current===null)setState('loading');
  void (async()=>{try{
   const session=await memberBrowserClient()?.auth.getSession();
   if(!session?.data.session?.access_token||session.data.session.user.id!==owner||current.current!==owner){if(!controller.signal.aborted&&current.current===owner)setState('unavailable');return;}
   const data=await transport.list(session.data.session.access_token,controller.signal);
   if(!controller.signal.aborted&&current.current===owner){const next=data.connections.some(c=>c.status==='read_connected')?'connected':data.connections.some(c=>c.status==='pending_review')?'pending':'not-connected';const becameConnected=lastConnection.current!==null&&lastConnection.current!=='connected'&&next==='connected';lastConnection.current=next;setStep(previous=>previous===null||becameConnected?(next==='connected'?2:1):previous);setState(next);}
  }catch{if(!controller.signal.aborted&&current.current===owner)setState('unavailable');}})();
  return ()=>controller.abort();
 },[user,refresh]);
 return <div className="ad-analysis">
  <a className="ad-analysis-skip" href="#ad-analysis-main">본문으로 바로가기</a>
  <header className="ad-analysis-header"><Link href="/tools/start/" className="ad-analysis-brand" aria-label="키츠노드 홈">kitsnode<span>®</span></Link><Link href="/tools/start/" className="ad-analysis-back"><ArrowLeft size={15} aria-hidden="true"/>홈으로 돌아가기</Link></header>
  <main id="ad-analysis-main" className="ad-analysis-main" tabIndex={-1}>
   <div className="ad-analysis-intro"><div><p className="ad-analysis-eyebrow">KITSNODE / AD ANALYTICS</p><h1>광고 데이터 분석</h1><p className="ad-analysis-lead">연결한 광고계정의 상태와 성과를 한곳에서 확인하세요.</p></div><span className="ad-analysis-intro-tag">AD ACCOUNT <span aria-hidden="true">↗</span></span></div>
   {state==='loading'?<StoreCard className="ad-analysis-notice"><p role="status">계정과 연결 상태를 확인하고 있습니다.</p></StoreCard>:state==='signed-out'?<StoreCard className="ad-analysis-login"><div className="ad-analysis-icon"><LockKeyhole size={23} aria-hidden="true"/></div><div><StoreBadge>회원 전용</StoreBadge><h2>로그인 후 이용할 수 있어요</h2><p>키츠노드 회원 또는 네이버 로그인 계정으로 로그인해 주세요.</p><div className="store-actions"><Link className="store-button" href="/store/login/" onClick={saveMemberReturn}>로그인 <ArrowRight size={16} aria-hidden="true"/></Link><Link className="store-button store-button--secondary" href="/store/signup/" onClick={saveMemberReturn}>회원가입</Link></div></div></StoreCard>:<>
    {state==='unavailable'&&<StoreCard className="ad-analysis-notice"><StoreBadge tone="warning">확인 필요</StoreBadge><h2>연결 상태를 확인할 수 없어요</h2><p>잠시 후 다시 확인해 주세요. 확인되지 않은 광고 데이터는 표시하지 않습니다.</p><div className="store-actions"><StoreButton type="button" className="store-button--secondary" onClick={()=>setRefresh(x=>x+1)}><RefreshCw size={15} aria-hidden="true"/>다시 확인</StoreButton></div></StoreCard>}
    {user&&state!=='unavailable'&&<>
     <nav className="ad-analysis-steps" aria-label="광고 데이터 분석 단계">
      <button type="button" className="ad-analysis-step" aria-label={`1단계 광고계정 연결, ${state==='connected'?'연결 완료':state==='pending'?'확인 대기':'연결 필요'}`} aria-current={step===1?'step':undefined} onClick={()=>setStep(1)}><span className="ad-analysis-step-number">{state==='connected'?<Check size={17} aria-hidden="true"/>:'1'}</span><span><small>STEP 01</small><strong>광고계정 연결</strong><em>{state==='connected'?'연결 완료':state==='pending'?'확인 대기':'연결 필요'}</em></span></button>
      <button type="button" className="ad-analysis-step" aria-label={`2단계 광고 데이터 분석, ${state==='connected'?'성과 확인':'연결 후 이용'}`} aria-current={step===2?'step':undefined} onClick={()=>setStep(2)}><span className="ad-analysis-step-number">2</span><span><small>STEP 02</small><strong>광고 데이터 분석</strong><em>{state==='connected'?'성과 확인':'연결 후 이용'}</em></span></button>
     </nav>
     <div hidden={step!==1} className="ad-analysis-step-panel">
      {state==='not-connected'&&<StoreCard className="ad-analysis-status"><div className="ad-analysis-status-copy"><div><StoreBadge tone="warning">연결 필요</StoreBadge><h2>광고계정 연결부터 시작하세요</h2><p>네이버 광고계정을 등록하고 권한을 확인한 뒤 내 광고 성과를 확인할 수 있습니다.</p></div></div></StoreCard>}
      {state==='pending'&&<StoreCard className="ad-analysis-status"><div className="ad-analysis-status-copy"><div><StoreBadge tone="warning">확인 대기</StoreBadge><h2>광고계정 연결을 확인하고 있어요</h2><p>초대와 권한 확인이 완료되면 광고 성과를 조회할 수 있습니다. 아래에서 요청 상태를 확인해 주세요.</p></div></div></StoreCard>}
      {state==='connected'&&<StoreCard className="ad-analysis-status"><div className="ad-analysis-status-copy"><span className="ad-analysis-status-icon"><Check size={17} aria-hidden="true"/></span><div><StoreBadge tone="primary">연결 확인됨</StoreBadge><h2>광고계정 연결됨</h2><p>계정을 추가하거나 연결 상태를 관리할 수 있습니다.</p></div></div><StoreButton type="button" className="store-button--secondary" onClick={()=>setStep(2)}>광고 분석으로 이동 <ArrowRight size={16} aria-hidden="true"/></StoreButton></StoreCard>}
      <div className="ad-analysis-connection-content"><AdConnectionPanel transport={transport} onRefresh={()=>setRefresh(x=>x+1)}/></div>
     </div>
     <div hidden={step!==2} className="ad-analysis-step-panel">
      {state==='connected'?<><StoreCard className="ad-analysis-status"><div className="ad-analysis-status-copy"><span className="ad-analysis-status-icon"><Check size={17} aria-hidden="true"/></span><div><StoreBadge tone="primary">연결 확인됨</StoreBadge><h2>광고계정 연결됨</h2><p>{performanceReady?'연결한 광고계정의 성과를 조회할 수 있습니다.':'연결한 광고계정의 성과 조회를 준비하고 있습니다.'}</p></div></div><StoreButton type="button" className="store-button--secondary" onClick={()=>setStep(1)}>계정 관리</StoreButton></StoreCard>{performanceReady?<AdPerformancePanel/>:<StoreCard className="ad-analysis-pending"><div className="ad-analysis-card-head"><div><span className="ad-analysis-section-label">PERFORMANCE</span><h2>광고 성과</h2></div><StoreBadge>준비 중</StoreBadge></div><div className="ad-analysis-empty"><div className="ad-analysis-empty-mark" aria-hidden="true"><span/><span/><span/><span/></div><p>성과 조회 기능을 준비하고 있습니다.</p><span>연결된 계정의 실제 데이터를 확인할 수 있도록 준비 중이에요.</span></div></StoreCard>}</>:<StoreCard className="ad-analysis-notice"><StoreBadge tone="warning">{state==='pending'?'확인 대기':'연결 필요'}</StoreBadge><h2>광고계정 연결 후 분석할 수 있어요</h2><p>{state==='pending'?'연결 확인이 완료되면 광고 성과를 조회할 수 있습니다.':'광고계정을 연결하면 성과를 확인할 수 있습니다.'}</p><div className="store-actions"><StoreButton type="button" className="store-button--secondary" onClick={()=>setStep(1)}>광고계정 연결로 이동</StoreButton></div></StoreCard>}
     </div>
    </>}
   </>}
   <footer className="ad-analysis-footer"><span>kitsnode</span><span>브랜드 전략 · 광고 컨설팅</span><Link href="/privacy/2026-11-23/">개인정보 처리방침</Link></footer>
  </main>
 </div>;
}
