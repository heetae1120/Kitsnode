import { isLayoutChanges } from './fast-layout';
import type { LayoutChanges } from './layout-edits';

export const PREVIEW_PROTOCOL = 'kitsnode-draft-preview-v2';
export const PREVIEW_PAGES = ['/tools/', '/tools/start/', '/tools/rankings/', '/tools/seo/', '/tools/traffic/', '/tools/bidding/', '/tools/negative-search/', '/tools/keywords/', '/tools/survey/', '/tools/about/', '/tools/market/', '/tools/consultation/'] as const;
export const PREVIEW_STAGES: Record<string, readonly string[]> = {
  '/tools/': ['1', '2', '3', '4'],
  '/tools/start/': ['intro', 'intake-store', 'intake-ads', 'intake-agency', 'intake-consulting', 'intake-contact', 'intake-ad-example', 'intake-agency-check', 'conditions', 'data', 'report'],
  '/tools/survey/': ['survey-0', 'survey-1', 'survey-2', 'survey-3', 'survey-4', 'survey-5', 'survey-6', 'survey-7'],
  '/tools/keywords/': ['detail', 'compare', 'saved'],
};
export function validPreviewStage(page: string, stage: unknown): stage is string | undefined {
  return stage === undefined || (typeof stage === 'string' && (PREVIEW_STAGES[page] || []).includes(stage));
}
/** Read only non-personal UI state, never input values or local storage. */
export function detectPreviewStage(doc: Document, page: string): string | undefined {
  const markers = Array.from(doc.querySelectorAll('[data-preview-stage]'));
  for (const marker of markers.reverse()) {
    const stage = marker.getAttribute('data-preview-stage');
    if (typeof stage === 'string' && validPreviewStage(page, stage)) return stage;
  }
  return undefined;
}
export type PreviewStatus = 'connecting' | 'ready' | 'blocked' | 'timeout' | 'closed';
export const isPreviewSession = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{32}$/.test(value);
export function previewOrigins(configured = ''): string[] {
  const origins = ['https://kitsnode-studio-owner.junho960809.chatgpt.site'];
  for (const entry of configured.split(',')) {
    try {
      const url = new URL(entry.trim());
      if (url.origin === entry.trim() && (url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))) origins.push(url.origin);
    } catch { /* Invalid origins never become a wildcard. */ }
  }
  return [...new Set(origins)];
}
export function previewUrl(frontendUrl: string, page: string, session: string): URL {
  if (!PREVIEW_PAGES.includes(page as typeof PREVIEW_PAGES[number]) || !isPreviewSession(session)) throw new Error('Invalid preview page or session');
  const url = new URL(frontendUrl);
  if (url.username || url.password || !(url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))) throw new Error('Invalid frontend URL');
  url.pathname = url.pathname.replace(/\/$/, '') + page;
  url.search = '';
  url.hash = '';
  url.searchParams.set('kits_preview', '1');
  url.searchParams.set('kits_preview_session', session);
  return url;
}
export function isPreviewMessage(value: unknown, session: string, type: string): boolean {
  if (!value || typeof value !== 'object') return false;
  const message = value as Record<string, unknown>;
  return message.protocol === PREVIEW_PROTOCOL && message.session === session && message.type === type;
}
export function validPreviewSnapshot(page: unknown, changes: unknown): changes is LayoutChanges {
  if (typeof page !== 'string' || !PREVIEW_PAGES.includes(page as typeof PREVIEW_PAGES[number]) || !isLayoutChanges(changes)) return false;
  if (Object.keys(changes).length !== 1 || !Object.hasOwn(changes, page)) return false;
  const entries = Object.entries(changes[page]);
  return entries.length <= 1000 && entries.every(([selector, patch]) => selector.length <= 2000 && Object.values(patch).every(value => typeof value !== 'string' || value.length <= 4000));
}

/** Call directly from a user click. Only this page's immutable snapshot crosses origins. */
export function startFrontendPreview(options: { page: string; changes: LayoutChanges; stage?: string; onStatus: (status: PreviewStatus) => void; frontendUrl?: string }) {
  const changes: LayoutChanges = JSON.parse(JSON.stringify({ [options.page]: options.changes[options.page] || {} }));
  if (!validPreviewSnapshot(options.page, changes) || !validPreviewStage(options.page, options.stage)) throw new Error('Invalid draft snapshot');
  const session = Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
  const url = previewUrl(options.frontendUrl || process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://heetae1120.github.io/Kitsnode', options.page, session);
  const popup = window.open(url.href, '_blank');
  if (!popup) { options.onStatus('blocked'); return { close() {} }; }
  let ended = false, sent = false;
  const envelope = (type: string) => ({ protocol: PREVIEW_PROTOCOL, session, type });
  const cleanup = () => { window.removeEventListener('message', receive); window.clearTimeout(timeout); window.clearInterval(closed); };
  const finish = (status: PreviewStatus) => { if (ended) return; ended = true; cleanup(); options.onStatus(status); };
  const receive = (event: MessageEvent) => {
    if (ended || event.origin !== url.origin || event.source !== popup) return;
    if (!sent && isPreviewMessage(event.data, session, 'ready')) {
      sent = true;
      popup.postMessage({ ...envelope('snapshot'), page: options.page, changes, ...(options.stage === undefined ? {} : { stage: options.stage }) }, url.origin);
    } else if (sent && isPreviewMessage(event.data, session, 'applied')) {
      window.clearTimeout(timeout);
      options.onStatus('ready');
    }
  };
  window.addEventListener('message', receive);
  const timeout = window.setTimeout(() => { popup.postMessage(envelope('cancel'), url.origin); finish('timeout'); }, 12000);
  const closed = window.setInterval(() => { if (popup.closed) finish('closed'); }, 500);
  options.onStatus('connecting');
  return { close() { popup.close(); if (!ended) { finish('closed'); } } };
}
