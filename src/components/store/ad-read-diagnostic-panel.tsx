'use client';
import {useEffect,useRef,useState} from 'react';
import {memberBrowserClient} from '@/lib/member-browser-client';
import {StoreButton,StoreCard,StoreHeading} from './store-ui';
const endpoint='https://bjpguxwqxlsteektkhwf.supabase.co/functions/v1/kitsnode-ad-performance-diagnostic';
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
   const valid=(v:unknown)=>v===null||(typeof v==='number'&&Number.isFinite(v)&&v>=0);const m=data?.metrics;
   setMessage(data?.status==='observed'&&m&&[m.impressions,m.clicks,m.cost,m.clickThroughRate,m.averageClickCost].every(valid)?`유니킴 검색광고 캠페인 1개 최근 7일 성과: 노출 ${m.impressions??'없음'}, 클릭 ${m.clicks??'없음'}, 광고비 ${m.cost??'없음'}원 (${data.period?.since}~${data.period?.until}).`:data?.status==='no_data'?'선택한 캠페인의 조회 기간 통계가 없습니다.':`성과를 확인하지 못했습니다 (${typeof data?.stage==='string'?data.stage:'unavailable'} / ${typeof data?.reason==='string'?data.reason:'unavailable'}).`);
  }catch(error){if(!abort.signal.aborted&&current.current===owner)setMessage(error instanceof Error&&error.message==='forbidden'?'운영자 권한을 확인하지 못했습니다.':error instanceof Error&&error.message==='rate_limited'?'요청이 많습니다. 잠시 후 다시 확인해 주세요.':'진단을 완료하지 못했습니다. 로그인과 진단 상태를 확인해 주세요.');}
  finally{if(pending.current===abort){pending.current=null;setBusy(false);}}
 }
 return <><StoreHeading title="광고계정 조회 진단" description="운영자용 읽기 전용 확인"/><StoreCard><p>유니킴 검색광고 캠페인 하나의 최근 7일 성과를 서버에서 조회합니다. 일반 회원 화면 연결과는 별도 시험입니다.</p>{!user?<p>운영자 계정으로 먼저 로그인해 주세요.</p>:<StoreButton disabled={busy} onClick={()=>void check()}>유니킴 성과 조회 확인</StoreButton>}{message&&<p role="status">{message}</p>}</StoreCard></>;
}
