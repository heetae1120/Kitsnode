'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { analyticsAllowed, canonicalAnalyticsPage, startVisitorAnalytics } from '@/lib/analytics';
import { ANALYTICS_CONSENT_KEY, readAnalyticsConsent, writeAnalyticsConsent, type AnalyticsConsent } from '@/lib/analytics-consent';
import { classifyAttribution, UNKNOWN_ATTRIBUTION } from '@/lib/analytics-attribution';
import styles from './visitor-analytics.module.css';
import {clearSurveyAttempt} from '@/lib/analytics-survey-funnel';
import { clearAnalyticsSession, startSiteSession, sendSiteSession } from '@/lib/analytics-session';
import { basicCollectionAllowed, sendBasicLoad } from '@/lib/analytics-basic';

function sessionStorageSafe() { try { return window.sessionStorage; } catch { return null; } }
const sitePaths = new Set(['/','/tools/player/','/store/','/store/login/','/store/signup/','/store/sales/','/store/ads/','/store/ads/connect/','/store/ads/example/']);
function trackedSitePage(pathname: string) { const path=pathname.endsWith('/')?pathname:pathname+'/'; return sitePaths.has(path) || Boolean(canonicalAnalyticsPage(pathname, process.env.NEXT_PUBLIC_BASE_PATH || '')); }
function storage() { try { return window.localStorage; } catch { return null; } }
function eligible() {
  return analyticsAllowed({ enabled: process.env.NEXT_PUBLIC_ANALYTICS_ENABLED,
    endpoint: process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT || '',
    hostname: window.location.hostname, search: window.location.search,
    framed: window.self !== window.top, hasOpener: Boolean(window.opener),
    dnt: navigator.doNotTrack, gpc: (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl });
}
/** Consent is optional and independent from submitting a consultation. */
export function VisitorAnalytics() {
  const pathname = usePathname();
  const initialLoadChecked = useRef(false);
  const navigation = useRef({pathname, internal: false});
  const [consent, setConsent] = useState<AnalyticsConsent>('unset');
  const [available, setAvailable] = useState(false);
  const [settings, setSettings] = useState(false);
  const [saved, setSaved] = useState(true);
  const consentRef = useRef<AnalyticsConsent>('unset');
  const stopRef = useRef<null | ((navigation?: boolean) => void)>(null);
  useEffect(() => {
    if (initialLoadChecked.current) return;
    initialLoadChecked.current = true;
    if (!trackedSitePage(pathname) || !eligible()) return;
    if (!basicCollectionAllowed(storage())) return;
    try { void sendBasicLoad(process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT || '',window.fetch.bind(window)).catch(()=>{}); } catch { /* best effort */ }
  }, [pathname]);

  useEffect(() => {
    const refresh = () => {
      const value = readAnalyticsConsent(storage());
      consentRef.current = value;
      if (value !== 'allow') { stopRef.current?.(); stopRef.current = null; clearAnalyticsSession(sessionStorageSafe()); clearSurveyAttempt(sessionStorageSafe()); }
      setConsent(value);
    };
    refresh();
    const changed = (event: StorageEvent) => { if (event.key === ANALYTICS_CONSENT_KEY || event.key === null) refresh(); };
    window.addEventListener('storage', changed);
    return () => window.removeEventListener('storage', changed);
  }, []);

  useEffect(() => {
    if (navigation.current.pathname !== pathname) navigation.current = {pathname, internal: true};
    setAvailable(trackedSitePage(pathname) && eligible());
  }, [pathname]);

  useEffect(() => {
    const endpoint = process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT || '';
    const page = canonicalAnalyticsPage(pathname, process.env.NEXT_PUBLIC_BASE_PATH || '');
    const allowed = () => consentRef.current === 'allow' && eligible();
    if (consent !== 'allow' || !allowed() || !trackedSitePage(pathname)) return;
    const attr = classifyAttribution(window.location.search, document.referrer, window.location.origin, navigation.current.internal);
    let firstTouch = true;
    const touch = () => {
      if (!allowed()) return;
      // A new session after inactivity has no new external referrer.
      const eventAttribution = firstTouch && attr.basis !== 'internal' ? attr : UNKNOWN_ATTRIBUTION;
      firstTouch = false;
      const result = startSiteSession(sessionStorageSafe(), Date.now(), () => window.crypto.randomUUID());
      if (result?.created) sendSiteSession(endpoint, result.id, eventAttribution, window.fetch.bind(window));
    };
    touch();
    for (const event of ['pointerdown','keydown','scroll','touchstart']) document.addEventListener(event,touch,{passive:true});
    if (!page) return () => { for (const event of ['pointerdown','keydown','scroll','touchstart']) document.removeEventListener(event,touch); };
    const stop = startVisitorAnalytics(page, endpoint, window, document, allowed, classifyAttribution(window.location.search, document.referrer, window.location.origin, navigation.current.internal));
    stopRef.current = stop;
    return () => {
      for (const event of ['pointerdown','keydown','scroll','touchstart']) document.removeEventListener(event,touch);
      stop(canonicalAnalyticsPage(window.location.pathname, process.env.NEXT_PUBLIC_BASE_PATH || '') !== page);
      if (stopRef.current === stop) stopRef.current = null;
    };
  }, [pathname, consent]);

  const choose = (value: 'allow' | 'deny') => {
    // Withdraw immediately, before React effects or any later heartbeat can run.
    consentRef.current = value;
    if (value === 'deny') { stopRef.current?.(); stopRef.current = null; clearAnalyticsSession(sessionStorageSafe()); clearSurveyAttempt(sessionStorageSafe()); }
    setSaved(writeAnalyticsConsent(storage(), value));
    setConsent(value);
    setSettings(false);
  };

  if (!available) return null;
  if (consent !== 'unset' && !settings) return <div className={styles.settingsWrap}>
    {!saved && <p role="status">선택을 저장하지 못했습니다. 이번 탭에만 적용되며, 다시 열면 분석 설정을 확인해 주세요.</p>}
    <button type="button" className={styles.settings} onClick={() => setSettings(true)}>방문 분석 설정</button>
  </div>;
  return <aside className={styles.banner} aria-labelledby="analytics-title">
    <div className={styles.content}>
      <h2 id="analytics-title">더 나은 키츠노드를 위해 방문 분석에 동의해 주세요.</h2>
      <p>이용 현황을 분석해 서비스를 개선합니다. 자세한 내용은 개인정보 처리방침에서 확인할 수 있습니다. <Link href="/privacy/" target="_blank" rel="noopener noreferrer">개인정보 처리방침</Link></p>
      {!saved && <p role="status" className={styles.warning}>브라우저 저장이 차단되어 선택은 이번 탭에만 적용됩니다. 다시 열면 분석 설정을 확인해 주세요.</p>}
    </div>
    <div className={styles.actions}>
      <button type="button" className={styles.reject} onClick={() => choose('deny')}>동의하지 않음</button>
      <button type="button" className={styles.accept} onClick={() => choose('allow')}>동의하기</button>
    </div>
  </aside>;
}
