'use client';

import {useEffect, useRef, useState, type FormEvent} from 'react';
import Link from 'next/link';
import {memberBrowserClient} from '@/lib/member-browser-client';
import {saveMemberReturn} from '@/lib/member-return';
import {startAdvertiserLoginForMember} from '@/lib/naver-invite-extension.mjs';
import {createInviteConsentClient} from '@/lib/invite-consent-client.mjs';
import {approveInviteProofCandidate} from '@/lib/invite-proof-web-candidate.mjs';
import {confirmNaverInvitePolicy} from '@/lib/naver-invite-policy-client.mjs';
import {NAVER_INVITE_POLICY_ITEMS,NAVER_INVITE_POLICY_AGREEMENT} from '@/lib/naver-invite-policy.mjs';
import {StoreBadge, StoreButton, StoreCard} from './store-ui';
import {AdPolicyDialog, type PolicyDocument} from './ad-policy-dialog';
import type {AdConnectionTransport} from '@/lib/ad-connection-transport.mjs';

const consentClient=createInviteConsentClient({enabled:process.env.NEXT_PUBLIC_AD_INVITE_CONSENT_ENABLED==='true',version:process.env.NEXT_PUBLIC_AD_INVITE_CONSENT_VERSION,policyDigest:process.env.NEXT_PUBLIC_AD_INVITE_POLICY_DIGEST,policyUrl:process.env.NEXT_PUBLIC_AD_INVITE_POLICY_URL,disclosureUrl:process.env.NEXT_PUBLIC_AD_INVITE_DISCLOSURE_URL});
const proofVersion = process.env.NEXT_PUBLIC_AD_INVITE_CONSENT_VERSION || '';
const proofDigest = process.env.NEXT_PUBLIC_AD_INVITE_POLICY_DIGEST || '';
const inviteExtensionId = process.env.NEXT_PUBLIC_NAVER_INVITE_EXTENSION_ID || '';
const extensionStoreUrl = 'https://chromewebstore.google.com/detail/ciohpfgnccmnpbldolbfediamifaiocf?hl=ko';
// Incomplete build configuration must not expose a nonfunctional invitation flow.
const proofEnabled = process.env.NEXT_PUBLIC_AD_INVITE_PROOF_ENABLED === 'true' && Boolean(consentClient) && /^[a-p]{32}$/.test(inviteExtensionId);

type Connection = {requestId: string; adAccountId: string; status: string};
const statusLabels: Record<string,string> = {
  pending_review:'연결 확인 대기',
  read_connected:'광고 정보 조회 가능',
  disconnected:'연결 해제',
};

