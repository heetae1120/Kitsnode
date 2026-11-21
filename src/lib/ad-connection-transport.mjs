// This literal is the sole permitted bearer-token destination. Changes require
// a code review; environment input can enable but cannot redirect requests.
export const AD_CONNECTION_ENDPOINT = 'https://bjpguxwqxlsteektkhwf.supabase.co/functions/v1/kitsnode-ad-api/connections';
const validToken = value => typeof value === 'string' && /^[A-Za-z0-9._-]{1,8192}$/.test(value);
const validAccount = value => typeof value === 'string' && /^[1-9]\d{0,15}$/.test(value);
const validId = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const validStatus = new Set(['pending_review','read_connected','disconnected']);

export function createAdConnectionTransport({enabled, fetcher = globalThis.fetch} = {}) {
  if (enabled !== true) return undefined;
  if (typeof fetcher !== 'function') throw new TypeError('invalid_transport');
  async function call(method, token, signal, accountId) {
    if (!validToken(token) || !signal || typeof signal.aborted !== 'boolean' || signal.aborted || (method === 'POST' && !validAccount(accountId)) || (method === 'DELETE' && !validId(accountId))) throw new Error('invalid_request');
    const response = await fetcher(method === 'DELETE' ? `${AD_CONNECTION_ENDPOINT}/${accountId}` : AD_CONNECTION_ENDPOINT, {
      method,
      headers: {Authorization: `Bearer ${token}`, ...(method === 'POST' ? {'Content-Type':'application/json'} : {})},
      ...(method === 'POST' ? {body:JSON.stringify({adAccountId:accountId})} : {}),
      credentials:'omit', redirect:'error', cache:'no-store', referrerPolicy:'no-referrer', signal,
    });
    if (!response.ok) throw new Error('connection_unavailable');
    const payload = await response.json();
    if (signal.aborted) throw new Error('request_cancelled');
    if (method === 'DELETE') {
      if (!payload || payload.status !== 'disconnected') throw new Error('invalid_response');
      return {status:'disconnected'};
    }
    if (method === 'POST') {
      if (!payload || payload.status !== 'pending_review') throw new Error('invalid_response');
      return {status:'pending_review'};
    }
    if (!payload || !Array.isArray(payload.connections) || payload.connections.length > 100 || !payload.connections.every(item=>item && validId(item.requestId) && validAccount(item.adAccountId) && validStatus.has(item.status))) throw new Error('invalid_response');
    return {connections:payload.connections.map(({requestId,adAccountId,status})=>({requestId,adAccountId,status}))};
  }
  return Object.freeze({list:(token,signal)=>call('GET',token,signal),request:(token,id,signal)=>call('POST',token,signal,id),disconnect:(token,id,signal)=>call('DELETE',token,signal,id)});
}
