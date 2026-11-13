import { ANALYTICS_CONSENT_KEY } from './analytics-consent';
/** Never bypass an existing refusal or an unreadable preference. */
export function basicCollectionAllowed(storage: Pick<Storage,'getItem'|'setItem'> | null) {
  try {
    if (!storage) return false;
    const current=storage.getItem(ANALYTICS_CONSENT_KEY);
    if (current==='deny') return false;
    if (current==='allow') return true;
    for (const key of ['kitsnode-analytics-consent-v1','kitsnode-analytics-consent-v2','kitsnode-analytics-consent-v3']) if (storage.getItem(key)==='deny') return false;
    return true;
  }
  catch { return false; }
}
export function sendBasicLoad(endpoint:string,fetcher:typeof fetch) {
  const url=new URL(endpoint); url.searchParams.set('resource','basic');
  return fetcher(url.toString(),{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify({version:1}),credentials:'omit',referrerPolicy:'no-referrer',redirect:'error',cache:'no-store',keepalive:true});
}
