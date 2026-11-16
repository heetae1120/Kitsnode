'use client';

import { useLayoutEffect, useState } from 'react';
import { createEditorLayoutApplier } from '@/lib/editor-layout-applier';
import { getEditableTextNode, isAuthLayoutPage, type LayoutChanges, type LayoutPatch } from '@/lib/layout-edits';
import { detectPreviewStage, isPreviewSession, previewOrigins, PREVIEW_PAGES, validPreviewSnapshot, validPreviewStage } from '@/lib/layout-preview';
import { setDraftPreviewStage } from '@/lib/draft-preview-stage';
import { applyAuthoritativeSnapshot, beginInlineText, type InlineTextSession } from '@/lib/live-inline-text-editor';
import { LIVE_EDITOR_PROTOCOL, resolveSingleLiveEditorElement, trustedLiveEditorMessage } from '@/lib/live-editor-protocol';

const notices = '[role="alert"], [role="status"], .pr-notice, .kr-notice, .kw-notice, .bid-rank-notice, .mp-story-alert, .mp-ad-notice, .intake-data-notice, .hc-notice';
type Scope = 'page' | 'common';
const isAuthTarget = (el: Element) => {
  const name = el.getAttribute('data-auth-edit');
  return !!name && ['heading', 'description', 'email-input', 'password-input', 'submit-button', 'naver-button'].includes(name) && el.ownerDocument.querySelectorAll(`[data-auth-edit="${name}"]`).length === 1;
};
const rootFor = (el: Element) => el.closest('.tool-topbar, .mp-live-bar');
function canSelect(el: Element, page: string, scope: Scope) {
  if (el.closest('[data-live-editor-banner], [data-kits-inline]')) return false;
  if (isAuthLayoutPage(page)) return isAuthTarget(el);
  const root = rootFor(el);
  return scope === 'common' ? !!root : !root && !el.querySelector('.tool-topbar, .mp-live-bar');
}
export function selectorFor(el: Element, page: string, scope: Scope): string {
  if (page === '/tools/start/' && el.getAttribute('data-layout-target') === 'start-diagnosis-link') return 'body [data-layout-target="start-diagnosis-link"]';
  const auth = el.getAttribute('data-auth-edit');
  if (auth && isAuthTarget(el)) return `body [data-auth-edit="${auth}"]`;
  let current = el;
  let root: Element | null = scope === 'common' ? rootFor(el) : null;
  let prefix = root ? `body ${root.classList.contains('tool-topbar') ? '.tool-topbar' : '.mp-live-bar'}` : 'body';
  if (!root) {
    // The market intake reuses DOM paths for several branches. The marker is
    // also present on the visitor page and follows the actual answers/report.
    const market = page === '/tools/market/' ? el.closest('.business-intake[data-preview-stage]') : null;
    if (market) {
      const stage = market.getAttribute('data-preview-stage');
      if (!stage || !validPreviewStage(page, stage)) return '';
      prefix += `:has(.business-intake[data-preview-stage=${JSON.stringify(stage)}])`;
    }
    for (const marker of ['#mp-available', '#mp-feePercent', '#report-next', '.mp-preparation']) if (el.ownerDocument.querySelector(marker)) { prefix += `:has(${marker})`; break; }
    const survey = el.ownerDocument.querySelector('.sv-step');
    if (survey) {
      const group = survey.querySelector('.sv-options[aria-label]'), textarea = survey.querySelector('textarea[placeholder]');
      if (group) prefix += `:has(.sv-options[aria-label=${JSON.stringify(group.getAttribute('aria-label'))}])`;
      else if (textarea) prefix += `:has(.sv-step textarea[placeholder=${JSON.stringify(textarea.getAttribute('placeholder'))}])`;
      else if (survey.querySelector('.sv-contact')) prefix += ':has(.sv-contact)';
    }
    root = el.ownerDocument.body;
  }
  const parts: string[] = [];
  while (current && current !== root) {
    const parent: Element | null = current.parentElement;
    if (!parent) return '';
    const peers = Array.from(parent.children).filter(child => child.tagName === current.tagName);
    parts.unshift(`${current.tagName.toLowerCase()}:nth-of-type(${peers.indexOf(current) + 1})`);
    current = parent;
  }
  return current === root ? prefix + (parts.length ? ` > ${parts.join(' > ')}` : '') : '';
}
function canText(el: HTMLElement) {
  const auth = el.getAttribute('data-auth-edit');
  return !(auth && auth !== 'heading' && auth !== 'description') && !el.closest('.mp-live-values b, .mp-live-bar > p') && getEditableTextNode(el) !== null;
}
function kindFor(el: Element): 'select' | 'notice' | null {
  return el.tagName.toLowerCase() === 'select' ? 'select' : el.matches(notices) ? 'notice' : null;
}

