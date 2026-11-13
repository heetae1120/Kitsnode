import type { Attribution } from './analytics-attribution';

const KEY = 'kitsnode-analysis-session-v1';
const IDLE_MS = 30 * 60 * 1000;
type Stored = { id: string; last: number };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function clearAnalyticsSession(storage: Storage | null) { try { storage?.removeItem(KEY); } catch {} }
export function startMainSession(storage: Storage | null, now: number, createId: () => string, isMain: boolean, attribution: Attribution): {id:string; created:boolean} | null {
  if (!storage) return null;
  try {
    const raw=storage.getItem(KEY); let current:Stored|null=null;
    if (raw) { try { current=JSON.parse(raw) as Stored; } catch {} }
    if (current && typeof current.id==='string' && uuid.test(current.id) && Number.isFinite(current.last) && current.last<=now && now-current.last<IDLE_MS) {
      storage.setItem(KEY,JSON.stringify({id:current.id,last:now})); return {id:current.id,created:false};
    }
    // A session is eligible only when its first observed page is the main page.
    if (!isMain || attribution.basis==='internal') { storage.removeItem(KEY); return null; }
    const id=createId(); if (!uuid.test(id)) return null;
    storage.setItem(KEY,JSON.stringify({id,last:now})); return {id,created:true};
  } catch { return null; }
}
export function sendMainSession(endpoint:string,id:string,attribution:Attribution,fetcher:typeof fetch) {
  const url=new URL(endpoint); url.searchParams.set('resource','session');
  const body=JSON.stringify({version:1,sessionId:id,landing:'main',attribution});
  try { void fetcher(url.toString(),{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},body,keepalive:true,credentials:'omit',referrerPolicy:'no-referrer',redirect:'error',cache:'no-store'}).catch(()=>{}); } catch {}
}
