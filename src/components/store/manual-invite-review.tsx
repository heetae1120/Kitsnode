'use client';

import {useEffect, useRef, useState, type FormEvent} from 'react';
import {memberBrowserClient} from '@/lib/member-browser-client';
import {StoreButton} from './store-ui';

const enabled = process.env.NEXT_PUBLIC_AD_MANUAL_INVITE_REQUEST_ENABLED === 'true';
const endpoint = 'https://bjpguxwqxlsteektkhwf.supabase.co/functions/v1/kitsnode-ad-api/manual-invite-reviews';
type Request = {request_id:string;user_id:string;created_at:string};
const uuid = (value:unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export function ManualInviteReview({userId}: {userId:string | null}) {
 const [items,setItems]=useState<Request[]>([]),[selected,setSelected]=useState(''),[accountId,setAccountId]=useState(''),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const current=useRef<string|null>(null),active=useRef<AbortController|null>(null),locked=useRef(false);
 useEffect(()=>{current.current=userId;active.current?.abort();active.current=null;locked.current=false;setBusy(false);setItems([]);setSelected('');setAccountId('');setConfirmed(false);setMessage('');return()=>{active.current?.abort();current.current=null;};},[userId]);
 async function call(body:Record<string,unknown>,owner:string,signal:AbortSignal){
  const session=await memberBrowserClient()?.auth.getSession(),token=session?.data.session?.access_token;
  if(!token||session.data.session?.user.id!==owner||current.current!==owner||signal.aborted)throw Error('session_changed');
  const response=await fetch(endpoint,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body),credentials:'omit',redirect:'error',cache:'no-store',referrerPolicy:'no-referrer',signal});
  if(!response.ok)throw Error('unavailable');return response.json();
 }
 async function run(action:'queue'|'attach'){
  const owner=current.current;if(!enabled||!owner||locked.current)return;
  if(action==='attach'&&(!uuid(selected)||!/^[1-9]\d{0,15}$/.test(accountId)||!confirmed))return;
  const abort=new AbortController();active.current?.abort();active.current=abort;locked.current=true;setBusy(true);setMessage('');
  try{
   const result=await call(action==='queue'?{action:'queue'}:{action:'attach',requestId:selected,adAccountId:accountId,confirmed:true},owner,abort.signal);
   if(abort.signal.aborted||current.current!==owner)return;
   if(action==='queue'){
    if(!Array.isArray(result?.requests)||result.requests.length>100||!result.requests.every((r:Request)=>uuid(r?.request_id)&&uuid(r?.user_id)&&typeof r.created_at==='string'&&Number.isFinite(Date.parse(r.created_at))))throw Error('invalid_response');
    setItems(result.requests);setSelected('');setAccountId('');setConfirmed(false);
    if(!result.requests.length)setMessage('확인할 요청이 없습니다.');
   }else{
    if(result?.status!=='matched'||!uuid(result.connectionId))throw Error('invalid_response');
    setItems(previous=>previous.filter(item=>item.request_id!==selected));setSelected('');setAccountId('');setConfirmed(false);
    setMessage('계정 확인 요청을 연결 검토 목록에 등록했습니다. 아래 목록에서 확인 기록을 저장하고 승인해 주세요.');
   }
  }catch{if(!abort.signal.aborted&&current.current===owner)setMessage('결과를 확인하지 못했습니다. 계정 권한과 요청 목록을 다시 확인해 주세요.');}
  finally{if(active.current===abort){active.current=null;locked.current=false;setBusy(false);}}
 }
 function submit(e:FormEvent){e.preventDefault();void run('attach');}
 if(!enabled||!userId)return null;
 return <section aria-labelledby="manual-invite-review-title">
  <h2 id="manual-invite-review-title">광고주 초대 확인 요청</h2>
  <p>광고주가 보낸 요청을 불러와 해당 광고계정과의 관계를 확인한 뒤 검토 목록에 등록합니다.</p>
  <StoreButton type="button" disabled={busy} onClick={()=>void run('queue')}>초대 확인 요청 불러오기</StoreButton>
  <ul>{items.map(item=><li key={item.request_id}>신청 회원 {item.user_id} · 신청 {new Date(item.created_at).toLocaleString('ko-KR')} <button type="button" disabled={busy} onClick={()=>{setSelected(item.request_id);setAccountId('');setConfirmed(false);setMessage('');}}>계정 확인</button></li>)}</ul>
  {selected&&<form onSubmit={submit}><label htmlFor="manual-review-account">확인한 네이버 광고계정 ID</label><input id="manual-review-account" inputMode="numeric" required maxLength={16} pattern="[1-9][0-9]{0,15}" value={accountId} onChange={e=>setAccountId(e.target.value)}/><label><input type="checkbox" required checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> 신청한 광고주와 이 계정의 관계를 별도로 확인했습니다.</label><StoreButton type="submit" disabled={busy||!confirmed}>연결 검토에 등록</StoreButton></form>}
  {message&&<p role="status">{message}</p>}
 </section>;
}
