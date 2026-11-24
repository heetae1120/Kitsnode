'use client';
import {useEffect,useId,useRef,useState} from 'react';
import {memberBrowserClient} from '@/lib/member-browser-client';
import {memberRedirect} from '@/lib/member-auth-config.mjs';

type Profile={username:string;name:string;phone:string;company:string|null};
export function MemberProfileEdit({userId,email,onSaved}:{userId:string;email:string|null;onSaved:(name:string)=>void}) {
 const dialog=useRef<HTMLDialogElement>(null), request=useRef(0), saving=useRef(false);
 const title=useId();
 const [profile,setProfile]=useState<Profile|null>(null),[name,setName]=useState(''),[phone,setPhone]=useState(''),[company,setCompany]=useState('');
 const [loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[newEmail,setNewEmail]=useState('');
 const emailChangeEnabled=process.env.NEXT_PUBLIC_MEMBER_EMAIL_CHANGE_ENABLED==='true';
 useEffect(()=>()=>{request.current++},[]);
 async function open(){
  const current=++request.current;setLoading(true);setProfile(null);setMessage('');dialog.current?.showModal();
  try {const client=memberBrowserClient();if(!client)throw Error();const {data,error}=await client.from('kitsnode_email_profiles').select('username,name,phone,company').eq('user_id',userId).maybeSingle();if(current!==request.current)return;if(error)throw error;if(!data){setMessage('수정 가능한 일반 회원 정보가 없습니다. 가입 방식에 따라 정보 관리 방법이 다를 수 있습니다.');return;}setProfile(data);setName(data.name);setPhone(data.phone);setCompany(data.company || '');} catch {if(current===request.current)setMessage('계정 정보를 불러오지 못했습니다. 다시 시도해 주세요.');} finally {if(current===request.current)setLoading(false);}
 }
 function close(){if(saving.current)return;request.current++;dialog.current?.close();}
 async function changeEmail(){
  if(saving.current || !emailChangeEnabled || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail.trim()) || newEmail.trim().toLowerCase() === email?.toLowerCase())return;
  saving.current=true;setBusy(true);setMessage('');const current=++request.current;
  try{const client=memberBrowserClient();const redirect=memberRedirect(window.location.origin,process.env.NEXT_PUBLIC_BASE_PATH || '');if(!client || !redirect)throw Error();const identity=await client.auth.getUser();if(identity.error || identity.data.user?.id!==userId || !identity.data.user.identities?.some(item=>item.provider==='email'))throw Error();const result=await client.auth.updateUser({email:newEmail.trim()},{emailRedirectTo:redirect});if(result.error)throw result.error;if(current===request.current){setMessage('이메일 변경 요청을 보냈어요. 기존 이메일과 새 이메일의 확인 안내를 확인해 주세요.');setNewEmail('');}}catch{if(current===request.current)setMessage('이메일 변경 요청을 처리하지 못했습니다. 로그인 상태를 확인하고 다시 시도해 주세요.');}finally{saving.current=false;if(current===request.current)setBusy(false);}
 }
 async function save(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();if(saving.current||!profile)return;saving.current=true;setBusy(true);setMessage('');const current=++request.current;
  try {const client=memberBrowserClient();if(!client)throw Error();const {data,error}=await client.rpc('kitsnode_update_member_profile',{p_expected_user:userId,p_name:name.trim(),p_phone:phone.trim(),p_company:company.trim()});if(current!==request.current)return;if(error||data!=='updated')throw Error();onSaved(name.trim());setMessage('계정 정보를 저장했습니다.');}
  catch {if(current===request.current)setMessage('저장하지 못했습니다. 입력 정보와 로그인 상태를 확인해 주세요.');}
  finally {saving.current=false;if(current===request.current)setBusy(false);}
 }
 return <><button type="button" className="member-menu__row" onClick={()=>void open()}><span className="member-menu__icon" aria-hidden="true">✎</span><span className="member-menu__label">계정 정보 수정</span><span aria-hidden="true">›</span></button><dialog ref={dialog} className="member-profile-dialog" aria-labelledby={title} onCancel={event=>{if(saving.current)event.preventDefault();else request.current++}}><div className="member-profile-dialog__heading"><h2 id={title}>계정 정보 수정</h2><button type="button" onClick={close} disabled={busy} aria-label="닫기">×</button></div>{loading&&<p role="status">계정 정보를 불러오고 있어요.</p>}{profile&&<form onSubmit={save}><label>아이디<input value={profile.username} readOnly /></label><label>이름<input value={name} onChange={event=>setName(event.target.value)} required maxLength={100} autoComplete="name" /></label><label>휴대폰 번호<input value={phone} onChange={event=>setPhone(event.target.value)} required pattern="[0-9 -]+" autoComplete="tel" /></label><label>업체명 (선택)<input value={company} onChange={event=>setCompany(event.target.value)} maxLength={100} autoComplete="organization" /></label><label>이메일<input value={email || ''} readOnly /></label><p>{emailChangeEnabled ? '변경 요청 후 이메일 인증을 완료해야 반영됩니다.' : '이메일 변경은 인증 절차를 준비하고 있어요.'}</p><button type="submit" disabled={busy}>{busy?'저장 중…':'변경사항 저장'}</button></form>}{profile && emailChangeEnabled && <div className="member-profile-dialog__email"><label>새 이메일<input type="email" value={newEmail} onChange={event=>setNewEmail(event.target.value)} autoComplete="email" /></label><button type="button" disabled={busy || !newEmail.trim()} onClick={()=>void changeEmail()}>이메일 변경 요청</button></div>}{message&&<p role="status">{message}</p>}</dialog></>;
}
