'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import Link from 'next/link';
import {memberBrowserClient} from '@/lib/member-browser-client';
import {createShoppingPreviewClient,type ShoppingItem,type ShoppingResult,type ShoppingComparison} from '@/lib/shopping-preview-client.mjs';
import {StoreBadge,StoreButton,StoreCard,StoreHeading} from './store-ui';
const client=createShoppingPreviewClient({enabled:process.env.NEXT_PUBLIC_SHOPPING_PREVIEW_ENABLED==='true'});
const reasons:Record<string,string>={campaign_inactive:'캠페인이 중지되어 있습니다.',adgroup_inactive:'광고그룹이 중지되어 있습니다.',parent_inactive:'캠페인 또는 광고그룹이 중지되어 있습니다.',naver_autobid_active:'네이버 자동입찰이 설정돼 있습니다.',naver_autobid_unverified:'네이버 자동입찰 상태를 확인하지 못했습니다.',product_scope_unverified:'영향받는 상품 전체 범위는 확인되지 않았습니다.',group_bid:'상품이 광고그룹 기본 입찰가를 사용합니다.',product_inactive:'상품 소재가 중지되어 있습니다.',current_outside_bounds:'현재 입찰가가 설정한 범위 밖에 있습니다.',invalid_input:'금액을 확인해 주세요.',unavailable:'데이터를 확인할 수 없습니다.'};
const textFor=(value:string)=>reasons[value]||'필요한 조건을 확인하지 못했습니다.';
const format=(v:number|null|undefined)=>typeof v==='number'?`${v.toLocaleString('ko-KR')}원`:'확인 불가';
const statusLabel=(v:string|undefined)=>v==='PAUSED'?'중지':v==='ELIGIBLE'?'정상':'상태 확인 필요';

