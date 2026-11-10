// Defense in depth for the local authentication gateway. Call before forwarding
// any authentication request to Better Auth. Explicit linking remains disabled
// until a separately verified reauthentication and atomic linking flow exists.
export async function guardIdentityLink(request, auth) {
  const path = new URL(request.url).pathname;
  const deny = (status = 403) => Response.json({ error: 'identity_link_unavailable' }, { status, headers: { 'cache-control': 'no-store' } });
  // Do not rely on a particular Better Auth version's linking or unlinking rules.
  if (path === '/api/auth/link-social' || path === '/api/auth/unlink-account') return deny();
  if (path !== '/api/auth/sign-in/social') return null;
  if (request.method !== 'POST' || !/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') || '')) return deny(400);
  let body;
  try {
    const text = await request.clone().text();
    if (new TextEncoder().encode(text).length > 16384) return deny(400);
    body = JSON.parse(text);
  } catch { return deny(400); }
  // Prevent native ID-token or account-selection variants from bypassing the
  // browser OAuth flow. Redirect destinations require separate allowlisting.
  if (!body || typeof body !== 'object' || Array.isArray(body) || body.provider !== 'naver' || Object.keys(body).some(key => !['provider', 'callbackURL'].includes(key)) || (body.callbackURL !== undefined && typeof body.callbackURL !== 'string')) return deny(400);
  if (!auth?.api?.getSession) return deny(503);
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (session == null) return null;
    // Even a partially formed response cannot be treated as logged out.
    return deny();
  } catch { return deny(503); }
}
