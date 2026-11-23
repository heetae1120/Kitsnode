'use client';
import {useEffect,useState} from 'react';
import type {Session, SupabaseClient} from '@supabase/supabase-js';
import {memberBrowserClient} from '@/lib/member-browser-client';
import {readMemberAuthConfig} from '@/lib/member-auth-config.mjs';
import {createUsernameClient} from '@/lib/member-username-client.mjs';
import {MemberEmailProfile} from './member-email-profile';
import {StoreCard,StoreHeading} from './store-ui';

// Setup is for the authenticated account only. The server verifies the email
// identity, active session, consent and username uniqueness again on save.
export function MemberUsernameSetup({testClient,testCheckUsername}:{testClient?:SupabaseClient|null;testCheckUsername?:(name:string)=>Promise<{ok:boolean;code:string}>}={}) {
 const [client,setClient]=useState<SupabaseClient|null>(null),[session,setSession]=useState<Session|null>(null);
 const [verifiedId,setVerifiedId]=useState<string|null>(null),[status,setStatus]=useState<'checking'|'signed_out'|'ready'|'invalid'|'error'|'complete'>('checking');
 const [checkUsername,setCheckUsername]=useState<((name:string)=>Promise<{ok:boolean;code:string}>)|null>(null);
 useEffect(()=>{
  const current=testClient===undefined?memberBrowserClient():testClient;
  if(!current){setStatus('error');return}
  setClient(current);let active=true,revision=0;
  const {data:{subscription}}=current.auth.onAuthStateChange((_event,next)=>{revision++;if(active)setSession(next)});
  const before=revision;
  void current.auth.getSession().then(result=>{if(active&&revision===before){if(result.error)setStatus('error');else setSession(result.data.session)}}).catch(()=>{if(active)setStatus('error')});
  return()=>{active=false;subscription.unsubscribe()};
 },[testClient]);
 useEffect(()=>{
  setVerifiedId(null);
  if(!client)return;
  if(!session){setStatus(value=>value==='complete'?'complete':'signed_out');return}
  let active=true;setStatus('checking');
  void client.auth.getUser(session.access_token).then(({data,error})=>{
   if(!active)return;
   if(error||!data.user||data.user.id!==session.user.id){setStatus('error');return}
   if(!data.user.email_confirmed_at||!data.user.identities?.some(identity=>identity.provider==='email')){setStatus('invalid');return}
   setVerifiedId(data.user.id);setStatus('ready');
  }).catch(()=>{if(active)setStatus('error')});
  return()=>{active=false};
 },[client,session]);
 useEffect(()=>{
  if(!client)return;
  if(testCheckUsername){setCheckUsername(()=>testCheckUsername);return()=>setCheckUsername(null)}
  const config=readMemberAuthConfig({enabled:process.env.NEXT_PUBLIC_MEMBER_AUTH_ENABLED,projectRef:process.env.NEXT_PUBLIC_MEMBER_AUTH_PROJECT_REF,url:process.env.NEXT_PUBLIC_MEMBER_AUTH_URL,key:process.env.NEXT_PUBLIC_MEMBER_AUTH_PUBLISHABLE_KEY,signup:process.env.NEXT_PUBLIC_MEMBER_AUTH_SIGNUP_ENABLED,naver:process.env.NEXT_PUBLIC_MEMBER_AUTH_NAVER_ENABLED,link:process.env.NEXT_PUBLIC_MEMBER_AUTH_NAVER_LINK_ENABLED});
  if(!config||process.env.NEXT_PUBLIC_MEMBER_USERNAME_ENABLED!=='true')return;
  const username=createUsernameClient({url:config.url,key:config.key,auth:client.auth});
  setCheckUsername(()=>username.checkUsername);
  return()=>{username.dispose();setCheckUsername(null)};
 },[client,testCheckUsername]);
 const base=process.env.NEXT_PUBLIC_BASE_PATH||'';
 return <main><StoreHeading title="계정 아이디 설정" description="현재 로그인한 계정의 아이디를 설정합니다."/><StoreCard>
  <p>기존 이메일 계정에 사용할 아이디와 회원 정보를 등록합니다. 비밀번호는 변경하지 않습니다.</p>
  {status==='checking'&&<p role="status">계정을 확인하고 있습니다.</p>}
  {status==='signed_out'&&<p>기존 계정으로 <a href={`${base}/store/login/`}>로그인</a>한 뒤 이 화면으로 돌아와 주세요.</p>}
  {status==='invalid'&&<p role="alert">이메일 인증이 완료된 이메일 계정에서 사용할 수 있습니다.</p>}
  {status==='error'&&<p role="alert">계정 상태를 확인하지 못했습니다. 다시 로그인해 주세요.</p>}
  {status==='ready'&&!checkUsername&&<p role="alert">아이디 중복 확인을 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.</p>}
  {status==='ready'&&client&&verifiedId&&checkUsername&&<MemberEmailProfile key={verifiedId} client={client} userId={verifiedId} checkUsername={checkUsername} onComplete={()=>setStatus('complete')}/>}
  {status==='complete'&&<p role="status">아이디 설정이 완료되었습니다.</p>}
 </StoreCard></main>;
}