export function ShoppingBidPanel(){
 const [user,setUser]=useState<string|null>(null),[checking,setChecking]=useState(true),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const [connections,setConnections]=useState<ShoppingItem[]>([]),[campaigns,setCampaigns]=useState<ShoppingItem[]>([]),[groups,setGroups]=useState<ShoppingItem[]>([]),[products,setProducts]=useState<ShoppingItem[]>([]);
 const [connection,setConnection]=useState(''),[campaign,setCampaign]=useState(''),[group,setGroup]=useState(''),[product,setProduct]=useState('');
 const [reference,setReference]=useState(''),[minBid,setMinBid]=useState('50'),[maxBid,setMaxBid]=useState('100000'),[maxChange,setMaxChange]=useState('100'),[result,setResult]=useState<ShoppingResult|null>(null);
 const [comparison,setComparison]=useState<ShoppingComparison|null>(null);
 const current=useRef<string|null>(null),active=useRef<AbortController|null>(null),auth=useRef<ReturnType<typeof memberBrowserClient>>(null);
 useEffect(()=>{const c=memberBrowserClient();auth.current=c;if(!c){setChecking(false);return;}let mounted=true,version=0;
  const apply=(id:string|null)=>{version++;if(current.current!==id){active.current?.abort();active.current=null;current.current=id;setConnections([]);setCampaigns([]);setGroups([]);setProducts([]);setConnection('');setCampaign('');setGroup('');setProduct('');setResult(null);setComparison(null);setReference('');setMessage('');setBusy(false);}setUser(id);setChecking(false);};
  const {data:{subscription}}=c.auth.onAuthStateChange((_event,s)=>{if(mounted)apply(s?.user?.id??null);});const initial=version;
  void c.auth.getSession().then(({data})=>{if(mounted&&version===initial)apply(data.session?.user?.id??null);}).catch(()=>{if(mounted&&version===initial)setChecking(false);});
  return ()=>{mounted=false;subscription.unsubscribe();active.current?.abort();active.current=null;current.current=null;auth.current=null;};
 },[]);
 async function run<T>(work:(token:string,signal:AbortSignal)=>Promise<T>,apply:(value:T)=>void){
  const owner=current.current;if(!owner||!client)return;const controller=new AbortController();active.current?.abort();active.current=controller;setBusy(true);setMessage('');
  try{const s=await auth.current?.auth.getSession();const token=s?.data.session?.access_token;if(!token||s?.data.session?.user.id!==owner||current.current!==owner||controller.signal.aborted)throw Error('session_changed');const value=await work(token,controller.signal);if(!controller.signal.aborted&&current.current===owner)apply(value);}
  catch{if(!controller.signal.aborted&&current.current===owner)setMessage('조회하지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.');}
  finally{if(active.current===controller){active.current=null;setBusy(false);}}
 }
 useEffect(()=>{if(!user||!client)return;void run((token,signal)=>client.catalog(token,{action:'connections'},signal),setConnections);return ()=>{active.current?.abort();};},[user]);
 function chooseConnection(id:string){setConnection(id);setCampaign('');setGroup('');setProduct('');setCampaigns([]);setGroups([]);setProducts([]);setResult(null);setComparison(null);if(id&&client)void run((t,s)=>client.catalog(t,{action:'campaigns',connectionId:id},s),setCampaigns);}
 function chooseCampaign(id:string){setCampaign(id);setGroup('');setProduct('');setGroups([]);setProducts([]);setResult(null);setComparison(null);if(id&&client)void run((t,s)=>client.catalog(t,{action:'groups',connectionId:connection,campaignId:id},s),setGroups);}
 function chooseGroup(id:string){setGroup(id);setProduct('');setProducts([]);setResult(null);setComparison(null);if(id&&client)void run((t,s)=>client.catalog(t,{action:'products',connectionId:connection,campaignId:campaign,groupId:id},s),setProducts);}
 function compareMaster(){if(!client||!group||busy)return;setComparison(null);void run((t,s)=>client.compare(t,{connectionId:connection,campaignId:campaign,adgroupId:group},s),setComparison);}
 function submit(event:FormEvent){event.preventDefault();const selected=products.find(x=>x.id===product);if(!client||!selected||selected.useGroupBid==null)return;
  const values=[reference,minBid,maxBid,maxChange];if(values.some(v=>!/^\d+$/.test(v)||!Number.isSafeInteger(Number(v)))){setMessage('기준값과 제한 금액을 숫자로 입력해 주세요.');return;}
  const body={connectionId:connection,campaignId:campaign,adgroupId:group,scope:selected.useGroupBid?'adgroup':'product',...(!selected.useGroupBid?{adId:product}:{}),referenceBid:Number(reference),minBid:Number(minBid),maxBid:Number(maxBid),maxChange:Number(maxChange)};
  setResult(null);void run((t,s)=>client.preview(t,body,s),setResult);
 }
 const selected=products.find(x=>x.id===product);
 return <><StoreHeading title="쇼핑검색 모의 입찰" description="광고그룹과 상품을 선택해 가정한 금액을 확인합니다."/><StoreCard>
  <StoreBadge tone="warning">자동 실행 중단</StoreBadge><h2>상품 입찰 시나리오</h2><p>사용자가 입력한 기준값으로 계산하는 예시입니다. 네이버 추정 입찰가나 순위 보장이 아니며 광고 설정을 변경하지 않습니다.</p>
  {!client?<p role="status">모의 입찰 기능을 준비하고 있습니다.</p>:checking?<p role="status">로그인 상태를 확인하고 있습니다.</p>:!user?<p><Link className="store-text-link" href="/store/login/">로그인 후 이용하기</Link></p>:<>
   <label htmlFor="shopping-connection">연결 계정</label><select id="shopping-connection" value={connection} disabled={busy} onChange={e=>chooseConnection(e.target.value)}><option value="">계정을 선택하세요</option>{connections.map(x=><option key={x.id} value={x.id}>광고 계정 {x.accountId}</option>)}</select>
   <label htmlFor="shopping-campaign">쇼핑검색 캠페인</label><select id="shopping-campaign" value={campaign} disabled={busy||!connection} onChange={e=>chooseCampaign(e.target.value)}><option value="">캠페인을 선택하세요</option>{campaigns.map(x=><option key={x.id} value={x.id}>{x.name||x.id} · {statusLabel(x.status)}</option>)}</select>
   <label htmlFor="shopping-group">광고그룹</label><select id="shopping-group" value={group} disabled={busy||!campaign} onChange={e=>chooseGroup(e.target.value)}><option value="">광고그룹을 선택하세요</option>{groups.map(x=><option key={x.id} value={x.id}>{x.name||x.id} · {statusLabel(x.status)} · 기본 {format(x.bid)}</option>)}</select>
   <label htmlFor="shopping-product">상품 소재</label><select id="shopping-product" value={product} disabled={busy||!group} onChange={e=>{setProduct(e.target.value);setResult(null);}}><option value="">상품을 선택하세요</option>{products.map(x=><option key={x.id} value={x.id}>{x.name||x.id} · {statusLabel(x.status)}</option>)}</select>
   {group&&!busy&&products.length===0&&<p>조회된 상품 소재가 없습니다.</p>}
   {selected&&<p>{selected.useGroupBid===true?'이 상품은 광고그룹 기본 입찰가를 사용합니다. 그룹 기본 입찰가를 가정해 계산합니다.':selected.useGroupBid===false?`상품별 입찰가: ${format(selected.bid)}`:'이 상품의 입찰가 적용 방식을 확인할 수 없습니다.'}</p>}
   <section aria-label="마스터 보고서 대조"><h3>마스터 보고서 대조</h3><p>네이버 보고서를 생성해 선택한 그룹의 소재와 실시간 목록을 비교합니다. 계정당 2분에 한 번 요청할 수 있습니다.</p><StoreButton type="button" disabled={busy||!group} onClick={compareMaster}>보고서와 소재 대조</StoreButton>{comparison&&<div role="status">{comparison.status==='unavailable'?<p>{comparison.reason==='report_cooldown'?'최근 보고서를 요청했습니다. 2분 후 다시 시도해 주세요.':'대조를 완료하지 못했습니다. 보고서가 이미 생성됐을 수 있으니 2분 후 다시 시도해 주세요.'}</p>:<><p>{comparison.status==='observed_consistent'?'조회된 소재 ID와 입찰 방식이 일치합니다.':'조회된 소재 또는 입찰 방식에 차이가 있습니다.'}</p><p>마스터 {comparison.masterCount}건 · 실시간 {comparison.liveCount}건</p><p>실시간에만 {comparison.onlyLive?.length}건 · 보고서에만 {comparison.onlyMaster?.length}건 · 입찰 방식 차이 {comparison.differentBidMode?.length}건</p><p>보고서 기준 {new Date(comparison.reportAt!).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})} · 실시간 조회 {new Date(comparison.liveAt!).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})}</p><p>대조 결과가 일치해도 전체 목록이나 동일 시점임이 보장되지는 않습니다. 자동 입찰과 실제 변경은 중단되어 있습니다.</p></>}</div>}</section>
   <form onSubmit={submit}><label htmlFor="shopping-reference">가정할 기준 입찰가</label><input id="shopping-reference" inputMode="numeric" required value={reference} onChange={e=>setReference(e.target.value)}/><label htmlFor="shopping-min">최소 입찰가</label><input id="shopping-min" inputMode="numeric" required value={minBid} onChange={e=>setMinBid(e.target.value)}/><label htmlFor="shopping-max">최대 입찰가</label><input id="shopping-max" inputMode="numeric" required value={maxBid} onChange={e=>setMaxBid(e.target.value)}/><label htmlFor="shopping-change">한 번에 바꿀 최대 금액</label><input id="shopping-change" inputMode="numeric" required value={maxChange} onChange={e=>setMaxChange(e.target.value)}/><StoreButton type="submit" disabled={busy||!selected||selected.useGroupBid==null}>모의 금액 계산</StoreButton></form>
  </>}
  {busy&&<p role="status">광고 정보를 확인하고 있습니다.</p>}{message&&<p role="alert">{message}</p>}
  {result&&<div role="status"><h3>계산 결과</h3>{result.status==='illustrative'||result.status==='proposed'||result.status==='unchanged'?<><p>현재 {format(result.currentBid)} → 모의 {format(result.proposedBid)}</p><p>실제 입찰가 변경과 자동 실행은 중단되어 있습니다.</p>{result.status==='illustrative'&&<p>이 값은 그룹 기본 입찰가의 가정이며, 해당 그룹의 다른 상품에도 영향을 줄 수 있습니다.</p>}{result.blockers?.map(x=><p key={x}>{textFor(x)}</p>)}{result.observedProducts&&<section aria-label="조회된 상품별 입찰가 적용 방식"><h4>조회된 상품별 입찰가 적용 방식</h4><p>그룹 기본 입찰가 상속 {result.observedProducts.filter(x=>x.useGroupBid===true).length}건 · 상품별 입찰가 {result.observedProducts.filter(x=>x.useGroupBid===false).length}건 · 방식 미확인 {result.observedProducts.filter(x=>x.useGroupBid===null).length}건</p><p>네이버에서 반환한 소재 기준이며, 전체 목록 여부는 아직 확인되지 않았습니다. 조회 이후 설정은 변경될 수 있습니다.</p><ul>{result.observedProducts.map(x=><li key={x.id}>{x.name||'상품명 확인 불가'} · 소재 ID {x.id} · {statusLabel(x.status)} · {x.useGroupBid===true?'그룹 입찰가 상속':x.useGroupBid===false?'상품별 입찰가':'입찰 방식 미확인'}</li>)}</ul></section>}</>:<p>{textFor(result.reason||'unavailable')}</p>}</div>}
 </StoreCard><Link className="store-text-link" href="/store/ads/">광고 성과 분석으로 돌아가기</Link></>;
}
