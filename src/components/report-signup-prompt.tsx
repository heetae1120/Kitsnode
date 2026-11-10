"use client";
import {useEffect,useRef} from 'react';
import {UserPlus,X} from 'lucide-react';
export function ReportSignupPrompt({onContinue,onClose}:{onContinue:()=>void;onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const element=dialog.current;element?.showModal();return()=>element?.close();},[]);
 return <dialog ref={dialog} className="mp-signup-dialog" aria-labelledby="report-signup-title" aria-describedby="report-signup-description" onClose={onClose}>
  <button type="button" className="mp-signup-close" aria-label="회원가입 안내 닫기" onClick={onClose}><X size={20}/></button><span className="mp-signup-icon"><UserPlus size={28}/></span><h2 id="report-signup-title">회원가입하고 진단을 이어가세요</h2><p id="report-signup-description">회원가입 기능을 준비하고 있어요.<br/>지금은 가입 없이 다음 결과를 확인할 수 있어요.</p><button autoFocus type="button" className="mp-primary" onClick={onContinue}>다음</button><button type="button" className="mp-signup-later" onClick={onClose}>이전 결과 보기</button>
 </dialog>;
}
