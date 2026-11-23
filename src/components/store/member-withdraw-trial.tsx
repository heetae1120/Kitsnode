'use client';
import {useEffect,useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {memberBrowserClient} from '@/lib/member-browser-client';
import {trialWithdrawalAvailable,requestTrialWithdrawal} from '@/lib/member-withdraw-trial.mjs';
import {MemberSelfWithdraw} from './member-self-withdraw';
import {StoreCard,StoreHeading} from './store-ui';

// Temporary, separate route: removing this component and its page removes the
// test interface without changing normal member account behavior.
export function MemberWithdrawTrial({testClient}:{testClient?:SupabaseClient|null}={}){
 const [client,setClient]=useState<SupabaseClient|null>(null);
 const [user,setUser]=useState<string|null>(null);
 const [status,setStatus]=useState<'checking'|'signed_out'|'unavailable'|'ready'|'complete'>('checking');
 useEffect(()=>{
  const current=testClient===undefined?memberBrowserClient():testClient;
  if(!current){setStatus('unavailable');return}
  setClient(current);let active=true,revision=0;
  const {data:{subscription}}=current.auth.onAuthStateChange((_event,session)=>{revision++;if(active)setUser(session?.user?.id||null)});
  const before=revision;
  void current.auth.getSession().then(result=>{if(active&&revision===before){if(result.error)setStatus('unavailable');else{setUser(result.data.session?.user?.id||null);if(!result.data.session)setStatus('signed_out')}}}).catch(()=>{if(active)setStatus('unavailable')});
  return()=>{active=false;subscription.unsubscribe()};
 },[testClient]);
 useEffect(()=>{
  if(!client)return;
  if(!user){setStatus(value=>value==='complete'?'complete':'signed_out');return}
  let active=true;setStatus('checking');
  void trialWithdrawalAvailable(client,user).then(ok=>{if(active)setStatus(ok?'ready':'unavailable')});
  return()=>{active=false};
 },[client,user]);
 const base=process.env.NEXT_PUBLIC_BASE_PATH||'';
 return <main><StoreHeading title="회원탈퇴 연결 시험" description="시험 계정으로 회원탈퇴 과정을 확인합니다."/><StoreCard>
  <p>이 화면은 지정된 테스트 계정만 사용할 수 있습니다. 확인 후 진행하면 해당 시험 계정과 관련 정보가 실제로 삭제됩니다.</p>
  {status==='checking'&&<p role="status">시험 계정을 확인하고 있습니다.</p>}
  {status==='signed_out'&&<p>시험 계정으로 <a href={`${base}/store/login/`}>로그인</a>한 뒤 이 화면으로 돌아와 주세요.</p>}
  {status==='unavailable'&&<p role="alert">이 계정으로는 시험을 진행할 수 없거나 서버를 확인하지 못했습니다.</p>}
  {status==='ready'&&client&&user&&<MemberSelfWithdraw key={user} withdraw={()=>requestTrialWithdrawal(client,user,()=>setStatus('complete'))}/>}
  {status==='complete'&&<p role="status">시험 계정의 회원탈퇴가 완료되었습니다.</p>}
 </StoreCard></main>;
}
