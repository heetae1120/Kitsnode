'use client';

import {useEffect, useRef, useState} from 'react';
import Link from 'next/link';
import {memberBrowserClient} from '@/lib/member-browser-client';
import {saveMemberReturn} from '@/lib/member-return';
import {createAdConnectionTransport} from '@/lib/ad-connection-transport.mjs';
import {AdConnectionPanel} from './ad-connection-panel';
import {AdPerformancePanel} from './ad-performance-panel';
import {StoreBadge, StoreButton, StoreCard, StoreHeading} from './store-ui';

const transport=createAdConnectionTransport({enabled:process.env.NEXT_PUBLIC_AD_CONNECTION_ENABLED==='true'});
type State='loading'|'signed-out'|'connected'|'not-connected'|'unavailable';

/** UI gate only. Server endpoints must independently authenticate and authorize. */
export function AdvertiserAnalysis(){
 const [user,setUser]=useState<string|null>(null),[state,setState]=useState<State>('loading'),[refresh,setRefresh]=useState(0);
 const current=useRef<string|null>(null);
 useEffect(()=>{
  const client=memberBrowserClient();if(!client){setState('unavailable');return;}
  let mounted=true,version=0;
  const apply=(id:string|null)=>{version++;if(current.current!==id){current.current=id;setState(id?'loading':'signed-out');}else if(!id){setState('signed-out');}setUser(id);};
  const {data:{subscription}}=client.auth.onAuthStateChange((_event,session)=>{if(mounted)apply(session?.user?.id??null);});
  const initial=version;void client.auth.getSession().then(({data})=>{if(mounted&&initial===version)apply(data.session?.user?.id??null);}).catch(()=>{if(mounted)setState('unavailable');});
  return ()=>{mounted=false;current.current=null;subscription.unsubscribe();};
 },[]);
 useEffect(()=>{
  if(!user)return;
  if(!transport){setState('unavailable');return;}
  const controller=new AbortController(),owner=user;setState('loading');
  void (async()=>{try{
   const session=await memberBrowserClient()?.auth.getSession();
   if(!session?.data.session?.access_token||session.data.session.user.id!==owner||current.current!==owner){if(!controller.signal.aborted&&current.current===owner)setState('unavailable');return;}
   const data=await transport.list(session.data.session.access_token,controller.signal);
   if(!controller.signal.aborted&&current.current===owner)setState(data.connections.some(c=>c.status==='read_connected')?'connected':'not-connected');
  }catch{if(!controller.signal.aborted&&current.current===owner)setState('unavailable');}})();
  return ()=>controller.abort();
 },[user,refresh]);
 return <><StoreHeading title="광고 데이터 분석" description="연결한 광고계정의 성과를 확인하세요." />
  {state==='loading'?<StoreCard><p role="status">계정과 연결 상태를 확인하고 있습니다.</p></StoreCard>:state==='signed-out'?<StoreCard><StoreBadge>회원 전용</StoreBadge><h2>로그인 후 이용할 수 있어요</h2><p>키츠노드 회원 또는 네이버 로그인 계정으로 로그인해 주세요.</p><div className="store-actions"><Link className="store-button" href="/store/login/" onClick={saveMemberReturn}>로그인</Link><Link className="store-button store-button--secondary" href="/store/signup/" onClick={saveMemberReturn}>회원가입</Link></div></StoreCard>:<>
   {state==='unavailable'&&<StoreCard><h2>연결 상태를 확인할 수 없어요</h2><p>잠시 후 다시 확인해 주세요. 확인되지 않은 광고 데이터는 표시하지 않습니다.</p><StoreButton type="button" onClick={()=>setRefresh(x=>x+1)}>다시 확인</StoreButton></StoreCard>}
   {state==='not-connected'&&<StoreCard><StoreBadge>연결 필요</StoreBadge><h2>광고계정 연결부터 시작하세요</h2><p>네이버 광고계정을 등록하고 권한을 확인한 뒤 내 광고 성과를 확인할 수 있습니다.</p><StoreButton type="button" onClick={()=>setRefresh(x=>x+1)}>연결 상태 새로고침</StoreButton></StoreCard>}
   {state==='connected'&&<><StoreCard><div className="store-section-heading"><h2>광고계정 연결됨</h2><StoreBadge tone="primary">조회 가능</StoreBadge></div><p>선택한 광고 또는 키워드의 실제 네이버 성과를 확인합니다.</p><StoreButton type="button" onClick={()=>setRefresh(x=>x+1)}>연결 상태 새로고침</StoreButton></StoreCard><AdPerformancePanel/></>}
   {user&&<details open={state==='not-connected'}><summary>광고계정 연결 관리</summary><AdConnectionPanel transport={transport}/></details>}
  </>}
 </>;
}
