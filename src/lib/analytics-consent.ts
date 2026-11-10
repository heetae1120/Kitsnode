/** Consent preference only. Never store visitor IDs or analytics events. */
export const ANALYTICS_CONSENT_KEY = 'kitsnode-analytics-consent-v2';
export type AnalyticsConsent = 'allow' | 'deny' | 'unset';
type ConsentStorage = Pick<Storage, 'getItem' | 'setItem'> & Partial<Pick<Storage, 'removeItem'>> | null;

export function readAnalyticsConsent(storage: ConsentStorage): AnalyticsConsent {
  try {
    const value = storage?.getItem(ANALYTICS_CONSENT_KEY);
    if (value === 'allow' || value === 'deny') return value;
    // Old opt-in did not cover attribution. Keep old denial, require fresh opt-in.
    return storage?.getItem('kitsnode-analytics-consent-v1') === 'deny' ? 'deny' : 'unset';
  } catch { return 'unset'; }
}

export function writeAnalyticsConsent(storage: ConsentStorage, value: Exclude<AnalyticsConsent, 'unset'>): boolean {
  try { if (!storage) return false; storage.setItem(ANALYTICS_CONSENT_KEY, value); return true; }
  catch {
    // Quota restrictions can block writes but still allow clearing a stale opt-in.
    if (value === 'deny') { try { storage?.removeItem?.(ANALYTICS_CONSENT_KEY); } catch { /* current tab still stops immediately */ } }
    return false;
  }
}
