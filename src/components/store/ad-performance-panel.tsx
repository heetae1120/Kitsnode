'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {memberBrowserClient} from '@/lib/member-browser-client';
import {createShoppingPreviewClient,type ShoppingItem} from '@/lib/shopping-preview-client.mjs';
import {createAdPerformanceClient} from '@/lib/ad-performance-client.mjs';
import {AdPerformanceResult} from './ad-performance-result';
import {AdPerformanceSelect} from './ad-performance-select';
import {StoreButton,StoreCard} from './store-ui';

const enabled=process.env.NEXT_PUBLIC_AD_PERFORMANCE_ENABLED==='true';
const catalog=createShoppingPreviewClient({enabled});
const performance=createAdPerformanceClient({enabled});

export function AdPerformancePanel(){
 const [user,setUser]=useState<string|null>(null),[checking,setChecking]=useState(true),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const [kind,setKind]=useState<'product'|'keyword'>('product');
 const [connections,setConnections]=useState<ShoppingItem[]>([]),[campaigns,setCampaigns]=useState<ShoppingItem[]>([]),[groups,setGroups]=useState<ShoppingItem[]>([]),[targets,setTargets]=useState<ShoppingItem[]>([]);
 const [connection,setConnection]=useState(''),[campaign,setCampaign]=useState(''),[group,setGroup]=useState(''),[target,setTarget]=useState(''),[since,setSince]=useState(''),[until,setUntil]=useState('');
 const [result,setResult]=useState<unknown>(null);
 const current=useRef<string|null>(null),active=useRef<AbortController|null>(null),auth=useRef<ReturnType<typeof memberBrowserClient>>(null);
 useEffect(()=>{if(!enabled){setChecking(false);return;}const client=memberBrowserClient();auth.current=client;if(!client){setChecking(false);return;}let mounted=true,version=0;
  const apply=(id:string|null)=>{version++;if(current.current!==id){active.current?.abort();active.current=null;current.current=id;setConnections([]);setCampaigns([]);setGroups([]);setTargets([]);setConnection('');setCampaign('');setGroup('');setTarget('');setResult(null);setMessage('');setBusy(false);}setUser(id);setChecking(false);};
  const {data:{subscription}}=client.auth.onAuthStateChange((_event,session)=>{if(mounted)apply(session?.user?.id??null);});const initial=version;
  void client.auth.getSession().then(({data})=>{if(mounted&&initial===version)apply(data.session?.user?.id??null);}).catch(()=>{if(mounted&&initial===version)setChecking(false);});
  return ()=>{mounted=false;subscription.unsubscribe();active.current?.abort();current.current=null;auth.current=null;};
 },[]);
 async function run<T>(work:(token:string,signal:AbortSignal)=>Promise<T>,apply:(value:T)=>void){const owner=current.current;if(!owner)return;const controller=new AbortController();active.current?.abort();active.current=controller;setBusy(true);setMessage('');
  try{const session=await auth.current?.auth.getSession();const token=session?.data.session?.access_token;if(!token||session?.data.session?.user.id!==owner||current.current!==owner||controller.signal.aborted)throw Error('session_changed');const value=await work(token,controller.signal);if(!controller.signal.aborted&&current.current===owner)apply(value);}
  catch{if(!controller.signal.aborted&&current.current===owner)setMessage('광고 성과를 조회하지 못했습니다. 연결 상태와 조회 기간을 확인해 주세요.');}
  finally{if(active.current===controller){active.current=null;setBusy(false);}}
 }
 useEffect(()=>{if(!user||!catalog)return;void run((token,signal)=>catalog.catalog(token,{action:'connections'},signal),setConnections);return ()=>active.current?.abort();},[user]);
 function chooseConnection(id:string,nextKind=kind){active.current?.abort();setConnection(id);setCampaign('');setGroup('');setTarget('');setCampaigns([]);setGroups([]);setTargets([]);setResult(null);if(id&&catalog)void run((t,s)=>catalog.catalog(t,{action:nextKind==='keyword'?'keywordCampaigns':'campaigns',connectionId:id},s),setCampaigns);}
 function chooseCampaign(id:string){active.current?.abort();setCampaign(id);setGroup('');setTarget('');setGroups([]);setTargets([]);setResult(null);if(id&&catalog)void run((t,s)=>catalog.catalog(t,{action:kind==='keyword'?'keywordGroups':'groups',connectionId:connection,campaignId:id},s),setGroups);}
 function chooseGroup(id:string){active.current?.abort();setGroup(id);setTarget('');setTargets([]);setResult(null);if(id&&catalog)void run((t,s)=>catalog.catalog(t,{action:kind==='keyword'?'keywords':'products',connectionId:connection,campaignId:campaign,groupId:id},s),setTargets);}
 return <StoreCard className="ad-performance" aria-labelledby="ad-performance-panel-title">
  <div className="ad-performance-heading"><div><span className="ad-performance-eyebrow">AD PERFORMANCE</span><h2 id="ad-performance-panel-title">내 광고 성과</h2><p>연결된 광고계정에서 상품 또는 키워드의 성과를 확인하세요.</p></div><span className="ad-performance-heading-mark" aria-hidden="true">↗</span></div>
  {!enabled?<p>광고 성과 조회를 준비하고 있습니다.</p>:checking?<p role="status">로그인 상태를 확인하고 있습니다.</p>:!user?<p><Link href="/store/login/">로그인 후 이용하기</Link></p>:<>
   <div className="ad-performance-fields">
    <fieldset className="ad-performance-section"><legend><span>01</span> 조회 대상</legend><p>어떤 광고의 성과를 살펴볼까요?</p><div className="ad-performance-grid"><div className="ad-performance-field"><label htmlFor="performance-kind">조회 대상</label><AdPerformanceSelect id="performance-kind" value={kind} disabled={busy} options={[{value:'product',label:'쇼핑 상품'},{value:'keyword',label:'검색 키워드'}]} onChange={value=>{const next=value as 'product'|'keyword';setKind(next);chooseConnection('',next);}}/></div></div></fieldset>
    <fieldset className="ad-performance-section"><legend><span>02</span> 광고 선택</legend><p>광고 계정부터 순서대로 선택해 주세요.</p><div className="ad-performance-grid">
     <div className="ad-performance-field"><label htmlFor="performance-connection">광고 계정</label><AdPerformanceSelect id="performance-connection" value={connection} disabled={busy} options={[{value:'',label:'계정을 선택하세요'},...connections.map(x=>({value:x.id,label:`광고 계정 ${x.accountId}`}))]} onChange={chooseConnection}/></div>
     <div className="ad-performance-field"><label htmlFor="performance-campaign">캠페인</label><AdPerformanceSelect id="performance-campaign" value={campaign} disabled={busy||!connection} options={[{value:'',label:'캠페인을 선택하세요'},...campaigns.map(x=>({value:x.id,label:x.name||x.id}))]} onChange={chooseCampaign}/></div>
     <div className="ad-performance-field"><label htmlFor="performance-group">광고그룹</label><AdPerformanceSelect id="performance-group" value={group} disabled={busy||!campaign} options={[{value:'',label:'광고그룹을 선택하세요'},...groups.map(x=>({value:x.id,label:x.name||x.id}))]} onChange={chooseGroup}/></div>
     <div className="ad-performance-field"><label htmlFor="performance-target">상품 또는 키워드</label><AdPerformanceSelect id="performance-target" value={target} disabled={busy||!group} options={[{value:'',label:'대상을 선택하세요'},...targets.map(x=>({value:x.id,label:x.name||x.id}))]} onChange={value=>{setTarget(value);setResult(null);}}/></div>
    </div></fieldset>
    <fieldset className="ad-performance-section"><legend><span>03</span> 조회 기간</legend><p>조회할 시작일과 종료일을 선택하세요.</p><div className="ad-performance-grid">
     <div className="ad-performance-field"><label htmlFor="performance-since">시작일</label><input id="performance-since" type="date" value={since} disabled={busy} onChange={e=>{setSince(e.target.value);setResult(null);}}/></div>
     <div className="ad-performance-field"><label htmlFor="performance-until">종료일</label><input id="performance-until" type="date" value={until} disabled={busy} onChange={e=>{setUntil(e.target.value);setResult(null);}}/></div>
    </div></fieldset>
   </div>
   <div className="ad-performance-actions"><p>선택한 대상 하나의 성과를 조회합니다.</p><StoreButton type="button" disabled={busy||!target||!since||!until||!performance} onClick={()=>{if(!performance)return;setResult(null);void run((token,signal)=>performance.read(token,{connectionId:connection,kind,campaignId:campaign,groupId:group,targetId:target,since,until},signal),setResult);}}>{busy?'조회 중…':'성과 조회'} <span aria-hidden="true">↗</span></StoreButton></div>
   {message&&<p role="status">{message}</p>}{result!==null&&<AdPerformanceResult result={result}/>}
  </>}
 </StoreCard>;
}
