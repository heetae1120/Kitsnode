export const AD_CONNECTION_ENDPOINT: 'https://bjpguxwqxlsteektkhwf.supabase.co/functions/v1/kitsnode-ad-api/connections';
export type AdConnectionTransport = {
  list(token: string, signal: AbortSignal): Promise<{connections: Array<{adAccountId: string; status: string}>}>;
  request(token: string, adAccountId: string, signal: AbortSignal): Promise<{status: 'pending_review'}>;
};
export function createAdConnectionTransport(options?: {enabled?: boolean; fetcher?: typeof fetch}): AdConnectionTransport | undefined;
