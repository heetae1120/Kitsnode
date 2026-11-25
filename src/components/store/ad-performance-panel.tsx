'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {memberBrowserClient} from '@/lib/member-browser-client';
import {createShoppingPreviewClient,type ShoppingItem} from '@/lib/shopping-preview-client.mjs';
import {createAdPerformanceClient} from '@/lib/ad-performance-client.mjs';
import {AdPerformanceResult} from './ad-performance-result';
import {AdHourlyResult} from './ad-hourly-result';
import type {HourlyResult} from '@/lib/ad-performance-client.mjs';
import {AdPerformanceSelect} from './ad-performance-select';
import {StoreButton,StoreCard} from './store-ui';
import {AdPerformanceCalendar,type DateMode} from './ad-performance-calendar';

const enabled=process.env.NEXT_PUBLIC_AD_PERFORMANCE_ENABLED==='true';
const catalog=createShoppingPreviewClient({enabled});
const performance=createAdPerformanceClient({enabled});

export function AdPerformancePanel(){
 const [user,setUser]=useState<string|null>(null),[checking,setChecking]=useState(true),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const [kind,setKind]=useState<'product'|'keyword'>('product');
 const [connections,setConnections]=useState<ShoppingItem[]>([]),[campaigns,setCampaigns]=useState<ShoppingItem[]>([]),[groups,setGroups]=useState<ShoppingItem[]>([]),[targets,setTargets]=useState<ShoppingItem[]>([]);
 const [connection,setConnection]=useState(''),[campaign,setCampaign]=useState(''),[group,setGroup]=useState(''),[target,setTarget]=useState(''),[since,setSince]=useState(''),[until,setUntil]=useState('');
 const [result,setResult]=useState<unknown>(null);
 const [mode,setMode]=useState<DateMode>('day');
 const [hourStart,setHourStart]=useState('0'),[hourEnd,setHourEnd]=useState('24');
 const [hourResult,setHourResult]=useState<{data:HourlyResult;start:number;end:number}|null>(null);
 const current=useRef<string|null>(null),active=useRef<AbortController|null>(null),auth=useRef<ReturnType<typeof memberBrowserClient>>(null);
 useEffect(()=>{if(!enabled){setChecking(false);return;}const client=memberBrowserClient();auth.current=client;if(!client){setChecking(false);return;}let mounted=true,version=0;
  const apply=(id:string|null)=>{version++;if(current.current!==id){active.current?.abort();active.current=null;current.current=id;setConnections([]);setCampaigns([]);setGroups([]);setTargets([]);setConnection('');setCampaign('');setGroup('');setTarget('');setResult(null);setHourResult(null);setMessage('');setBusy(false);}setUser(id);setChecking(false);};
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
 function chooseConnection(id:string,nextKind=kind){active.current?.abort();setConnection(id);setCampaign('');setGroup('');setTarget('');setCampaigns([]);setGroups([]);setTargets([]);setResult(null);setHourResult(null);if(id&&catalog)void run((t,s)=>catalog.catalog(t,{action:nextKind==='keyword'?'keywordCampaigns':'campaigns',connectionId:id},s),setCampaigns);}
 function chooseCampaign(id:string){active.current?.abort();setCampaign(id);setGroup('');setTarget('');setGroups([]);setTargets([]);setResult(null);setHourResult(null);if(id&&catalog)void run((t,s)=>catalog.catalog(t,{action:kind==='keyword'?'keywordGroups':'groups',connectionId:connection,campaignId:id},s),setGroups);}
 function chooseGroup(id:string){active.current?.abort();setGroup(id);setTarget('');setTargets([]);setResult(null);setHourResult(null);if(id&&catalog)void run((t,s)=>catalog.catalog(t,{action:kind==='keyword'?'keywords':'products',connectionId:connection,campaignId:campaign,groupId:id},s),setTargets);}
 return <StoreCard className="ad-performance" aria-labelledby="ad-performance-panel-title">
  <div className="ad-performance-heading"><div><h2 id="ad-performance-panel-title">내 광고 성과</h2><p>광고와 날짜를 선택해 성과를 확인하세요.</p></div></div>
  {!enabled?<p>광고 성과 조회를 준비하고 있습니다.</p>:checking?<p role="status">로그인 상태를 확인하고 있습니다.</p>:!user?<p><Link href="/store/login/">로그인 후 이용하기</Link></p>:<>
   <div className="ad-performance-fields">
    <fieldset className="ad-performance-section"><legend>광고 선택</legend><div className="ad-performance-grid"><div className="ad-performance-field"><label htmlFor="performance-kind">조회 대상</label><AdPerformanceSelect id="performance-kind" value={kind} disabled={busy} options={[{value:'product',label:'쇼핑 상품'},{value:'keyword',label:'검색 키워드'}]} onChange={value=>{const next=value as 'product'|'keyword';setKind(next);chooseConnection('',next);}}/></div>
     <div className="ad-performance-field"><label htmlFor="performance-connection">광고 계정</label><AdPerformanceSelect id="performance-connection" value={connection} disabled={busy} options={[{value:'',label:'계정을 선택하세요'},...connections.map(x=>({value:x.id,label:`광고 계정 ${x.accountId}`}))]} onChange={chooseConnection}/></div>
     <div className="ad-performance-field"><label htmlFor="performance-campaign">캠페인</label><AdPerformanceSelect id="performance-campaign" value={campaign} disabled={busy||!connection} options={[{value:'',label:'캠페인을 선택하세요'},...campaigns.map(x=>({value:x.id,label:x.name||x.id}))]} onChange={chooseCampaign}/></div>
     <div className="ad-performance-field"><label htmlFor="performance-group">광고그룹</label><AdPerformanceSelect id="performance-group" value={group} disabled={busy||!campaign} options={[{value:'',label:'광고그룹을 선택하세요'},...groups.map(x=>({value:x.id,label:x.name||x.id}))]} onChange={chooseGroup}/></div>
     <div className="ad-performance-field"><label htmlFor="performance-target">상품 또는 키워드</label><AdPerformanceSelect id="performance-target" value={target} disabled={busy||!group} options={[{value:'',label:'대상을 선택하세요'},...targets.map(x=>({value:x.id,label:x.name||x.id}))]} onChange={value=>{setTarget(value);setResult(null);setHourResult(null);}}/></div>
    </div></fieldset>
    <section className="ad-performance-section ad-date-section" aria-labelledby="ad-date-heading">
     <h3 id="ad-date-heading">조회 날짜</h3>
     <div className="ad-date-modes" role="group" aria-label="조회 방식">{([['day','일별'],['range','기간별'],['hour','시간대별']] as const).map(([value,label])=><button key={value} type="button" aria-pressed={mode===value} disabled={busy} onClick={()=>{setMode(value);setUntil(value==='range'?'':since);setResult(null);setHourResult(null);setMessage('');}}>{label}</button>)}</div>
     <p>{mode==='range'?'달력에서 시작일과 종료일을 차례로 선택하세요.':'달력에서 조회할 날짜를 선택하세요.'}</p>
     <div className="ad-date-layout"><AdPerformanceCalendar mode={mode} since={since} until={until} disabled={busy} onChange={(start,end)=>{setSince(start);setUntil(end);setResult(null);setHourResult(null);setMessage('');}}/>
      <div className="ad-date-options">
       <div className="ad-performance-field"><label htmlFor="performance-since">{mode==='range'?'시작일':'선택 날짜'}</label><input id="performance-since" type="date" value={since} disabled={busy} onChange={e=>{const v=e.target.value;setSince(v);setUntil(mode==='range'?(until&&until<v?'':until):v);setResult(null);setHourResult(null);}}/></div>
       {mode==='range'&&<div className="ad-performance-field"><label htmlFor="performance-until">종료일</label><input id="performance-until" type="date" min={since||undefined} value={until} disabled={busy} onChange={e=>{setUntil(e.target.value);setResult(null);}}/></div>}
       {mode==='hour'&&<><p>하루의 시간대별 성과 · 한국 시간</p><div className="ad-hour-range"><div className="ad-performance-field"><label htmlFor="hourly-start">시작 시간</label><select id="hourly-start" value={hourStart} disabled={busy} onChange={e=>{setHourStart(e.target.value);setHourResult(null);}}>{Array.from({length:24},(_,h)=><option key={h} value={h}>{String(h).padStart(2,'0')}:00</option>)}</select></div><div className="ad-performance-field"><label htmlFor="hourly-end">종료 시간</label><select id="hourly-end" value={hourEnd} disabled={busy} onChange={e=>{setHourEnd(e.target.value);setHourResult(null);}}>{Array.from({length:24},(_,i)=><option key={i+1} value={i+1}>{String(i+1).padStart(2,'0')}:00</option>)}</select></div></div><p className="ad-date-note">시간대별 통계는 조회 가능 기간이 제한됩니다.</p>{Number(hourStart)>=Number(hourEnd)&&<p role="alert">종료 시간은 시작 시간보다 늦어야 합니다.</p>}</>}
       <StoreButton type="button" disabled={busy||!target||!since||!until||since>until||!performance||(mode==='hour'&&Number(hourStart)>=Number(hourEnd))} onClick={()=>{if(!performance)return;setResult(null);setHourResult(null);const request={connectionId:connection,kind,campaignId:campaign,groupId:group,targetId:target,since,until};if(mode==='hour'){const start=Number(hourStart),end=Number(hourEnd);void run((token,signal)=>performance.readHourly(token,request,signal),data=>setHourResult({data,start,end}));}else void run((token,signal)=>performance.read(token,request,signal),setResult);}}>{busy?'조회 중…':mode==='hour'?'시간대별 성과 조회':'성과 조회'}</StoreButton>
      </div>
     </div>
    </section>
   </div>
   {message&&<p role="status">{message}</p>}{result!==null&&<AdPerformanceResult result={result}/>}
   {hourResult&&<AdHourlyResult result={hourResult.data} start={hourResult.start} end={hourResult.end}/>}
  </>}
 </StoreCard>;
}
