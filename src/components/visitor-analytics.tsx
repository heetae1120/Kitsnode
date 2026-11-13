'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { analyticsAllowed, canonicalAnalyticsPage, startVisitorAnalytics } from '@/lib/analytics';
import { ANALYTICS_CONSENT_KEY, readAnalyticsConsent, writeAnalyticsConsent, type AnalyticsConsent } from '@/lib/analytics-consent';
import { classifyAttribution, UNKNOWN_ATTRIBUTION } from '@/lib/analytics-attribution';
import styles from './visitor-analytics.module.css';
import { clearAnalyticsSession, startMainSession, sendMainSession } from '@/lib/analytics-session';

function sessionStorageSafe() { try { return window.sessionStorage; } catch { return null; } }
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
  const navigation = useRef({pathname, internal: false});
  const [consent, setConsent] = useState<AnalyticsConsent>('unset');
  const [available, setAvailable] = useState(false);
  const [settings, setSettings] = useState(false);
  const [saved, setSaved] = useState(true);
  const consentRef = useRef<AnalyticsConsent>('unset');
  const stopRef = useRef<null | ((navigation?: boolean) => void)>(null);
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
    setAvailable((pathname === '/' || Boolean(canonicalAnalyticsPage(pathname, process.env.NEXT_PUBLIC_BASE_PATH || ''))) && eligible());
  }, [pathname]);

  useEffect(() => {
    const endpoint = process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT || '';
    const page = pathname === '/' ? null : canonicalAnalyticsPage(pathname, process.env.NEXT_PUBLIC_BASE_PATH || '');
    const allowed = () => consentRef.current === 'allow' && eligible();
    if (consent !== 'allow' || !allowed() || (!page && pathname !== '/')) return;
    const attr = classifyAttribution(window.location.search, document.referrer, window.location.origin, navigation.current.internal);
    const main = pathname === '/';
    let firstTouch = true;
    const touch = () => {
      if (!allowed()) return;
      // A new session after inactivity has no new external referrer.
      const eventAttribution = firstTouch || attr.basis === 'internal' ? attr : UNKNOWN_ATTRIBUTION;
      firstTouch = false;
      const result = startMainSession(sessionStorageSafe(), Date.now(), () => window.crypto.randomUUID(), main, eventAttribution);
      if (result?.created) sendMainSession(endpoint, result.id, eventAttribution, window.fetch.bind(window));
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
    <p>허용하면 페이지 체류시간, 유입 출처·매체의 제한된 분류, 캠페인 태그 유무, 설문 단계·작성 시간·마지막 입력 항목 이름을 Supabase kits(일본)에 저장합니다. 메인 페이지에서 시작한 유입 세션을 집계하기 위해 이 탭의 임시 식별자를 사용합니다. 30분간 활동이 없으면 새 세션으로 계산하며 탭을 닫으면 식별자가 사라집니다. 전체 주소·검색어·UTM 원문·캠페인 이름·답변 내용·이름·연락처는 보내지 않습니다.</p>
    <p>90일이 지난 기록은 매일 삭제합니다. 거부해도 모든 도구를 사용할 수 있고, ‘방문 분석 설정’에서 언제든 이후 수집을 중단할 수 있습니다. 허용·거부 선택은 브라우저에, 임시 세션 식별자와 마지막 활동 시각은 현재 탭에 저장됩니다. 이미 전송된 기록은 개인을 다시 식별해 찾아낼 수 없습니다.</p>
    {!saved && <p role="status">브라우저 저장이 차단되어 선택은 이번 탭에만 적용됩니다. 다시 열면 분석 설정을 확인해 주세요.</p>}
    <div className={styles.actions}>
      <button type="button" onClick={() => choose('deny')}>거부</button>
      <button type="button" onClick={() => choose('allow')}>선택 분석 허용</button>
      {consent !== 'unset' && <button type="button" onClick={() => setSettings(false)}>닫기</button>}
    </div>
  </aside>;
}
