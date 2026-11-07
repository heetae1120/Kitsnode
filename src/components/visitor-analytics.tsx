'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { analyticsAllowed, canonicalAnalyticsPage, startVisitorAnalytics } from '@/lib/analytics';
/** No rendered DOM, cookies, persistent IDs, or tracking SDK. */
export function VisitorAnalytics() {
  const pathname = usePathname();
  useEffect(() => {
    const endpoint = process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT || '';
    const page = canonicalAnalyticsPage(pathname, process.env.NEXT_PUBLIC_BASE_PATH || '');
    const allowed = () => analyticsAllowed({ enabled: process.env.NEXT_PUBLIC_ANALYTICS_ENABLED, endpoint,
      hostname: window.location.hostname, search: window.location.search,
      framed: window.self !== window.top, hasOpener: Boolean(window.opener),
      dnt: navigator.doNotTrack, gpc: (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl });
    if (!page || !allowed()) return;
    const stop = startVisitorAnalytics(page, endpoint, window, document, allowed);
    return () => stop(canonicalAnalyticsPage(window.location.pathname, process.env.NEXT_PUBLIC_BASE_PATH || '') !== page);
  }, [pathname]);
  return null;
}
