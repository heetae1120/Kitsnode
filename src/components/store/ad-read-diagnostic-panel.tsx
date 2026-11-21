'use client';
import {useEffect,useRef,useState} from 'react';
import {memberBrowserClient} from '@/lib/member-browser-client';
import {StoreButton,StoreCard,StoreHeading} from './store-ui';
const endpoint='https://bjpguxwqxlsteektkhwf.supabase.co/functions/v1/kitsnode-ad-read-diagnostic';
export function AdReadDiagnosticPanel(){
 const [user,setUser]=useState<string|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const current=useRef<string|null>(null),pending=useRef<AbortController|null>(null);
 useEffect(()=>{const client=memberBrowserClient();if(!client){setMessage('로그인 설정을 확인해 주세요.');return;}let active=true,version=0;
  const apply=(id:string|null)=>{version++;if(current.current!==id){pending.current?.abort();pending.current=null;current.current=id;setBusy(false);setMessage('');}setUser(id);};
  const {data:{subscription}}=client.auth.onAuthStateChange((_event,session)=>{if(active)apply(session?.user?.id??null);});const initial=version;
  void client.auth.getSession().then(({data})=>{if(active&&initial===version)apply(data.session?.user?.id??null);}).catch(()=>{if(active)setMessage('로그인 상태를 확인하지 못했습니다.');});
  return ()=>{active=false;subscription.unsubscribe();pending.current?.abort();current.current=null;};
 },[]);
 async function check(){if(!current.current||pending.current)return;const owner=current.current,abort=new AbortController();pending.current=abort;setBusy(true);setMessage('');
  try{const client=memberBrowserClient(),result=await client?.auth.getSession(),session=result?.data.session;if(!session?.access_token||session.user.id!==owner||current.current!==owner)throw Error();
   const response=await fetch(endpoint,{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`},credentials:'omit',redirect:'error',cache:'no-store',referrerPolicy:'no-referrer',signal:abort.signal});
   if(response.status===403)throw Error('forbidden');if(response.status===429)throw Error('rate_limited');if(!response.ok)throw Error('unavailable');
   const data=await response.json();if(abort.signal.aborted||current.current!==owner)return;
   setMessage(data?.status==='accessible'&&['OWNER','MASTER','READ_ONLY'].includes(data.role)?'미모 광고계정에 네이버 API 접근이 확인되었습니다. 회원 연결은 별도입니다.':`네이버 API 접근을 확인하지 못했습니다 (${typeof data?.reason==='string'?data.reason:'unavailable'}).`);
  }catch(error){if(!abort.signal.aborted&&current.current===owner)setMessage(error instanceof Error&&error.message==='forbidden'?'운영자 권한을 확인하지 못했습니다.':error instanceof Error&&error.message==='rate_limited'?'요청이 많습니다. 잠시 후 다시 확인해 주세요.':'진단을 완료하지 못했습니다. 로그인과 진단 상태를 확인해 주세요.');}
  finally{if(pending.current===abort){pending.current=null;setBusy(false);}}
 }
 return <><StoreHeading title="광고계정 조회 진단" description="운영자용 읽기 전용 확인"/><StoreCard><p>미모 광고계정의 네이버 API 접근 여부만 확인합니다. 회원 연결이나 광고 성과 조회는 별도 단계입니다.</p>{!user?<p>운영자 계정으로 먼저 로그인해 주세요.</p>:<StoreButton disabled={busy} onClick={()=>void check()}>미모 계정 조회 확인</StoreButton>}{message&&<p role="status">{message}</p>}</StoreCard></>;
}
