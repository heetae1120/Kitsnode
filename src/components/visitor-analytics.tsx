'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { analyticsAllowed, canonicalAnalyticsPage, startVisitorAnalytics } from '@/lib/analytics';
import { ANALYTICS_CONSENT_KEY, readAnalyticsConsent, writeAnalyticsConsent, type AnalyticsConsent } from '@/lib/analytics-consent';
import { classifyAttribution, UNKNOWN_ATTRIBUTION } from '@/lib/analytics-attribution';
import styles from './visitor-analytics.module.css';
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
      if (value !== 'allow') { stopRef.current?.(); stopRef.current = null; clearAnalyticsSession(sessionStorageSafe()); }
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
    const page = pathname === '/' ? null : canonicalAnalyticsPage(pathname, process.env.NEXT_PUBLIC_BASE_PATH || '');
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
    if (value === 'deny') { stopRef.current?.(); stopRef.current = null; clearAnalyticsSession(sessionStorageSafe()); }
    setSaved(writeAnalyticsConsent(storage(), value));
    setConsent(value);
    setSettings(false);
  };

  if (!available) return null;
  if (consent !== 'unset' && !settings) return <div className={styles.settingsWrap}>
    {!saved && <p role="status">선택을 저장하지 못했습니다. 이번 탭에만 적용되며, 다시 열면 분석 설정을 확인해 주세요.</p>}
    <button type="button" className={styles.settings} onClick={() => setSettings(true)}>방문 분석 설정</button>
  </div>;
  return <aside className={styles.panel} aria-label="선택적 방문 분석 설정">
    <strong>서비스 개선을 위한 방문 분석</strong>
    <p>사이트 운영을 위해 브라우저가 사이트를 연 횟수를 기본 통계로 집계합니다. 기본 통계는 Supabase kits(일본)에 날짜별 합계로 저장하며, 식별자, 페이지 주소, 유입 경로를 보내지 않습니다. 새로고침이나 새 탭은 별도 집계되며, 거부를 선택하거나 브라우저 추적 거부 설정을 켜면 이후 기본 통계도 수집하지 않습니다.</p>
    <p>허용하면 페이지 체류시간, 유입 출처·매체의 제한된 분류, 캠페인 태그 유무, 설문 단계·작성 시간·마지막 입력 항목 이름을 Supabase kits(일본)에 저장합니다. 사이트 접속 세션을 집계하기 위해 이 탭의 임시 식별자를 사용합니다. 30분간 활동이 없으면 새 세션으로 계산하며 탭을 닫으면 식별자가 사라집니다. 전체 주소·검색어·UTM 원문·캠페인 이름·답변 내용·이름·연락처는 보내지 않습니다.</p>
    <p>상세 분석 기록은 90일이 지나면 매일 삭제하고, 기본 일별 합계는 최근 90일간 보관합니다. 거부해도 모든 도구를 사용할 수 있고, ‘방문 분석 설정’에서 언제든 이후 수집을 중단할 수 있습니다. 허용·거부 선택은 브라우저에, 임시 세션 식별자와 마지막 활동 시각은 현재 탭에 저장됩니다. 이미 전송된 기록은 개인을 다시 식별해 찾아낼 수 없습니다.</p>
    {!saved && <p role="status">브라우저 저장이 차단되어 선택은 이번 탭에만 적용됩니다. 다시 열면 분석 설정을 확인해 주세요.</p>}
    <div className={styles.actions}>
      <button type="button" onClick={() => choose('deny')}>거부</button>
      <button type="button" onClick={() => choose('allow')}>상세 분석 허용</button>
      {consent !== 'unset' && <button type="button" onClick={() => setSettings(false)}>닫기</button>}
    </div>
  </aside>;
}
