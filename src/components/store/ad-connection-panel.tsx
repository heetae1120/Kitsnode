'use client';

import {useEffect, useRef, useState, type FormEvent} from 'react';
import Link from 'next/link';
import {memberBrowserClient} from '@/lib/member-browser-client';
import {saveMemberReturn} from '@/lib/member-return';
import {startAdvertiserLoginForMember} from '@/lib/naver-invite-extension.mjs';
import {createInviteConsentClient} from '@/lib/invite-consent-client.mjs';
import {StoreBadge, StoreButton, StoreCard} from './store-ui';
import type {AdConnectionTransport} from '@/lib/ad-connection-transport.mjs';

const consentClient=createInviteConsentClient({enabled:process.env.NEXT_PUBLIC_AD_INVITE_CONSENT_ENABLED==='true',version:process.env.NEXT_PUBLIC_AD_INVITE_CONSENT_VERSION,policyDigest:process.env.NEXT_PUBLIC_AD_INVITE_POLICY_DIGEST,policyUrl:process.env.NEXT_PUBLIC_AD_INVITE_POLICY_URL});
const inviteExtensionId = process.env.NEXT_PUBLIC_NAVER_INVITE_EXTENSION_ID || '';

type Connection = {requestId: string; adAccountId: string; status: string};
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
  const [refreshKey,setRefreshKey] = useState(0);
  const [inviteConsent,setInviteConsent] = useState(false);
  const [consentAccount,setConsentAccount]=useState('');
  const [consentAccepted,setConsentAccepted]=useState(false);
  const [consentBusy,setConsentBusy]=useState(false);
  const [consentMessage,setConsentMessage]=useState('');
  const [openingExtension,setOpeningExtension] = useState(false);
  const [extensionMessage,setExtensionMessage] = useState('');
  const lock = useRef(false);
  const extensionLock = useRef(false);
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
        lock.current=false;setBusy(false);setConnections([]);setMessage('');setAccountId('');setInviteConsent(false);setExtensionMessage('');setConsentAccount('');setConsentAccepted(false);setConsentBusy(false);setConsentMessage('');
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
  },[currentUser,transport,refreshKey]);

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
      setRefreshKey(previous=>previous+1);
      setMessage('연결 확인을 요청했습니다. 담당자가 광고 계정 접근 권한을 확인한 뒤 연결됩니다.');
    } catch {if(!controller.signal.aborted && userRef.current===userId)setMessage('요청 결과를 확인하지 못했습니다. 연결 상태를 확인한 뒤 다시 시도해 주세요.');}
    finally {if(activeRef.current===controller){activeRef.current=null;lock.current=false;setBusy(false);}}
  }

  async function recordConsent(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const owner=userRef.current, client=authRef.current, selected=consentAccount;
    if(!consentClient||!consentAccepted||consentBusy||!owner||!client||!connections.some(c=>c.adAccountId===selected&&c.status!=='disconnected'))return;
    const controller=new AbortController();activeRef.current?.abort();activeRef.current=controller;setConsentBusy(true);setConsentMessage('');
    try {const session=await client.auth.getSession();const token=session.data.session?.access_token;
      if(!token||session.data.session?.user.id!==owner||userRef.current!==owner||controller.signal.aborted)throw Error('session_changed');
      await consentClient.record(token,selected,controller.signal);
      if(!controller.signal.aborted&&userRef.current===owner){setConsentAccepted(false);setConsentMessage('사전 동의를 저장했습니다. 초대 발송과 권한 수락은 별도입니다.');}
    }catch {if(!controller.signal.aborted&&userRef.current===owner)setConsentMessage('사전 동의를 저장하지 못했습니다. 잠시 후 다시 확인해 주세요.');}
    finally {if(activeRef.current===controller){activeRef.current=null;setConsentBusy(false);}}
  }

  async function openAdvertiserLogin() {
    if(extensionLock.current || !signedIn || !inviteConsent) return;
    const owner=userRef.current,client=authRef.current;
    if(!owner || !client) return;
    extensionLock.current=true;setOpeningExtension(true);setExtensionMessage('');
    try {
      const browser=window as unknown as {chrome?: {runtime?: {sendMessage(extensionId:string,message:{type:string;nonce:string}):Promise<unknown>}}};
      const result=await startAdvertiserLoginForMember({getSession:()=>client.auth.getSession(),currentUserId:owner,isCurrent:id=>userRef.current===id,extensionId:inviteExtensionId,runtime:browser.chrome?.runtime,crypto:window.crypto,consent:inviteConsent});
      if(userRef.current!==owner) return;
      setExtensionMessage(result.status==='opened' ? '네이버애즈를 열었습니다. 광고주 계정으로 로그인하고 초대 진행 상태를 직접 확인해 주세요.' : '확장 프로그램을 열지 못했습니다. 아래 수동 연결 안내를 이용해 주세요.');
    } catch {if(userRef.current===owner)setExtensionMessage('확장 프로그램을 열지 못했습니다. 아래 수동 연결 안내를 이용해 주세요.');}
    finally {extensionLock.current=false;setOpeningExtension(false);}
  }

  async function disconnect(connection: Connection) {
    if(lock.current || !transport || !signedIn) return;
    if(!window.confirm(`광고 계정 ${connection.adAccountId}의 키츠노드 연결을 해제할까요? 네이버에서 부여한 권한은 직접 해제해야 합니다.`)) return;
    const userId=userRef.current;
    const controller=new AbortController();activeRef.current?.abort();activeRef.current=controller;
    lock.current=true;setBusy(true);setMessage('');
    try {
      const session=await authRef.current?.auth.getSession();
      const token=session?.data.session?.access_token;
      if(!token || !userId || session?.data.session?.user.id!==userId || userRef.current!==userId || controller.signal.aborted) throw new Error('session_changed');
      await transport.disconnect(token,connection.requestId,controller.signal);
      if(controller.signal.aborted || userRef.current!==userId) return;
      setConnections(previous=>previous.map(item=>item.requestId===connection.requestId ? {...item,status:'disconnected'} : item));
      setMessage('키츠노드 연결을 해제했습니다. 네이버에서 부여한 권한은 광고주가 직접 해제해 주세요.');
    } catch {if(!controller.signal.aborted && userRef.current===userId)setMessage('해제 결과를 확인하지 못했습니다. 연결 상태를 다시 확인해 주세요.');}
    finally {if(activeRef.current===controller){activeRef.current=null;lock.current=false;setBusy(false);}}
  }

  return <StoreCard aria-labelledby="ad-connection-panel-title">
    <StoreBadge tone="warning">{transport ? '권한 확인 후 연결' : '연결 기능 준비 중'}</StoreBadge>
    <h2 id="ad-connection-panel-title">네이버 광고 계정 연결</h2>
    <p>키츠노드는 광고와 성과 정보 조회를 위해 운영 조회 권한을 요청합니다. 네이버 비밀번호나 API 키를 키츠노드에 입력하지 마세요.</p>
    <p>네이버애즈의 광고 계정 ID를 입력해 주세요. 검색광고 API의 고객 ID는 별도로 확인합니다.</p>
    <p>광고주가 네이버애즈에 직접 로그인해 초대해 주세요. 키츠노드 회원 로그인과 네이버 광고주 로그인은 별개입니다.</p>
    <section aria-labelledby="invite-consent-title"><h3 id="invite-consent-title">광고계정 연결 사전 동의</h3>
      <p>광고 분석을 위해 연결할 광고계정에 관해 다음 절차를 안내합니다.</p>
      <ul className="store-list"><li>Chrome 확장프로그램을 이용한 네이버 광고계정 연결</li><li>네이버의 개인정보 제공 및 회원 초대 정책 동의</li><li>회원 ID <strong>kitsnode</strong> 초대와 <strong>운영 조회</strong> 권한 선택</li><li>연결된 계정의 광고와 성과 정보 조회</li></ul>
      {consentClient&&signedIn&&connections.some(c=>c.status!=='disconnected')?<form onSubmit={recordConsent}>
        <label htmlFor="consent-account">동의할 광고계정</label><select id="consent-account" value={consentAccount} onChange={e=>{setConsentAccount(e.target.value);setConsentAccepted(false);setConsentMessage('');}} disabled={consentBusy}><option value="">계정을 선택하세요</option>{connections.filter(c=>c.status!=='disconnected').map(c=><option key={c.requestId} value={c.adAccountId}>{c.adAccountId}</option>)}</select>
        <p><a className="store-text-link" href={consentClient.policyUrl} target="_blank" rel="noopener noreferrer">네이버 정책 확인 (새 창)</a></p>
        <label><input type="checkbox" checked={consentAccepted} onChange={e=>setConsentAccepted(e.target.checked)} disabled={!consentAccount||consentBusy}/> 선택한 계정의 위 연결 절차와 네이버 정책을 확인하고 동의합니다.</label>
        <StoreButton type="submit" disabled={!consentAccepted||!consentAccount||consentBusy}>{consentBusy?'저장 중…':'사전 동의 저장'}</StoreButton>
        {consentMessage&&<p role="status">{consentMessage}</p>}
      </form>:<p>사전 동의의 계정별 저장과 자동 초대 기능은 연결 준비 중입니다. 현재 아래 연결 확인 요청은 광고계정 번호만 접수하며, 이 동의를 저장하거나 초대를 자동 발송하지 않습니다.</p>}
    </section>
    {/^[a-p]{32}$/.test(inviteExtensionId) && signedIn && <div>
      <p>확장 프로그램을 사용하면 네이버애즈를 열어 연결을 시작할 수 있습니다. 광고주가 계정과 권한을 확인하고 초대 결과를 직접 확인해 주세요.</p>
      <label><input type="checkbox" checked={inviteConsent} disabled={openingExtension} onChange={e=>setInviteConsent(e.target.checked)} /> 키츠노드에 운영 조회 권한을 초대하는 절차를 확인했습니다.</label>{' '}
      <StoreButton type="button" onClick={()=>void openAdvertiserLogin()} disabled={openingExtension || !inviteConsent}>{openingExtension?'여는 중…':'확장 프로그램으로 네이버애즈 열기'}</StoreButton>
      <p className="store-caption">초대가 자동으로 완료되거나 담당자가 수락된 것은 아닙니다. 네이버에서 진행 상태를 확인해 주세요.</p>
      {extensionMessage && <p role="status" aria-live="polite">{extensionMessage}</p>}
    </div>}
    <h3>직접 연결하기</h3>
    <ol className="list-decimal space-y-2 pl-5">
      <li><a className="store-text-link" href="https://ads.naver.com/settings/ad-account" target="_blank" rel="noopener noreferrer">네이버애즈 열기 (새 창)</a>를 눌러 광고주 계정으로 로그인합니다.</li>
      <li>연결할 광고 계정의 권한 관리에서 회원 초대를 선택합니다.</li>
      <li>회원 ID <strong>kitsnode</strong>를 운영 조회 권한으로 초대한 뒤 이 화면으로 돌아옵니다.</li>
      <li>아래에서 광고 계정 ID를 입력해 연결 확인을 요청합니다. 담당자가 계정 관계와 권한을 확인한 뒤 연결합니다.</li>
    </ol>
    <p className="store-caption">초대 발송과 담당자 수락은 직접 확인이 필요합니다. 관리계정만으로 연결된 광고 계정은 현재 자동으로 확인할 수 없습니다.</p>
    <p>부여한 권한의 범위는 네이버에서 확인해 주세요. 자동 입찰은 현재 안전 검증을 위해 중단되어 있습니다.</p>
    {checking ? <p role="status">로그인 상태를 확인하고 있어요.</p> : !signedIn ? <p><Link className="store-text-link" href="/store/login/" onClick={saveMemberReturn}>로그인 후 연결하기</Link></p> : <form onSubmit={submit}>
      <label htmlFor="naver-ad-account-id">광고 계정 ID</label>{' '}
      <input id="naver-ad-account-id" inputMode="numeric" autoComplete="off" maxLength={16} value={accountId} onChange={e=>setAccountId(e.target.value)} disabled={!transport || busy} aria-describedby="ad-account-hint" />
      <p id="ad-account-hint" className="store-caption">네이버애즈 광고 계정 정보에서 확인할 수 있는 숫자입니다.</p>
      <StoreButton type="submit" disabled={!transport || busy}>{busy?'요청 중…':'연결 확인 요청'}</StoreButton>
    </form>}
    {!transport && <p className="store-caption">연결 서버 준비가 끝나면 요청할 수 있습니다.</p>}
    {message && <p role="status" aria-live="polite">{message}</p>}
    {signedIn && transport && <StoreButton type="button" disabled={busy} onClick={()=>setRefreshKey(previous=>previous+1)}>연결 상태 새로고침</StoreButton>}
    {connections.length>0 && <div><h3>내 연결 요청</h3><ul>{connections.map(c=><li key={c.requestId}>광고 계정 {c.adAccountId}: {statusLabels[c.status] || '상태 확인 필요'} {c.status!=='disconnected' && <StoreButton type="button" disabled={busy} onClick={()=>void disconnect(c)}>연결 해제</StoreButton>}</li>)}</ul></div>}
  </StoreCard>;
}
