import { UNKNOWN_ATTRIBUTION, type Attribution } from './analytics-attribution';
/** Memory-only pseudonymous metadata snapshots. Form values are never accepted here. */
export const ANALYTICS_STEPS = ['brandVision', 'audience', 'category', 'stage', 'budget', 'support', 'brandGoal', 'contact'] as const;
export const ANALYTICS_FIELDS = ['brandVision', 'audience', 'categoryOther', 'brandGoal', 'store', 'company', 'nameRole', 'phone'] as const;
type Step = typeof ANALYTICS_STEPS[number];
type Field = typeof ANALYTICS_FIELDS[number];
export type Reason = 'heartbeat' | 'hidden' | 'pagehide' | 'navigation' | 'complete';
export type SurveyTiming = { elapsedMs: number; visibleMs: number; engagedMs: number };
export type Snapshot = { version: 3; viewId: string; sequence: number; page: string; visibleMs: number; engagedMs: number; reason: Reason; attribution: Attribution; survey: null | { step: Step; lastField: Field | null; lastInputAgoMs: number | null; completed: boolean; timing: SurveyTiming | null } };
const PAGES = new Set(['', 'start', 'rankings', 'seo', 'traffic', 'bidding', 'negative-search', 'keywords', 'survey', 'about', 'market', 'consultation'].map(p => `/tools/${p ? p + '/' : ''}`));
const ms = (v: number) => Math.min(86_400_000, Math.max(0, Math.floor(v)));
export function canonicalAnalyticsPage(pathname: string, basePath = ''): string | null {
  let path = pathname;
  if (basePath && path.startsWith(basePath + '/')) path = path.slice(basePath.length);
  if (!path.endsWith('/')) path += '/';
  return PAGES.has(path) ? path : null;
}
export function analyticsAllowed(c: { enabled?: string; endpoint?: string; hostname: string; search: string; framed: boolean; hasOpener: boolean; dnt?: string | null; gpc?: boolean }): boolean {
  if (c.enabled !== 'true' || c.framed || c.hasOpener || c.dnt === '1' || c.dnt === 'yes' || c.gpc) return false;
  if (/^(localhost|127\.|0\.0\.0\.0|\[?::1\]?)/i.test(c.hostname) || c.hostname.endsWith('.localhost')) return false;
  const query = new URLSearchParams(c.search);
  if (query.has('kits_editor') || query.has('kits_preview') || query.has('kits_preview_session')) return false;
  try { const url = new URL(c.endpoint || ''); return url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash; } catch { return false; }
}
export function createAnalyticsView(page: string, viewId: string, now: () => number, initiallyVisible: boolean, attribution: Attribution = UNKNOWN_ATTRIBUTION) {
  const attributionSnapshot = Object.freeze({...attribution});
  let last = now(), visible = initiallyVisible, visibleMs = 0, engagedMs = 0, activeUntil = -Infinity;
  let surveyStart: { at: number; visible: number; engaged: number } | null = null;
  let frozenTiming: SurveyTiming | null = null;
  let sequence = 0, signature = '', step: Step = 'brandVision', lastField: Field | null = null, lastInput: number | null = null, completed = false;
  function accrue() { const current = Math.max(last, now()); if (visible) { visibleMs += current - last; engagedMs += Math.max(0, Math.min(current, activeUntil) - last); } last = current; }
  function surveyTiming(): SurveyTiming | null {
    if (completed) return frozenTiming;
    return surveyStart ? { elapsedMs: ms(last - surveyStart.at), visibleMs: ms(visibleMs - surveyStart.visible), engagedMs: ms(engagedMs - surveyStart.engaged) } : null;
  }
  return {
    interaction() { accrue(); if (visible) activeUntil = last + 30_000; },
    setVisible(value: boolean) { accrue(); if (visible !== value) activeUntil = -Infinity; visible = value; },
    setSurvey(nextStep: string | null, done: boolean) {
      if (page !== '/tools/survey/' || !ANALYTICS_STEPS.includes(nextStep as Step) || completed) return;
      accrue(); step = nextStep as Step;
      // Never manufacture a start when a restored page is already complete.
      if (!done && !surveyStart && visible) surveyStart = { at: last, visible: visibleMs, engaged: engagedMs };
      if (done && step === 'contact') { frozenTiming = surveyTiming(); completed = true; }
    },
    input(field: string | null) { if (page !== '/tools/survey/' || !ANALYTICS_FIELDS.includes(field as Field)) return; accrue(); lastField = field as Field; lastInput = last; if (visible) activeUntil = last + 30_000; },
    snapshot(reason: Reason): Snapshot | null {
      accrue();
      const survey = page === '/tools/survey/' ? { step, lastField, lastInputAgoMs: lastInput === null ? null : ms(last - lastInput), completed, timing: surveyTiming() } : null;
      const nextSignature = JSON.stringify([ms(visibleMs), ms(engagedMs), step, lastField, lastInput, completed, survey?.timing]);
      if (signature === nextSignature) return null;
      signature = nextSignature;
      return { version: 3, viewId, sequence: ++sequence, page, visibleMs: ms(visibleMs), engagedMs: ms(engagedMs), reason, survey, attribution: attributionSnapshot };
    },
  };
}
export function sendAnalyticsSnapshot(endpoint: string, snapshot: Snapshot, transport: { fetch: typeof fetch }) {
  const body = JSON.stringify(snapshot);
  // Keepalive is best effort, including on close. Never use credential-including Beacon.
  try { void transport.fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body, keepalive: true, credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'error', cache: 'no-store' }).catch(() => {}); } catch { /* best effort */ }
}
/** Route-scoped subscription. Teardown does not manufacture abandonment. */
export function startVisitorAnalytics(page: string, endpoint: string, win: Window, doc: Document, allowed: () => boolean = () => true, attribution: Attribution = UNKNOWN_ATTRIBUTION) {
  const view = createAnalyticsView(page, win.crypto.randomUUID(), () => win.performance.now(), doc.visibilityState === 'visible', attribution);
  let disposed = false, completed = false, privacyStopped = false;
  const card = () => page === '/tools/survey/' ? doc.querySelector('[data-analytics-survey]') : null;
  const syncSurvey = () => { const node = card(); if (!node) return; const done = node.getAttribute('data-analytics-completed') === 'true'; view.setSurvey(node.getAttribute('data-analytics-step'), done); if (done && !completed) { completed = true; emit('complete'); } };
  function emit(reason: Reason) { if (disposed || privacyStopped) return; if (!allowed()) { privacyStopped = true; return; } const snapshot = view.snapshot(reason); if (snapshot) sendAnalyticsSnapshot(endpoint, snapshot, { fetch: win.fetch.bind(win) }); }
  const activity = () => view.interaction();
  const input = (event: Event) => { const target = event.target; if (!(target instanceof Element) || !card()?.contains(target)) return; view.input(target.getAttribute('data-analytics-field')); };
  const visibility = () => { view.setVisible(doc.visibilityState === 'visible'); syncSurvey(); if (doc.visibilityState !== 'visible') emit('hidden'); };
  const pagehide = () => { view.setVisible(false); syncSurvey(); emit('pagehide'); };
  const pageshow = () => { view.setVisible(doc.visibilityState === 'visible'); syncSurvey(); };
  const observer = new MutationObserver(syncSurvey);
  // The card can mount after this effect. Observe its stable ancestor from the
  // start so delayed hydration and later card replacement cannot miss completion.
  const surveyRoot = page === '/tools/survey/' ? doc.body : null;
  if (surveyRoot) observer.observe(surveyRoot, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-analytics-step', 'data-analytics-completed'] });
  syncSurvey();
  const interval = win.setInterval(() => { if (doc.visibilityState === 'visible') { syncSurvey(); emit('heartbeat'); } }, 15_000);
  for (const event of ['pointerdown', 'keydown', 'scroll', 'touchstart']) doc.addEventListener(event, activity, { passive: true });
  doc.addEventListener('input', input); doc.addEventListener('visibilitychange', visibility); win.addEventListener('pagehide', pagehide); win.addEventListener('pageshow', pageshow);
  return (navigation = false) => { if (disposed) return; if (navigation) emit('navigation'); disposed = true; observer.disconnect(); win.clearInterval(interval); for (const event of ['pointerdown', 'keydown', 'scroll', 'touchstart']) doc.removeEventListener(event, activity); doc.removeEventListener('input', input); doc.removeEventListener('visibilitychange', visibility); win.removeEventListener('pagehide', pagehide); win.removeEventListener('pageshow', pageshow); };
}
