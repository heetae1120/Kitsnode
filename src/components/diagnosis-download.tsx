'use client';
import {useEffect,useState,type ReactNode} from 'react';
import Link from 'next/link';
import {memberBrowserClient} from '@/lib/member-browser-client';
import {downloadDiagnosis,type DiagnosisDocument} from '@/lib/diagnosis-document';
import {saveMemberReturn} from '@/lib/member-return';
import {isDraftPreviewMode} from '@/lib/draft-preview-stage';
import {encodeDiagnoses,decodeDiagnoses} from '@/lib/diagnosis-storage';
export function DiagnosisDownload({report,trailingAction}:{report?:Omit<DiagnosisDocument,'version'|'id'|'createdAt'>;trailingAction?:ReactNode}){
 const [saved,setSaved]=useState<DiagnosisDocument[]>([]),[signedIn,setSignedIn]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 useEffect(()=>{if(isDraftPreviewMode())return;const client=memberBrowserClient();if(!client)return;let active=true,revision=0;const {data:{subscription}}=client.auth.onAuthStateChange((_event,session)=>{if(active){setSignedIn(!!session?.user);setSaved([]);const currentRevision=++revision;void decodeDiagnoses(session?.user.user_metadata?.kitsnode_diagnoses).then(rows=>{if(active&&revision===currentRevision)setSaved(rows);});}});return()=>{active=false;subscription.unsubscribe();};},[]);
 const current=():DiagnosisDocument=>{if(!report)throw Error('진단 결과가 없습니다.');return {...report,version:1,id:crypto.randomUUID(),createdAt:new Date().toISOString()};};
 async function run(task:()=>Promise<void>){if(busy)return;setBusy(true);setMessage('');try{await task();}catch(e){setMessage(e instanceof Error?e.message:'다시 시도해 주세요.');}finally{setBusy(false);}}
 async function update(removeId?:string){if(isDraftPreviewMode())throw Error('편집 미리보기에서는 저장하지 않습니다.');const client=memberBrowserClient();if(!client)throw Error('로그인 후 저장할 수 있어요.');const {data,error}=await client.auth.getUser();if(error||!data.user)throw Error('로그인 상태를 확인해 주세요.');const latest=await decodeDiagnoses(data.user.user_metadata.kitsnode_diagnoses);if(!removeId&&latest.length>=3)throw Error('최대 3개까지 저장할 수 있어요. 기존 진단서를 삭제한 뒤 저장해 주세요.');const next=removeId?latest.filter(r=>r.id!==removeId):[...latest,current()];const result=await client.auth.updateUser({data:{kitsnode_diagnoses:await encodeDiagnoses(next)}});if(result.error)throw Error('저장하지 못했어요. 다시 시도해 주세요.');setSaved(next);setMessage(removeId?'진단서를 삭제했어요.':'내 계정에 진단서를 저장했어요.');}
 const collecting=report?.analysis?.ads?.status==='loading';
 if(!report&&!signedIn)return null;
 return <section className="ds-diagnosis-download" aria-label="진단서 다운로드 및 보관">{report&&<div className="mp-actions"><button className="mp-primary" disabled={busy||collecting} onClick={()=>void run(()=>downloadDiagnosis(current()))}>{collecting?'광고 상품 분석 중…':'진단서 다운로드 받기'}</button>{signedIn?<button className="mp-secondary" disabled={busy||collecting} onClick={()=>void run(()=>update())}>진단서 저장하기</button>:<Link className="mp-secondary" href="/store/login/" onClick={saveMemberReturn} aria-label="로그인하고 진단서 저장하기">진단서 저장하기</Link>}{trailingAction}</div>}{message&&<p role="status">{message}</p>}{signedIn&&<div><h3>내 진단서 · 최대 3개</h3>{saved.length===0&&<p>저장한 진단서가 없습니다.</p>}<ul>{saved.map(r=><li key={r.id}><span>{r.name} · {new Date(r.createdAt).toLocaleDateString('ko-KR')}</span><button disabled={busy} onClick={()=>void run(()=>downloadDiagnosis(r))}>PDF 다운로드</button><button disabled={busy} onClick={()=>void run(()=>update(r.id))}>삭제</button></li>)}</ul></div>}</section>;
}
