import authWorker from './cloudflare-worker.mjs';

// Candidate for a Workers-hosted static frontend. API requests must never
// fall through to static content when authentication is unavailable.
export function createSameOriginWorker({auth = authWorker} = {}) {
  return {async fetch(request, env, context) {
    const path = new URL(request.url).pathname;
    if (path === '/api' || path.startsWith('/api/')) {
      if (!auth || typeof auth.fetch !== 'function') return new Response(null, {status: 503});
      return auth.fetch(request, env, context);
    }
    if (!env?.ASSETS || typeof env.ASSETS.fetch !== 'function') return new Response(null, {status: 503});
    return env.ASSETS.fetch(request);
  }};
}

export default createSameOriginWorker();
