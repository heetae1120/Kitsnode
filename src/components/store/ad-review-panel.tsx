'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {memberBrowserClient} from '@/lib/member-browser-client';
import {StoreButton,StoreCard,StoreHeading} from './store-ui';

type Item={request_id:string;user_id:string;ad_account_id:string;status:string};
type Evidence={evidence_id:string;method:string;case_ref:string;recorded_at:string;expires_at:string;revoked_at:string|null};
const endpoint='https://bjpguxwqxlsteektkhwf.supabase.co/functions/v1/kitsnode-ad-api/reviews';
const enabled=process.env.NEXT_PUBLIC_AD_REVIEW_ENABLED==='true';

export function AdReviewPanel(){
 const [user,setUser]=useState<string|null>(null),[items,setItems]=useState<Item[]>([]),[selected,setSelected]=useState('');
 const [proof,setProof]=useState<Evidence[]>([]),[method,setMethod]=useState('advertiser_confirmation'),[caseRef,setCaseRef]=useState(''),[confirmed,setConfirmed]=useState(false),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const current=useRef<string|null>(null),controller=useRef<AbortController|null>(null),operation=useRef<{owner:string}|null>(null);
 useEffect(()=>{const client=memberBrowserClient();if(!client)return;let active=true,version=0;
  const apply=(id:string|null)=>{version++;if(current.current!==id){controller.current?.abort();controller.current=null;operation.current=null;setBusy(false);setItems([]);setProof([]);setSelected('');setMessage('');setCaseRef('');setConfirmed(false);current.current=id;}setUser(id);};
  const {data:{subscription}}=client.auth.onAuthStateChange((_e,s)=>{if(active)apply(s?.user?.id??null);});const initial=version;
  void client.auth.getSession().then(({data})=>{if(active&&initial===version)apply(data.session?.user?.id??null);}).catch(()=>{if(active&&initial===version){apply(null);setMessage('로그인 상태를 확인하지 못했습니다. 다시 시도해 주세요.');}});
  return ()=>{active=false;subscription.unsubscribe();controller.current?.abort();operation.current=null;current.current=null;};
 },[]);
 async function call(payload:Record<string,unknown>){
  const owner=operation.current?.owner,client=memberBrowserClient(),abort=new AbortController();controller.current?.abort();controller.current=abort;
  const session=await client?.auth.getSession();const token=session?.data.session?.access_token;
  if(!enabled||!owner||!token||session?.data.session?.user.id!==owner||current.current!==owner||abort.signal.aborted)throw Error('unavailable');
  const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(payload),credentials:'omit',redirect:'error',cache:'no-store',referrerPolicy:'no-referrer',signal:abort.signal});
  if(!response.ok)throw Error('unavailable');const data=await response.json();if(abort.signal.aborted||current.current!==owner)throw Error('unavailable');return data;
 }
 async function run(action:()=>Promise<void>){if(operation.current||!current.current)return;const op={owner:current.current};operation.current=op;setBusy(true);setMessage('');try{await action();}catch{if(operation.current===op)setMessage('요청을 처리하지 못했습니다. 권한과 연결 상태를 확인해 주세요.');}finally{if(operation.current===op){operation.current=null;setBusy(false);}}}
 async function queue(){const r=await call({action:'queue'});if(!Array.isArray(r.requests))throw Error();setItems(r.requests);}
 async function evidence(id:string){const r=await call({action:'evidence',requestId:id});if(!Array.isArray(r.evidence))throw Error();setProof(r.evidence);}
 function choose(id:string){setSelected(id);setProof([]);void run(()=>evidence(id));}
 const pending=items.find(item=>item.request_id===selected)?.status==='pending_review';
 function record(e:FormEvent){e.preventDefault();void run(async()=>{await call({action:'record',requestId:selected,method,caseRef:caseRef.trim(),confirmed});setCaseRef('');setConfirmed(false);await evidence(selected);setMessage('확인 기록을 저장했습니다.');});}
 function change(action:'revoke'|'approve',id:string){void run(async()=>{const owner=current.current;await call({action,requestId:selected,evidenceId:id});const done=action==='revoke'?'확인 기록을 철회했습니다. 이 기록으로 승인된 연결은 해제됩니다.':'연결을 승인했습니다.';try{await evidence(selected);await queue();if(current.current===owner)setMessage(done);}catch{if(owner && current.current===owner)setMessage(`${done} 목록을 다시 불러와 상태를 확인해 주세요.`);}});}
 return <><StoreHeading title="광고 계정 연결 검토" description="권한이 부여된 운영자만 사용할 수 있습니다."/><StoreCard>
 <p>광고주와 신청자의 관계를 별도의 신뢰할 수 있는 절차로 확인한 뒤 기록해 주세요. 네이버 API 접근 성공만으로 관계가 확인되지는 않습니다.</p><p>확인 문서와 개인정보는 입력하지 말고 내부 확인 건 번호만 입력하세요. 기록은 30일 동안 승인에 사용할 수 있습니다. 자동 입찰은 중단되어 있습니다.</p>
 {!enabled?<p role="status">운영자 검토 기능 준비 중입니다.</p>:!user?<p>운영자 계정으로 로그인해 주세요.</p>:<><StoreButton disabled={busy} onClick={()=>void run(queue)}>연결 요청 불러오기</StoreButton><ul>{items.map(i=><li key={i.request_id}>광고 계정 {i.ad_account_id} · 신청 회원 {i.user_id} · {i.status==='pending_review'?'연결 확인 대기':i.status==='read_connected'?'광고 정보 조회 가능':'상태 확인 필요'} <button type="button" disabled={busy} onClick={()=>choose(i.request_id)}>검토</button></li>)}</ul>
 {selected&&<><h2>확인 기록</h2>{!pending&&<p>연결 확인 대기 상태인 요청만 승인할 수 있습니다.</p>}{pending&&<form onSubmit={record}><label htmlFor="review-method">확인 방법</label><select id="review-method" value={method} onChange={e=>setMethod(e.target.value)}><option value="advertiser_confirmation">광고주에게 별도 확인</option><option value="contract_review">계약 관계 확인</option></select><label htmlFor="review-case">내부 확인 건 번호</label><input id="review-case" required minLength={3} maxLength={128} pattern="[A-Za-z0-9][A-Za-z0-9._:-]{2,127}" value={caseRef} onChange={e=>setCaseRef(e.target.value)}/><label><input type="checkbox" required checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> 신청 회원과 해당 광고주의 관계 및 위임을 별도로 확인했습니다.</label><StoreButton type="submit" disabled={busy}>확인 기록 저장</StoreButton></form>}
 <ul>{proof.map(p=><li key={p.evidence_id}>{p.method==='contract_review'?'계약 관계':'광고주 별도 확인'} · {p.case_ref} · 만료 {new Date(p.expires_at).toLocaleDateString('ko-KR')} · {p.revoked_at?'철회됨':!Number.isFinite(Date.parse(p.expires_at))||Date.parse(p.expires_at)<=Date.now()?'만료됨':'유효 여부 확인'} {!p.revoked_at&&<>{pending&&Number.isFinite(Date.parse(p.expires_at))&&Date.parse(p.expires_at)>Date.now()&&<><button type="button" disabled={busy} onClick={()=>change('approve',p.evidence_id)}>연결 승인</button>{' '}</>}<button type="button" disabled={busy} onClick={()=>change('revoke',p.evidence_id)}>기록 철회</button></>}</li>)}</ul></>}</>}
 {message&&<p role="status">{message}</p>}</StoreCard></>;
}