/** A fail-closed editing surface for the deployed frontend; no credentials or customer data cross the bridge. */
export function LiveEditorBridge() {
  const [status, setStatus] = useState('');
  useLayoutEffect(() => {
    const query = new URLSearchParams(window.location.search);
    if (query.get('kits_live_editor') !== '1') return;
    const session = query.get('session');
    const parent = window.parent;
    const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
    const page = window.location.pathname.slice(base.length) || '/';
    const origins = previewOrigins(process.env.NEXT_PUBLIC_PREVIEW_ADMIN_ORIGINS);
    let active = true, ready = false, applied = false, pending = false;
    let verifiedOrigin = '', scope: Scope = 'page', requestedStage: string | undefined;
    let snapshot: LayoutChanges | null = null, inline: InlineTextSession | null = null;
    let selected: HTMLElement | null = null, selectedSelector = '', suppressClick = false;
    let dragging: { el: HTMLElement; selector: string; x: number; y: number; left: number; top: number; moved: boolean; original: { position: string; left: string; top: string } } | null = null;
    const post = (type: string, extra: Record<string, unknown> = {}) => { if (verifiedOrigin && active) parent.postMessage({ protocol: LIVE_EDITOR_PROTOCOL, session, type, ...extra }, verifiedOrigin); };

    // Blocking begins before a handshake. A forged URL can only disable actions, never enable them.
    const oldFetch = window.fetch, guardedFetch: typeof window.fetch = () => Promise.reject(new Error('Live editor is read-only'));
    window.fetch = guardedFetch;
    const oldBeacon = navigator.sendBeacon, blockedBeacon: typeof navigator.sendBeacon = () => false;
    navigator.sendBeacon = blockedBeacon;
    const oldOpen = XMLHttpRequest.prototype.open, oldSend = XMLHttpRequest.prototype.send;
    const guardedOpen: typeof XMLHttpRequest.prototype.open = function(this: XMLHttpRequest, ...args: Parameters<typeof XMLHttpRequest.prototype.open>) { oldOpen.apply(this, args); } as typeof XMLHttpRequest.prototype.open;
    const guardedSend: typeof XMLHttpRequest.prototype.send = function() { throw new Error('Live editor is read-only'); };
    XMLHttpRequest.prototype.open = guardedOpen; XMLHttpRequest.prototype.send = guardedSend;
    const applier = createEditorLayoutApplier(document, page);
    const style = document.createElement('style');
    style.textContent = '[data-kits-selected]{outline:3px solid #779e61!important;outline-offset:3px!important}[data-kits-hover]:not([data-kits-selected]){outline:2px dashed #8ebd79!important;outline-offset:2px!important}html::before{content:"";position:fixed;inset:0;z-index:2147483647;pointer-events:none;background:linear-gradient(to right,transparent calc(var(--guide-x,-100px) - 1px),#ca6db0 calc(var(--guide-x,-100px) - 1px),#ca6db0 calc(var(--guide-x,-100px) + 1px),transparent calc(var(--guide-x,-100px) + 1px)),linear-gradient(to bottom,transparent calc(var(--guide-y,-100px) - 1px),#ca6db0 calc(var(--guide-y,-100px) - 1px),#ca6db0 calc(var(--guide-y,-100px) + 1px),transparent calc(var(--guide-y,-100px) + 1px))}';
    document.head.appendChild(style);
    const label = (el: Element) => `${el.tagName.toLowerCase()}${typeof (el as HTMLElement).className === 'string' && (el as HTMLElement).className ? ` · ${(el as HTMLElement).className.split(' ').slice(0, 2).join(' ')}` : ''}`.slice(0, 120);
    const discover = () => {
      if (!ready) return;
      const targets = Array.from(document.querySelectorAll<HTMLElement>(`select, ${notices}`)).flatMap(el => {
        const kind = kindFor(el);
        if (!kind || !canSelect(el, page, scope) || el.closest('[hidden], [aria-hidden="true"]') || !el.getClientRects().length) return [];
        const selector = selectorFor(el, page, scope);
        return selector && selector.length <= 2000 ? [{ selector, label: label(el), kind }] : [];
      }).slice(0, 200);
      post('targets', { targets });
    };
    const select = (el: HTMLElement, openInspector = false) => {
      if (!ready || !canSelect(el, page, scope)) return false;
      const selector = selectorFor(el, page, scope);
      if (!selector || selector.length > 2000) return false;
      if (resolveSingleLiveEditorElement(document, selector) !== el) { setStatus('선택한 요소를 정확히 하나로 확인하지 못했습니다.'); post('error', { code: 'ambiguous_selector' }); return false; }
      applier.remember(el);
      document.querySelectorAll('[data-kits-selected]').forEach(item => item.removeAttribute('data-kits-selected'));
      selected = el; selectedSelector = selector; el.setAttribute('data-kits-selected', '');
      post('selected', { selector, label: label(el), canText: canText(el), kind: kindFor(el), openInspector });
      if (openInspector) discover();
      return true;
    };
    const apply = () => {
      pending = false;
      if (!active || !ready || !snapshot || inline || (requestedStage !== undefined && detectPreviewStage(document, page) !== requestedStage)) return;
      applier.apply(snapshot);
      if (!applied) { applied = true; setStatus('실제 프론트 연결됨 · 편집 전용'); post('applied', { page }); discover(); }
    };
    const observer = new MutationObserver(() => { if (!pending && active && ready) { pending = true; queueMicrotask(apply); } });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['data-preview-stage'] });
    const unique = (selector: unknown) => {
      const el = resolveSingleLiveEditorElement(document, selector);
      return el && canSelect(el, page, scope) ? el : null;
    };
    const startText = (el: HTMLElement) => {
      if (!ready || !canSelect(el, page, scope) || !canText(el)) return;
      inline?.finish(); if (!select(el)) return; const selector = selectedSelector;
      inline = beginInlineText(el, text => { const patch: LayoutPatch = { ...(snapshot?.[page]?.[selector] || {}), text }; post('commit', { selector, patch }); }, cancelled => { inline = null; post('inline-state', { active: false, cancelled }); }, text => post('inline-draft', { selector, text }));
      if (inline) post('inline-state', { active: true });
    };
    const receive = (event: MessageEvent) => {
      const m = event.data;
      if (!active || !trustedLiveEditorMessage(event, parent, window, session, origins)) return;
      if (!ready) {
        if (m.type !== 'init' || m.page !== page || !['page', 'common'].includes(m.scope) || !validPreviewSnapshot(page, m.changes) || !validPreviewStage(page, m.stage)) return;
        verifiedOrigin = event.origin; ready = true; scope = m.scope; snapshot = m.changes; requestedStage = m.stage;
        setDraftPreviewStage(page, requestedStage); apply(); return;
      }
      if (event.origin !== verifiedOrigin) return;
      // A parent snapshot (including undo/redo) is authoritative: abandon any
      // uncommitted inline input before replacing it, without emitting a commit.
      if (m.type === 'apply' && m.page === page && validPreviewSnapshot(page, m.changes)) { applyAuthoritativeSnapshot(inline, () => { snapshot = m.changes; applier.apply(snapshot!); discover(); }); }
      else if (m.type === 'preview' && snapshot && unique(m.selector) && validPreviewSnapshot(page, { [page]: { [m.selector]: m.patch } })) { applier.apply({ [page]: { ...snapshot[page], [m.selector]: m.patch } }); }
      else if (m.type === 'cancel-preview' && snapshot) applier.apply(snapshot);
      else if (m.type === 'select') { const el = unique(m.selector); if (el) select(el); }
      else if (m.type === 'flush' && typeof m.requestId === 'string' && /^[a-zA-Z0-9-]{1,64}$/.test(m.requestId)) {
        // Commit precedes the acknowledgement on the same postMessage channel.
        // The parent retains this frame until it receives that acknowledgement.
        inline?.finish();
        post('flushed', { requestId: m.requestId });
      }
      else if (m.type === 'select-parent' && selected) {
        // Never leave the permitted page/common/auth scope while walking up.
        for (let ancestor = selected.parentElement; ancestor && ancestor !== document.body && ancestor !== document.documentElement; ancestor = ancestor.parentElement) {
          if (ancestor instanceof HTMLElement && canSelect(ancestor, page, scope) && select(ancestor, true)) break;
        }
      }
      else if (m.type === 'edit-text') { const el = unique(m.selector); if (el) startText(el); }
      else if (m.type === 'clear-selection') { selected?.removeAttribute('data-kits-selected'); selected = null; selectedSelector = ''; }
    };
    const onClick = (event: MouseEvent) => { const el = event.target; if (el instanceof HTMLElement && el.closest('[data-kits-inline]')) { event.stopImmediatePropagation(); return; } event.preventDefault(); event.stopImmediatePropagation(); if (suppressClick) { suppressClick = false; return; } if (ready && el instanceof HTMLElement && el !== document.body && el !== document.documentElement) select(el); };
    const onDoubleClick = (event: MouseEvent) => { event.preventDefault(); event.stopImmediatePropagation(); if (ready && event.target instanceof HTMLElement) startText(event.target); };
    const onContext = (event: MouseEvent) => { event.preventDefault(); event.stopImmediatePropagation(); if (ready && event.target instanceof HTMLElement) select(event.target, true); };
    const onKey = (event: KeyboardEvent) => {
      if (inline && event.target instanceof Element && event.target.closest('[data-kits-inline]')) return;
      event.preventDefault(); event.stopImmediatePropagation(); if (!ready) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') post(event.shiftKey ? 'redo' : 'undo');
      else if (event.key === 'F2' && selected) startText(selected);
      else if (event.altKey && event.key === 'Enter' && selected) select(selected, true);
    };
    const onDown = (event: PointerEvent) => {
      if (inline && event.target instanceof Element && event.target.closest('[data-kits-inline]')) return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (!ready || !selected || !selectedSelector || event.button !== 0 || isAuthLayoutPage(page) || !(event.target instanceof HTMLElement) || !selected.contains(event.target)) return;
      const patch = snapshot?.[page]?.[selectedSelector] || {};
      dragging = { el: selected, selector: selectedSelector, x: event.clientX, y: event.clientY, left: parseFloat(patch.left || '0') || 0, top: parseFloat(patch.top || '0') || 0, moved: false, original: { position: selected.style.position, left: selected.style.left, top: selected.style.top } };
    };
    const onMove = (event: PointerEvent) => {
      if (!dragging) return;
      const dx = event.clientX - dragging.x, dy = event.clientY - dragging.y;
      if (!dragging.moved && Math.hypot(dx, dy) < 5) return;
      dragging.moved = true; event.preventDefault(); event.stopImmediatePropagation();
      let left = dragging.left + dx, top = dragging.top + dy;
      const rect = dragging.el.getBoundingClientRect();
      const xEdges = [rect.left, rect.left + rect.width / 2, rect.right], yEdges = [rect.top, rect.top + rect.height / 2, rect.bottom];
      const shiftX = left - (parseFloat(dragging.el.style.left) || 0), shiftY = top - (parseFloat(dragging.el.style.top) || 0);
      let xMatch: { delta: number; line: number } | null = null, yMatch: { delta: number; line: number } | null = null;
      for (const sibling of Array.from(dragging.el.parentElement?.children || [])) {
        if (sibling === dragging.el) continue;
        const box = sibling.getBoundingClientRect(); if (!box.width || !box.height) continue;
        for (const edge of xEdges) for (const target of [box.left, box.left + box.width / 2, box.right]) { const delta = target - (edge + shiftX); if (Math.abs(delta) <= 5 && (!xMatch || Math.abs(delta) < Math.abs(xMatch.delta))) xMatch = { delta, line: target }; }
        for (const edge of yEdges) for (const target of [box.top, box.top + box.height / 2, box.bottom]) { const delta = target - (edge + shiftY); if (Math.abs(delta) <= 5 && (!yMatch || Math.abs(delta) < Math.abs(yMatch.delta))) yMatch = { delta, line: target }; }
      }
      if (xMatch) left += xMatch.delta; if (yMatch) top += yMatch.delta;
      document.documentElement.style.setProperty('--guide-x', xMatch ? `${xMatch.line}px` : '-100px');
      document.documentElement.style.setProperty('--guide-y', yMatch ? `${yMatch.line}px` : '-100px');
      dragging.el.style.position = 'relative'; dragging.el.style.left = `${Math.round(left)}px`; dragging.el.style.top = `${Math.round(top)}px`;
    };
    const onUp = (event: PointerEvent) => {
      if (!dragging) return;
      const drag = dragging; dragging = null;
      document.documentElement.style.removeProperty('--guide-x'); document.documentElement.style.removeProperty('--guide-y');
      if (!drag.moved) return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (event.type === 'pointercancel') { drag.el.style.position = drag.original.position; drag.el.style.left = drag.original.left; drag.el.style.top = drag.original.top; return; }
      suppressClick = true;
      post('commit', { selector: drag.selector, patch: { ...(snapshot?.[page]?.[drag.selector] || {}), left: drag.el.style.left, top: drag.el.style.top } });
    };
    const block = (event: Event) => { if (inline && event.target instanceof Element && event.target.closest('[data-kits-inline]')) return; event.preventDefault(); event.stopImmediatePropagation(); };
    window.addEventListener('message', receive);
    window.addEventListener('click', onClick, true); window.addEventListener('dblclick', onDoubleClick, true); window.addEventListener('contextmenu', onContext, true);
    window.addEventListener('keydown', onKey, true); window.addEventListener('pointerdown', onDown, true); window.addEventListener('pointermove', onMove, true); window.addEventListener('pointerup', onUp, true); window.addEventListener('pointercancel', onUp, true);
    for (const name of ['submit', 'beforeinput', 'drop', 'auxclick']) window.addEventListener(name, block, true);
    setStatus('에디터 연결 중 · 읽기 전용');
    if (parent !== window && isPreviewSession(session) && PREVIEW_PAGES.includes(page as typeof PREVIEW_PAGES[number])) {
      origins.forEach(origin => parent.postMessage({ protocol: LIVE_EDITOR_PROTOCOL, session, type: 'ready', page }, origin));
    } else setStatus('유효하지 않은 에디터 연결입니다.');
    const timeout = window.setTimeout(() => { if (!applied) setStatus('에디터에 연결하지 못했습니다.'); }, 12000);
    return () => {
      active = false; window.clearTimeout(timeout); observer.disconnect(); inline?.finish(true); applier.dispose(); setDraftPreviewStage(page); style.remove();
      window.removeEventListener('message', receive); window.removeEventListener('click', onClick, true); window.removeEventListener('dblclick', onDoubleClick, true); window.removeEventListener('contextmenu', onContext, true); window.removeEventListener('keydown', onKey, true); window.removeEventListener('pointerdown', onDown, true); window.removeEventListener('pointermove', onMove, true); window.removeEventListener('pointerup', onUp, true); window.removeEventListener('pointercancel', onUp, true);
      for (const name of ['submit', 'beforeinput', 'drop', 'auxclick']) window.removeEventListener(name, block, true);
      if (window.fetch === guardedFetch) window.fetch = oldFetch;
      if (navigator.sendBeacon === blockedBeacon) navigator.sendBeacon = oldBeacon;
      if (XMLHttpRequest.prototype.open === guardedOpen) XMLHttpRequest.prototype.open = oldOpen;
      if (XMLHttpRequest.prototype.send === guardedSend) XMLHttpRequest.prototype.send = oldSend;
    };
  }, []);
  return status ? <aside role="status" data-live-editor-banner style={{position:'fixed',bottom:12,left:12,right:12,zIndex:2147483647,padding:'12px 16px',background:'#172554',color:'#fff',borderRadius:8,pointerEvents:'none',fontSize:14}}>{status}</aside> : null;
}