/** When no server transport is configured, no member data is submitted. */
export function AdConnectionPanel({transport,onRefresh}: {transport?: AdConnectionTransport; onRefresh?: () => void}) {
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
  const [naverPolicyAccepted,setNaverPolicyAccepted]=useState(false);
  const [savedConsent,setSavedConsent]=useState<{consentId:string;accountId:string;userId:string}|null>(null);
  const consentAccountRef=useRef('');
  const proofRef=useRef<AbortController|null>(null);
  const [consentBusy,setConsentBusy]=useState(false);
  const [consentMessage,setConsentMessage]=useState('');
  const [policyDocument,setPolicyDocument]=useState<PolicyDocument|null>(null);
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
        activeRef.current?.abort(); activeRef.current=null; proofRef.current?.abort(); proofRef.current=null; consentAccountRef.current=''; setSavedConsent(null);
        lock.current=false;setBusy(false);setConnections([]);setMessage('');setAccountId('');setInviteConsent(false);setExtensionMessage('');setConsentAccount('');setConsentAccepted(false);setNaverPolicyAccepted(false);setConsentBusy(false);setConsentMessage('');
        userRef.current=userId;
      }
      setCurrentUser(userId);setChecking(false);
    };
    const {data:{subscription}}=client.auth.onAuthStateChange((_event,session)=>{if(active)apply(session?.user?.id ?? null);});
    const initialVersion=authVersion;
    void client.auth.getSession().then(({data})=>{if(active && authVersion===initialVersion)apply(data.session?.user?.id ?? null);}).catch(()=>{if(active && authVersion===initialVersion)setChecking(false);});
    return ()=>{active=false;subscription.unsubscribe();proofRef.current?.abort();activeRef.current?.abort();activeRef.current=null;authRef.current=null;userRef.current=null;};
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

  async function discoverAccount() {
    const owner=userRef.current,client=authRef.current;
    if(!proofEnabled||!owner||!client||!transport||openingExtension||busy)return;
    const runtime=(window as unknown as {chrome?:{runtime?:{sendMessage(id:string,message:Record<string,string>):Promise<unknown>}}}).chrome?.runtime;
    if(!runtime?.sendMessage){setExtensionMessage('확장 프로그램을 설치하거나 최신 버전으로 업데이트해 주세요.');return;}
    const controller=new AbortController();proofRef.current?.abort();proofRef.current=controller;
    const nonce=window.crypto.randomUUID();setAccountId('');consentAccountRef.current='';setConsentAccount('');setSavedConsent(null);setConsentAccepted(false);setNaverPolicyAccepted(false);setOpeningExtension(true);setExtensionMessage('네이버애즈에서 연결할 광고계정을 선택해 주세요.');
    try {
      const session=await client.auth.getSession(),token=session.data.session?.access_token;
      if(!token||session.data.session?.user.id!==owner||userRef.current!==owner)throw Error('session_changed');
      const start=await runtime.sendMessage(inviteExtensionId,{type:'kitsnode.account.start.v1',nonce}) as {status?:string};
      if(start?.status!=='started')throw Error('unavailable');
      for(let i=0;i<600&&!controller.signal.aborted;i++){
        await new Promise(resolve=>setTimeout(resolve,1000));
        if(userRef.current!==owner||controller.signal.aborted) return;
        const current=await client.auth.getSession();
        if(current.data.session?.access_token!==token||current.data.session.user.id!==owner)throw Error('session_changed');
        const result=await runtime.sendMessage(inviteExtensionId,{type:'kitsnode.account.get.v1',nonce}) as {status?:string;accountId?:string};
        if(result?.status==='selected'&&/^[1-9]\d{0,15}$/.test(result.accountId||'')){
          setAccountId(result.accountId!);setExtensionMessage('선택한 광고계정을 확인한 뒤 계속해 주세요.');return;
        }
        if(result?.status!=='selecting')throw Error('unavailable');
      }
      if(!controller.signal.aborted)setExtensionMessage('계정 선택 시간이 만료됐습니다. 다시 시도해 주세요.');
    }catch{if(!controller.signal.aborted&&userRef.current===owner)setExtensionMessage('계정을 확인하지 못했습니다. 확장 프로그램과 로그인 상태를 확인해 주세요.');}
    finally{if(proofRef.current===controller){proofRef.current=null;setOpeningExtension(false);}}
  }

  async function registerDiscoveredAccount() {
    const owner=userRef.current,client=authRef.current,selected=accountId;
    if(!proofEnabled||!owner||!client||!transport||busy||openingExtension||!/^[1-9]\d{0,15}$/.test(selected))return;
    const controller=new AbortController();activeRef.current?.abort();activeRef.current=controller;setBusy(true);setMessage('');
    try{
      const session=await client.auth.getSession(),token=session.data.session?.access_token;
      if(!token||session.data.session?.user.id!==owner||userRef.current!==owner)throw Error('session_changed');
      let list=await transport.list(token,controller.signal);
      if(!list.connections.some(c=>c.adAccountId===selected&&c.status!=='disconnected')){
        const result=await transport.request(token,selected,controller.signal);
        if(result.status!=='pending_review')throw Error('invalid_response');
        list=await transport.list(token,controller.signal);
      }
      if(controller.signal.aborted||userRef.current!==owner||!list.connections.some(c=>c.adAccountId===selected&&c.status!=='disconnected'))throw Error('invalid_response');
      setConnections(list.connections);consentAccountRef.current=selected;setConsentAccount(selected);setConsentAccepted(false);setNaverPolicyAccepted(false);setSavedConsent(null);setMessage('광고계정을 확인했습니다. 사전 동의를 진행해 주세요.');
    }catch{if(!controller.signal.aborted&&userRef.current===owner)setMessage('광고계정을 등록하지 못했습니다. 연결 상태를 확인한 뒤 다시 시도해 주세요.');}
    finally{if(activeRef.current===controller){activeRef.current=null;setBusy(false);}}
  }

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
      onRefresh?.();
    } catch {if(!controller.signal.aborted && userRef.current===userId)setMessage('요청 결과를 확인하지 못했습니다. 연결 상태를 확인한 뒤 다시 시도해 주세요.');}
    finally {if(activeRef.current===controller){activeRef.current=null;lock.current=false;setBusy(false);}}
  }

  async function recordConsent(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const owner=userRef.current, client=authRef.current, selected=consentAccount;
    if(!consentClient||!consentAccepted||(proofEnabled&&!naverPolicyAccepted)||consentBusy||openingExtension||!owner||!client||!connections.some(c=>c.adAccountId===selected&&c.status!=='disconnected'))return;
    const controller=new AbortController();activeRef.current?.abort();activeRef.current=controller;setSavedConsent(null);setConsentBusy(true);setConsentMessage('');
    try {const session=await client.auth.getSession();const token=session.data.session?.access_token;
      if(!token||session.data.session?.user.id!==owner||userRef.current!==owner||controller.signal.aborted)throw Error('session_changed');
      const recorded=await consentClient.record(token,selected,controller.signal);
      if(proofEnabled){
        if(controller.signal.aborted||userRef.current!==owner||consentAccountRef.current!==selected)throw Error('session_changed');
        const policyConfirmed=await confirmNaverInvitePolicy({token,consentId:recorded.consentId,signal:controller.signal});
        const latest=await client.auth.getSession();
        if(!policyConfirmed||latest.data.session?.access_token!==token||latest.data.session?.user.id!==owner||controller.signal.aborted||consentAccountRef.current!==selected||userRef.current!==owner)throw Error('policy_unconfirmed');
      }
      if(!controller.signal.aborted&&userRef.current===owner&&consentAccountRef.current===selected){setSavedConsent({consentId:recorded.consentId,accountId:selected,userId:owner});setConsentAccepted(false);setNaverPolicyAccepted(false);setConsentMessage(proofEnabled?'사전 동의를 저장했습니다. 10분 안에 확장프로그램으로 연결을 진행해 주세요. 초대는 아직 발송되지 않았습니다.':'사전 동의를 저장했습니다. 이 동의는 저장 후 10분간 유효하며, 만료되면 다시 저장해야 합니다. 확장프로그램 자동 초대는 아직 연결되지 않아 초대가 발송되지 않았습니다.');}
    }catch {if(!controller.signal.aborted&&userRef.current===owner)setConsentMessage(proofEnabled?'동의 및 네이버 정책 확인을 완료하지 못했습니다. 기존 동의는 저장되었을 수 있으며 초대는 발송되지 않았습니다. 로그인 상태를 확인한 뒤 다시 시도해 주세요.':'사전 동의를 저장하지 못했습니다. 로그인과 키츠노드 이용약관·개인정보 동의 상태를 확인한 뒤 다시 시도해 주세요.');}
    finally {if(activeRef.current===controller){activeRef.current=null;setConsentBusy(false);}}
  }

  async function startConsentedInvitation() {
    if(!proofEnabled || extensionLock.current || !savedConsent || openingExtension || !authRef.current || userRef.current!==savedConsent.userId || consentAccountRef.current!==savedConsent.accountId) return;
    const {consentId,accountId,userId}=savedConsent, client=authRef.current;
    if(!connections.some(c=>c.adAccountId===accountId&&c.status!=='disconnected'))return;
    const controller=new AbortController();extensionLock.current=true;proofRef.current?.abort();proofRef.current=controller;setSavedConsent(null);setOpeningExtension(true);setExtensionMessage('확장프로그램과 광고계정을 확인하고 있습니다.');
    try {
      const runtime=(window as unknown as {chrome?:{runtime?:{sendMessage(id:string,message:Record<string,string>):Promise<unknown>}}}).chrome?.runtime;
      const result=await approveInviteProofCandidate({consentId,accountId,consentVersion:proofVersion,policyDigest:proofDigest,nonce:window.crypto.randomUUID(),extension:inviteExtensionId,runtime,getSession:()=>client.auth.getSession(),isCurrent:id=>userRef.current===id&&consentAccountRef.current===accountId,userId,signal:controller.signal});
      if(!controller.signal.aborted&&userRef.current===userId)setExtensionMessage(result.status==='approved'?'확장프로그램에 실행 신호를 전달했습니다. 초대와 수락 및 연결 확인은 별도로 진행됩니다.':'연결을 완료하지 못했습니다. 네이버 화면과 연결 상태를 확인한 뒤 다시 동의해 주세요.');
    } catch {if(!controller.signal.aborted&&userRef.current===userId)setExtensionMessage('결과를 확인하지 못했습니다. 네이버 화면과 연결 상태를 확인한 뒤 다시 동의해 주세요.');}
    finally {extensionLock.current=false;if(proofRef.current===controller){proofRef.current=null;setOpeningExtension(false);}}
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
      onRefresh?.();
    } catch {if(!controller.signal.aborted && userRef.current===userId)setMessage('해제 결과를 확인하지 못했습니다. 연결 상태를 다시 확인해 주세요.');}
    finally {if(activeRef.current===controller){activeRef.current=null;lock.current=false;setBusy(false);}}
  }

  return <StoreCard aria-labelledby="ad-connection-panel-title">
    <StoreBadge tone="warning">{transport ? '권한 확인 후 연결' : '연결 기능 준비 중'}</StoreBadge>
    <h2 id="ad-connection-panel-title">네이버 광고 계정 연결</h2>
    <p>광고 성과 조회를 위해 네이버 광고계정을 연결해 주세요.</p>
    {!proofEnabled && <><ol className="list-decimal space-y-2 pl-5">
      <li><a className="store-text-link" href="https://ads.naver.com/settings/ad-account" target="_blank" rel="noopener noreferrer">네이버애즈 열기 (새 창)</a>에서 광고주 계정으로 로그인합니다.</li>
      <li>권한 관리에서 회원 ID <strong>kitsnode</strong>를 <strong>운영 조회</strong> 권한으로 초대합니다. 네이버 정책과 초대 발송 상태를 확인해 주세요.</li>
      <li>광고 계정 ID를 입력하고 연결 확인을 요청합니다.</li>
    </ol>
    <details className="ad-invite-method">
      <summary>Chrome 확장 프로그램으로 연결하기</summary>
      <p>Chrome에서 <a className="store-text-link" href={extensionStoreUrl} target="_blank" rel="noopener noreferrer">확장 프로그램을 설치</a>하고 네이버애즈에서 광고주 계정으로 로그인해 주세요. 확장 프로그램의 안내에 따라 <strong>kitsnode</strong>를 <strong>운영 조회</strong> 권한으로 초대합니다. 다른 권한이 표시되면 직접 초대해 주세요.</p>
      <p className="store-caption">네이버 정책과 초대 발송 상태를 직접 확인해 주세요. 초대 발송과 연결 완료는 별도 단계입니다.</p>
    {!proofEnabled && /^[a-p]{32}$/.test(inviteExtensionId) && signedIn && <div>
      <p>확장 프로그램을 사용하면 네이버애즈를 열어 연결을 시작할 수 있습니다. 광고주가 계정과 권한을 확인하고 초대 결과를 직접 확인해 주세요.</p>
      <label><input type="checkbox" checked={inviteConsent} disabled={openingExtension} onChange={e=>setInviteConsent(e.target.checked)} /> 키츠노드에 운영 조회 권한을 초대하는 절차를 확인했습니다.</label>{' '}
      <StoreButton type="button" onClick={()=>void openAdvertiserLogin()} disabled={openingExtension || !inviteConsent}>{openingExtension?'여는 중…':'확장 프로그램으로 네이버애즈 열기'}</StoreButton>
      <p className="store-caption">초대가 자동으로 완료되거나 담당자가 수락된 것은 아닙니다. 네이버에서 진행 상태를 확인해 주세요.</p>
      {extensionMessage && <p role="status" aria-live="polite">{extensionMessage}</p>}
    </div>}
    </details>
    </>}
    {proofEnabled && <section><h3>1. 광고계정 선택</h3><p>네이버애즈에서 연결할 광고계정을 선택해 주세요. <a className="store-text-link" href={extensionStoreUrl} target="_blank" rel="noopener noreferrer">확장 프로그램 설치 또는 업데이트</a></p>{!signedIn&&<p><Link className="store-text-link" href="/store/login/" onClick={saveMemberReturn}>로그인 후 연결하기</Link></p>}<StoreButton type="button" disabled={!signedIn||openingExtension||busy} onClick={()=>void discoverAccount()}>{openingExtension?'계정 확인 중…':'네이버 광고계정 선택'}</StoreButton>{extensionMessage&&<p role="status">{extensionMessage}</p>}{accountId&&<div><p>선택한 광고 계정 ID: <strong>{accountId}</strong></p><StoreButton type="button" disabled={busy||openingExtension} onClick={()=>void registerDiscoveredAccount()}>{busy?'확인 중…':'이 계정으로 계속'}</StoreButton></div>}</section>}
    <details className="ad-invite-method" open={proofEnabled && Boolean(consentAccount)}><summary>{proofEnabled?'2. 광고계정 연결 사전 동의':'광고계정 연결 사전 동의'}</summary>
      <p>광고계정 연결 및 성과 정보 조회에 관한 내용입니다.</p>
      {consentClient&&signedIn&&connections.some(c=>c.status!=='disconnected')?<form onSubmit={recordConsent}>
        <label htmlFor="consent-account">동의할 광고계정</label><select id="consent-account" value={consentAccount} onChange={e=>{proofRef.current?.abort();proofRef.current=null;setOpeningExtension(false);consentAccountRef.current=e.target.value;setConsentAccount(e.target.value);setSavedConsent(null);setConsentAccepted(false);setNaverPolicyAccepted(false);setConsentMessage('');setExtensionMessage('');}} disabled={consentBusy}><option value="">계정을 선택하세요</option>{connections.filter(c=>c.status!=='disconnected').map(c=><option key={c.requestId} value={c.adAccountId}>{c.adAccountId}</option>)}</select>
        <p>사전 동의는 저장 후 10분간 유효합니다. 만료되면 다시 저장해 주세요. {proofEnabled?'동의 저장만으로 초대가 발송되지 않습니다.':'확장프로그램 자동 초대는 아직 연결되지 않아 동의 저장만으로 초대가 발송되지 않습니다.'}</p>
        {proofEnabled&&/^[a-p]{32}$/.test(inviteExtensionId)&&<p><a className="store-text-link" href={`https://chromewebstore.google.com/detail/${inviteExtensionId}`} target="_blank" rel="noopener noreferrer">Chrome 웹 스토어에서 확장프로그램 설치 (새 창)</a></p>}
        <p><button type="button" className="store-text-link" onClick={()=>setPolicyDocument({title:'키츠노드 광고계정 연결 및 데이터 분석 사전 동의',url:consentClient.disclosureUrl,kind:'disclosure'})}>키츠노드 사전 동의 내용 보기</button></p>
        <p><button type="button" className="store-text-link" onClick={()=>setPolicyDocument({title:'네이버 운영정책',url:consentClient.policyUrl,kind:'policy'})}>네이버 운영정책 보기</button></p>
        {proofEnabled&&<section aria-labelledby="naver-invite-policy-title"><h4 id="naver-invite-policy-title">네이버 회원 초대 정책</h4><p>네이버 회원 초대 화면에 표시되는 내용입니다. 변경되면 다시 확인이 필요합니다.</p><ol>{NAVER_INVITE_POLICY_ITEMS.map((item)=><li key={item}>{item}</li>)}</ol><label><input type="checkbox" checked={naverPolicyAccepted} onChange={e=>{setSavedConsent(null);setNaverPolicyAccepted(e.target.checked);}} disabled={!consentAccount||consentBusy||openingExtension}/> {NAVER_INVITE_POLICY_AGREEMENT}</label></section>}
        <label><input type="checkbox" checked={consentAccepted} onChange={e=>{setSavedConsent(null);setConsentAccepted(e.target.checked);}} disabled={!consentAccount||consentBusy||openingExtension}/> 선택한 계정의 키츠노드 사전 동의 내용을 확인하고 동의합니다.</label>
        <StoreButton type="submit" disabled={!consentAccepted||(proofEnabled&&!naverPolicyAccepted)||!consentAccount||consentBusy||openingExtension}>{consentBusy?'저장 중…':'사전 동의 저장'}</StoreButton>
        {consentMessage&&<p role="status">{consentMessage}</p>}
        {proofEnabled&&/^[a-p]{32}$/.test(inviteExtensionId)&&<><StoreButton type="button" disabled={!savedConsent||openingExtension||consentBusy} onClick={()=>void startConsentedInvitation()}>{openingExtension?'확인 중…':'확장프로그램으로 연결 진행'}</StoreButton>{extensionMessage&&<p role="status">{extensionMessage}</p>}</>}
      </form>:<p>{consentClient && signedIn ? '먼저 광고 계정 ID로 연결 확인을 요청해 주세요.' : '현재 연결 확인 요청은 광고계정 번호만 접수합니다. 사전 동의 저장과 자동 초대는 제공되지 않습니다.'}</p>}
    </details>
    <AdPolicyDialog document={policyDocument} onClose={()=>setPolicyDocument(null)}/>
    {!proofEnabled && <><h3>초대 후 연결 확인 요청</h3>
    {checking ? <p role="status">로그인 상태를 확인하고 있어요.</p> : !signedIn ? <p><Link className="store-text-link" href="/store/login/" onClick={saveMemberReturn}>로그인 후 연결하기</Link></p> : <form onSubmit={submit}>
      <label htmlFor="naver-ad-account-id">광고 계정 ID</label>{' '}
      <input id="naver-ad-account-id" inputMode="numeric" autoComplete="off" maxLength={16} value={accountId} onChange={e=>setAccountId(e.target.value)} disabled={!transport || busy} aria-describedby="ad-account-hint" />
      <p id="ad-account-hint" className="store-caption">네이버애즈 광고 계정 정보에서 확인할 수 있는 숫자입니다. 비밀번호나 API 키는 입력하지 마세요.</p>
      <StoreButton type="submit" disabled={!transport || busy}>{busy?'요청 중…':'연결 확인 요청'}</StoreButton>
    </form>}
    </>}
    <details className="ad-invite-method"><summary>연결 도움말</summary><p>초대 발송과 담당자 수락은 직접 확인해 주세요. 관리계정만으로 연결된 광고 계정은 현재 자동으로 확인할 수 없습니다. 검색광고 API 고객 ID는 별도로 확인합니다.</p></details>
    {!transport && <p className="store-caption">연결 서버 준비가 끝나면 요청할 수 있습니다.</p>}
    {message && <p role="status" aria-live="polite">{message}</p>}
    {signedIn && transport && <StoreButton type="button" disabled={busy} onClick={()=>{setRefreshKey(previous=>previous+1);onRefresh?.();}}>연결 상태 새로고침</StoreButton>}
    {connections.length>0 && <div><h3>내 연결 요청</h3><ul>{connections.map(c=><li key={c.requestId}>광고 계정 {c.adAccountId}: {statusLabels[c.status] || '상태 확인 필요'} {c.status!=='disconnected' && <StoreButton type="button" disabled={busy} onClick={()=>void disconnect(c)}>연결 해제</StoreButton>}</li>)}</ul></div>}
  </StoreCard>;
}
