import type { Dataset } from './ad-health';

/** Server-side extension boundary. No implementation is configured in this static export. */
export interface StoreDataAdapter {
  provider: 'naver-searchad' | 'naver-commerce' | 'seller-statistics';
  capabilities: { orders: boolean; revenue: boolean; adClicks: boolean; adSpend: boolean; dwellTime: boolean; demographics: boolean };
  loadAggregates(request: { accountReference: string; productId: string; from: string; to: string; signal?: AbortSignal }): Promise<Dataset>;
}
export const connectionState = {
  searchAds: { connected: false, method: 'server-adapter', documentation: 'https://naver.github.io/searchad-apidoc/' },
  commerce: { connected: false, method: 'server-adapter', documentation: 'https://apicenter.commerce.naver.com/docs/commerce-api/current' },
  dwellAndAudience: { connected: false, method: 'statistics-file', documentation: null },
} as const;
