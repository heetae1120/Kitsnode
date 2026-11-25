'use client';

import {useEffect, useRef, useState} from 'react';
import {memberBrowserClient} from '@/lib/member-browser-client';
import {StoreButton} from './store-ui';

const enabled = process.env.NEXT_PUBLIC_AD_MANUAL_INVITE_REQUEST_ENABLED === 'true';
const endpoint = 'https://bjpguxwqxlsteektkhwf.supabase.co/functions/v1/kitsnode-ad-api/manual-invite-requests';
type Status = 'none' | 'pending_review' | 'matched';
const validStatus = (value: unknown): value is Status => value === 'none' || value === 'pending_review' || value === 'matched';

// The server derives the member from the session. An acknowledgement is a
// request for review, never evidence that Naver access or ownership exists.
export function ManualInviteRequest({userId, refreshKey = 0, onRefresh, onStatusChange}: {userId: string | null; refreshKey?: number; onRefresh?: () => void; onStatusChange?: (status: Status | null) => void}) {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const current = useRef<string | null>(null);
  const active = useRef<AbortController | null>(null);
  const locked = useRef(false);
  const statusCallback = useRef(onStatusChange); statusCallback.current = onStatusChange;

  useEffect(() => {
    current.current = userId;
    setStatus(null); statusCallback.current?.(null); setMessage(''); setBusy(false); locked.current = false;
    active.current?.abort();
    if (!enabled || !userId) return;
    const abort = new AbortController(); active.current = abort;
    void (async () => {
      try {
        const session = await memberBrowserClient()?.auth.getSession();
        const token = session?.data.session?.access_token;
        if (!token || session.data.session?.user.id !== userId || current.current !== userId || abort.signal.aborted) throw Error('session_changed');
        const response = await fetch(endpoint, {method:'GET', headers:{Authorization:`Bearer ${token}`}, credentials:'omit', redirect:'error', cache:'no-store', referrerPolicy:'no-referrer', signal:abort.signal});
        if (!response.ok) throw Error('unavailable');
        const result: unknown = await response.json();
        const next = (result && typeof result === 'object' && 'status' in result) ? result.status : undefined;
        if (!validStatus(next)) throw Error('unavailable');
        if (!abort.signal.aborted && current.current === userId) {setStatus(next); statusCallback.current?.(next);}
      } catch {if (!abort.signal.aborted && current.current === userId) setMessage('요청 상태를 확인하지 못했습니다. 페이지를 새로고침해 주세요.');}
    })();
    return () => {abort.abort(); if (active.current === abort) active.current = null;};
  }, [userId, refreshKey]);

  async function request() {
    const owner = current.current;
    if (!enabled || !owner || locked.current || status !== 'none') return;
    const abort = new AbortController(); active.current?.abort(); active.current = abort;
    locked.current = true; setBusy(true); setMessage('');
    try {
      const session = await memberBrowserClient()?.auth.getSession();
      const token = session?.data.session?.access_token;
      if (!token || session.data.session?.user.id !== owner || current.current !== owner || abort.signal.aborted) throw Error('session_changed');
      const response = await fetch(endpoint, {method:'POST', headers:{Authorization:`Bearer ${token}`, 'Content-Type':'application/json'}, body:'{}', credentials:'omit', redirect:'error', cache:'no-store', referrerPolicy:'no-referrer', signal:abort.signal});
      if (!response.ok) throw Error('unavailable');
      const result: unknown = await response.json();
      const next = (result && typeof result === 'object' && 'status' in result) ? result.status : undefined;
      if (next !== 'pending_review' && next !== 'matched') throw Error('unavailable');
      if (abort.signal.aborted || current.current !== owner) return;
      setStatus(next); statusCallback.current?.(next); onRefresh?.();
    } catch {if (!abort.signal.aborted && current.current === owner) setMessage('요청 결과를 확인하지 못했습니다. 새로고침해 상태를 확인해 주세요.');}
    finally {if (active.current === abort) {active.current = null; locked.current = false; setBusy(false);}}
  }

  if (!enabled) return null;
  return <div className="ad-manual-invite-request">
    <p>네이버에서 초대를 보냈거나 이미 키츠노드에 권한을 부여했다면 연결 확인을 요청해 주세요. 키츠노드가 계정과 권한을 확인한 후 연결합니다.</p>
    {!userId ? <p>키츠노드 로그인 후 요청할 수 있습니다.</p> : status === 'none' ? <StoreButton type="button" disabled={busy} onClick={() => void request()}>{busy ? '요청 중…' : '광고계정 연결 확인 요청'}</StoreButton> : status === 'pending_review' ? <p role="status">연결 확인을 요청했습니다. 광고계정과 권한을 확인하고 있습니다.</p> : status === 'matched' ? <p role="status">요청이 연결 검토 목록에 등록되었습니다. 위 연결 상태에서 진행 결과를 확인해 주세요.</p> : !message ? <p role="status">요청 상태를 확인하고 있습니다.</p> : null}
    {message && <p role="alert">{message}</p>}
  </div>;
}
