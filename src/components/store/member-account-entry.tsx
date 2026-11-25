'use client';
import {useEffect,useState,type ReactNode} from 'react';
import dynamic from 'next/dynamic';
import {isDraftPreviewMode} from '@/lib/draft-preview-stage';
import {isMemberPreview} from '@/lib/member-auth-client';
const MemberAuthPrep=dynamic(()=>import('./member-auth-prep').then(module=>module.MemberAuthPrep));
export function MemberAccountEntry({mode,children}:{mode:'login'|'signup';children:ReactNode}){
 const [preview,setPreview]=useState<boolean|null>(null);
 useEffect(()=>setPreview(isDraftPreviewMode()||isMemberPreview(window.location.search)||new URLSearchParams(window.location.search).has('kits_live_editor')),[]);
 if(preview===null)return null;
 return preview||process.env.NEXT_PUBLIC_MEMBER_AUTH_ENABLED!=='true'?children:<MemberAuthPrep mode={mode}/>;
}
