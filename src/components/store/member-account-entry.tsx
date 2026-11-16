'use client';

import { useEffect, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { isDraftPreviewMode, useDraftPreviewStage } from '@/lib/draft-preview-stage';
import { MemberPreview, type MemberPreviewStage } from './member-preview';

const MemberAuthPrep = dynamic(() => import('./member-auth-prep').then(module => module.MemberAuthPrep));

/** Never mount the auth client until this URL is known not to be a draft preview. */
export function MemberAccountEntry({ mode, children }: { mode: 'login' | 'signup'; children: ReactNode }) {
  const [preview, setPreview] = useState<boolean | null>(null);
  const stage = useDraftPreviewStage(mode === 'login' ? '/store/login/' : '/store/signup/');
  useEffect(() => { setPreview(isDraftPreviewMode()); }, []);
  if (preview === null) return null;
  if (preview) {
    // When auth is disabled, the visitor sees the supplied preparation card.
    // Reuse it for the default stage so frontend changes appear in the editor.
    // Other stages remain explicitly synthetic and never mount the auth client.
    if (process.env.NEXT_PUBLIC_MEMBER_AUTH_ENABLED !== 'true' && (!stage || stage === 'default')) {
      return <div data-preview-stage="default" style={{ display: 'contents' }}>{children}</div>;
    }
    return <MemberPreview mode={mode} stage={(stage || 'default') as MemberPreviewStage} />;
  }
  return process.env.NEXT_PUBLIC_MEMBER_AUTH_ENABLED === 'true' ? <MemberAuthPrep mode={mode} /> : children;
}
