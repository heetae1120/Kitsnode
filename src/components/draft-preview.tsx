"use client";
import { useLayoutEffect, useState } from 'react';
import { applyPageLayout, type LayoutChanges } from '@/lib/layout-edits';
import { PREVIEW_PROTOCOL, PREVIEW_PAGES, isPreviewMessage, isPreviewSession, previewOrigins, validPreviewSnapshot, validPreviewStage, detectPreviewStage } from '@/lib/layout-preview';

import { setDraftPreviewStage } from '@/lib/draft-preview-stage';

/** Read-only actual frontend. Drafts never enter published storage or network loaders. */
export function DraftPreview() {
  const [status, setStatus] = useState('');
  useLayoutEffect(() => {
    const query = new URLSearchParams(window.location.search);
    if (!query.has('kits_preview')) return;
    const session = query.get('kits_preview_session');
    const opener = window.opener;
    const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
    const page = window.location.pathname.slice(base.length);
    const origins = previewOrigins(process.env.NEXT_PUBLIC_PREVIEW_ADMIN_ORIGINS);
    let active = true, pending = false, applied = false, snapshot: LayoutChanges | null = null;
    let requestedStage: string | undefined, verifiedOrigin: string | undefined;
    // Capture before React's delegated events. Scrolling and browser close remain available.
    const block = (event: Event) => { event.preventDefault(); event.stopImmediatePropagation(); };
    const blockedEvents = ['click', 'auxclick', 'dblclick', 'submit', 'keydown', 'beforeinput', 'drop', 'pointerdown'];
    blockedEvents.forEach(type => window.addEventListener(type, block, true));
    // Also reject programmatic writes (not just form/button events) for this preview lifetime.
    const originalFetch = window.fetch;
    const guardedFetch: typeof window.fetch = (input, init) => {
      const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
      if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) return Promise.reject(new Error('Draft preview is read-only'));
      return originalFetch.call(window, input, init);
    };
    window.fetch = guardedFetch;
    const originalBeacon = navigator.sendBeacon;
    const blockedBeacon: typeof navigator.sendBeacon = () => false;
    navigator.sendBeacon = blockedBeacon;
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;
    const methods = new WeakMap<XMLHttpRequest, string>();
    const guardedOpen = function(this: XMLHttpRequest, method: string, url: string | URL, async = true, username?: string | null, password?: string | null) {
      methods.set(this, method.toUpperCase());
      originalOpen.call(this, method, url, async, username, password);
    };
    const guardedSend = function(this: XMLHttpRequest, body?: Document | XMLHttpRequestBodyInit | null) {
      if (!['GET', 'HEAD', 'OPTIONS'].includes(methods.get(this) || 'GET')) throw new Error('Draft preview is read-only');
      originalSend.call(this, body);
    };
    XMLHttpRequest.prototype.open = guardedOpen;
    XMLHttpRequest.prototype.send = guardedSend;
    setStatus('초안 연결 중 · 읽기 전용');
    const apply = () => {
      pending = false;
      if (!active || !snapshot || (requestedStage !== undefined && detectPreviewStage(document, page) !== requestedStage)) return;
      applyPageLayout(document, snapshot, page);
      if (!applied && verifiedOrigin) {
        applied = true;
        window.clearTimeout(timeout);
        setStatus('저장 전 초안 · 실제 프론트 · 예시 데이터(실제 고객·운영 데이터 아님) · 읽기 전용');
        opener.postMessage({ protocol: PREVIEW_PROTOCOL, session, type: 'applied' }, verifiedOrigin);
      }
    };
    const observer = new MutationObserver(() => {
      if (!pending && active && snapshot) { pending = true; queueMicrotask(apply); }
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['data-preview-stage'] });
    const receive = (event: MessageEvent) => {
      if (!active || !isPreviewSession(session) || event.source !== opener || !origins.includes(event.origin)) return;
      if (isPreviewMessage(event.data, session, 'cancel')) { active = false; observer.disconnect(); setStatus('미리보기가 종료되었습니다. 창을 닫아 주세요.'); return; }
      if (snapshot || !isPreviewMessage(event.data, session, 'snapshot') || event.data.page !== page || !validPreviewSnapshot(page, event.data.changes) || !validPreviewStage(page, event.data.stage)) return;
      snapshot = event.data.changes;
      requestedStage = event.data.stage;
      verifiedOrigin = event.origin;
      setDraftPreviewStage(page, requestedStage);
      apply();
    };
    window.addEventListener('message', receive);
    const timeout = window.setTimeout(() => { if (!applied) { active = false; setStatus('초안을 연결하지 못했습니다. 어드민에서 다시 열거나 프론트 연결 설정을 확인해 주세요.'); } }, 12000);
    if (opener && isPreviewSession(session) && PREVIEW_PAGES.includes(page as typeof PREVIEW_PAGES[number])) {
      // Readiness is emitted only from an effect, after hydration. Never broadcast to '*'.
      origins.forEach(origin => opener.postMessage({ protocol: PREVIEW_PROTOCOL, session, type: 'ready' }, origin));
    } else { active = false; setStatus('유효하지 않은 미리보기입니다. 어드민에서 다시 열어 주세요.'); }
    return () => {
      active = false;
      setDraftPreviewStage(page);
      observer.disconnect();
      window.clearTimeout(timeout);
      window.removeEventListener('message', receive);
      blockedEvents.forEach(type => window.removeEventListener(type, block, true));
      if (window.fetch === guardedFetch) window.fetch = originalFetch;
      if (navigator.sendBeacon === blockedBeacon) navigator.sendBeacon = originalBeacon;
      if (XMLHttpRequest.prototype.open === guardedOpen) XMLHttpRequest.prototype.open = originalOpen;
      if (XMLHttpRequest.prototype.send === guardedSend) XMLHttpRequest.prototype.send = originalSend;
    };
  }, []);
  if (!status) return null;
  return <aside role="status" data-draft-preview-banner style={{ position: 'fixed', bottom: 12, left: 12, right: 12, zIndex: 2147483647, padding: '12px 16px', background: '#172554', color: '#fff', borderRadius: 8, pointerEvents: 'none', fontSize: 14 }}>{status}</aside>;
}
