export const AD_CONNECTION_ENDPOINT: 'https://bjpguxwqxlsteektkhwf.supabase.co/functions/v1/kitsnode-ad-api/connections';
export type AdConnectionTransport = {
  list(token: string, signal: AbortSignal): Promise<{connections: Array<{requestId: string; adAccountId: string; status: string}>}>;
  disconnect(token: string, requestId: string, signal: AbortSignal): Promise<{status: 'disconnected'}>;
  request(token: string, adAccountId: string, signal: AbortSignal): Promise<{status: 'pending_review'}>;
};
export function createAdConnectionTransport(options?: {enabled?: boolean; fetcher?: typeof fetch}): AdConnectionTransport | undefined;
