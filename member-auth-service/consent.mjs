// Server-side building block, not a standalone HTTP server. The store must be
// durable, private, and implement both methods atomically before deployment.
export function createConsentGate({ auth, store, terms, allowedOrigins }) {
  const validTerms = terms && typeof terms.version === 'string' && terms.version.trim() && typeof terms.text === 'string' && terms.text.trim();
  const validStore = store && typeof store.hasAccepted === 'function' && typeof store.recordAcceptance === 'function';
  const origins = Array.isArray(allowedOrigins) ? allowedOrigins : [];

  async function sessionFor(request) {
    if (!validTerms || !validStore || !auth?.api?.getSession) return null;
    try {
      const session = await auth.api.getSession({ headers: request.headers });
      return typeof session?.user?.id === 'string' && session.user.id ? session : null;
    } catch { return null; }
  }

  return {
    // Protect each private API endpoint on the server before reading its data.
    async authorize(request) {
      const session = await sessionFor(request);
      if (!session) return { ok: false, status: 401 };
      try {
        if (await store.hasAccepted({ userId: session.user.id, version: terms.version }) !== true) return { ok: false, status: 403 };
        return { ok: true, userId: session.user.id };
      } catch { return { ok: false, status: 503 }; }
    },
    // Origin validation is necessary but must be combined with production cookie
    // and CSRF controls. Version and user are never accepted from caller claims.
    async accept(request) {
      if (!validTerms || !validStore || !origins.length) return { ok: false, status: 503 };
      if (request.method !== 'POST' || !origins.includes(request.headers.get('origin')) || !/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') || '')) return { ok: false, status: 403 };
      const session = await sessionFor(request);
      if (!session) return { ok: false, status: 401 };
      try {
        const body = await request.json();
        if (!body || body.accepted !== true || body.version !== terms.version || Object.keys(body).some(key => !['accepted', 'version'].includes(key))) return { ok: false, status: 400 };
        await store.recordAcceptance({ userId: session.user.id, version: terms.version });
        return { ok: true, status: 200 };
      } catch { return { ok: false, status: 503 }; }
    }
  };
}
