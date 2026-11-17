'use client';

import {useEffect, useRef, useState, type FormEvent} from 'react';
import Link from 'next/link';
import {memberBrowserClient} from '@/lib/member-browser-client';
import {StoreBadge, StoreButton, StoreCard} from './store-ui';
import type {AdConnectionTransport} from '@/lib/ad-connection-transport.mjs';

type Connection = {adAccountId: string; status: string};
const statusLabels: Record<string,string> = {
  pending_review:'연결 확인 대기',
  read_connected:'광고 정보 조회 가능',
  disconnected:'연결 해제',
};

/** When no server transport is configured, no member data is submitted. */
export function AdConnectionPanel({transport}: {transport?: AdConnectionTransport}) {
  const [currentUser,setCurrentUser] = useState<string|null>(null);
  const signedIn = Boolean(currentUser);
  const [checking,setChecking] = useState(true);
  const [accountId,setAccountId] = useState('');
  const [connections,setConnections] = useState<Connection[]>([]);
  const [message,setMessage] = useState('');
  const [busy,setBusy] = useState(false);
  const lock = useRef(false);
  const userRef = useRef<string|null>(null);
  const activeRef = useRef<AbortController|null>(null);
  const authRef = useRef<ReturnType<typeof memberBrowserClient>>(null);

  useEffect(()=>{
    let active=true;
    const client=memberBrowserClient();
    authRef.current=client;
    if(!client){setChecking(false);return;}
    let authVersion=0;
    const apply=(userId:string|null)=>{
      authVersion++;
      if(userRef.current!==userId){
        activeRef.current?.abort(); activeRef.current=null;
        lock.current=false;setBusy(false);setConnections([]);setMessage('');setAccountId('');
        userRef.current=userId;
      }
      setCurrentUser(userId);setChecking(false);
    };
    const {data:{subscription}}=client.auth.onAuthStateChange((_event,session)=>{if(active)apply(session?.user?.id ?? null);});
    const initialVersion=authVersion;
    void client.auth.getSession().then(({data})=>{if(active && authVersion===initialVersion)apply(data.session?.user?.id ?? null);}).catch(()=>{if(active && authVersion===initialVersion)setChecking(false);});
    return ()=>{active=false;subscription.unsubscribe();activeRef.current?.abort();activeRef.current=null;authRef.current=null;userRef.current=null;};
  },[]);

  useEffect(()=>{
    if(!signedIn || !transport) return;
    const userId=userRef.current;
    const controller=new AbortController();
    activeRef.current?.abort();activeRef.current=controller;
    void (async()=>{
      try {
        const session=await authRef.current?.auth.getSession();
        const token=session?.data.session?.access_token;
        if(!token || !userId || session?.data.session?.user.id!==userId || userRef.current!==userId || controller.signal.aborted) return;
        const result=await transport.list(token,controller.signal);
        if(!controller.signal.aborted && userRef.current===userId && Array.isArray(result.connections)) setConnections(result.connections.filter(x=>typeof x.adAccountId==='string' && /^[1-9]\d{0,15}$/.test(x.adAccountId) && typeof x.status==='string'));
      } catch {if(!controller.signal.aborted && userRef.current===userId)setMessage('연결 상태를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.');}
    })();
    return ()=>{controller.abort();if(activeRef.current===controller)activeRef.current=null;};
  },[currentUser,transport]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(lock.current || !transport || !signedIn) return;
    const adAccountId=accountId.trim();
    if(!/^[1-9]\d{0,15}$/.test(adAccountId)){setMessage('네이버애즈 광고 계정 ID를 숫자로 입력해 주세요.');return;}
    const userId=userRef.current;
    const controller=new AbortController();activeRef.current?.abort();activeRef.current=controller;
    lock.current=true;setBusy(true);setMessage('');
    try {
      const session=await authRef.current?.auth.getSession();
      const token=session?.data.session?.access_token;
      if(!token || !userId || session?.data.session?.user.id!==userId || userRef.current!==userId || controller.signal.aborted) throw new Error('session_changed');
      const result=await transport.request(token,adAccountId,controller.signal);
      if(controller.signal.aborted || userRef.current!==userId) return;
      if(result?.status!=='pending_review') throw new Error('invalid_response');
      setConnections(previous=>[...previous.filter(x=>x.adAccountId!==adAccountId),{adAccountId,status:'pending_review'}]);
      setMessage('연결 확인을 요청했습니다. 담당자가 광고 계정 접근 권한을 확인한 뒤 연결됩니다.');
    } catch {if(!controller.signal.aborted && userRef.current===userId)setMessage('요청 결과를 확인하지 못했습니다. 연결 상태를 확인한 뒤 다시 시도해 주세요.');}
    finally {if(activeRef.current===controller){activeRef.current=null;lock.current=false;setBusy(false);}}
  }

  return <StoreCard aria-labelledby="ad-connection-panel-title">
    <StoreBadge tone="warning">{transport ? '권한 확인 후 연결' : '연결 기능 준비 중'}</StoreBadge>
    <h2 id="ad-connection-panel-title">네이버 광고 계정 연결</h2>
    <p>키츠노드는 광고 정보 조회와 사용자가 신청한 입찰 관리를 위해 접근을 요청합니다. 네이버 비밀번호나 API 키를 입력하지 마세요.</p>
    <p>네이버애즈의 광고 계정 ID를 입력해 주세요. 검색광고 API의 고객 ID는 별도로 확인합니다.</p>
    <p>네이버 관리계정 연결 또는 개별 회원 권한 부여를 완료한 뒤에도, 담당자가 신청자와 계정의 관계를 확인해야 연결됩니다.</p>
    <p>부여한 권한의 범위는 네이버에서 확인해 주세요. 자동 입찰은 현재 안전 검증을 위해 중단되어 있습니다.</p>
    {checking ? <p role="status">로그인 상태를 확인하고 있어요.</p> : !signedIn ? <p><Link className="store-text-link" href="/store/login/">로그인 후 연결하기</Link></p> : <form onSubmit={submit}>
      <label htmlFor="naver-ad-account-id">광고 계정 ID</label>{' '}
      <input id="naver-ad-account-id" inputMode="numeric" autoComplete="off" maxLength={16} value={accountId} onChange={e=>setAccountId(e.target.value)} disabled={!transport || busy} aria-describedby="ad-account-hint" />
      <p id="ad-account-hint" className="store-caption">네이버애즈 광고 계정 정보에서 확인할 수 있는 숫자입니다.</p>
      <StoreButton type="submit" disabled={!transport || busy}>{busy?'요청 중…':'연결 확인 요청'}</StoreButton>
    </form>}
    {!transport && <p className="store-caption">연결 서버 준비가 끝나면 요청할 수 있습니다.</p>}
    {message && <p role="status" aria-live="polite">{message}</p>}
    {connections.length>0 && <div><h3>내 연결 요청</h3><ul>{connections.map(c=><li key={c.adAccountId}>광고 계정 {c.adAccountId}: {statusLabels[c.status] || '상태 확인 필요'}</li>)}</ul></div>}
  </StoreCard>;
}
