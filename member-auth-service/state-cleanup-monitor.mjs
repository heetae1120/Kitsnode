import {createStateCleanupWorker} from './state-cleanup-worker.mjs';

export function createMonitoredCleanup({cleanup = createStateCleanupWorker(), send = fetch} = {}) {
  return {
    async scheduled(controller, env) {
      let url;
      try {
        url = new URL(env.STATE_CLEANUP_MONITOR_URL);
        if (url.protocol !== 'https:' || url.hostname !== 'hc-ping.com' || url.port || url.username || url.password || url.search || url.hash || !/^\/[a-f0-9-]{36}$/.test(url.pathname)) throw new Error();
      } catch { throw new Error('Cleanup monitoring unavailable'); }
      try {
        await cleanup.scheduled(controller, env);
      } catch {
        try { await send(`${url.href}/fail`, {method:'POST', signal:AbortSignal.timeout(5000)}); } catch {}
        throw new Error('State cleanup failed');
      }
      let response;
      try { response = await send(url.href, {method:'POST', signal:AbortSignal.timeout(5000)}); }
      catch { throw new Error('Cleanup monitoring failed'); }
      if (!response.ok) throw new Error('Cleanup monitoring failed');
    },
    async fetch() { return new Response(null, {status:404,headers:{'cache-control':'no-store'}}); }
  };
}

export default createMonitoredCleanup();
