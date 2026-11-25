// Change only when published notices, scoped consent and production setup are ready.
export const MEMBER_INTAKE_REVIEWED = true;

// A social sign-in must not become available while the member consent gate is off.
export function canUseMemberNaver(config) {
  return Boolean(MEMBER_INTAKE_REVIEWED && config?.signup && config?.naver);
}

// Public configuration is feature-gated and rejects secret or service-role keys.
export function readMemberAuthConfig(env) {
  if (env.enabled !== 'true') return null;
  const ref = env.projectRef;
  if (typeof ref !== 'string' || !/^[a-z0-9]{20}$/.test(ref)) return null;
  let url;
  try { url = new URL(env.url); } catch { return null; }
  if (url.protocol !== 'https:' || url.hostname !== `${ref}.supabase.co` || url.port || url.username || url.password || url.pathname !== '/' || url.search || url.hash) return null;
  // Only publishable keys, or legacy JWT keys whose role is explicitly anon.
  const key = env.key;
  if (typeof key !== 'string') return null;
  let publicKey = /^sb_publishable_[a-zA-Z0-9_-]+$/.test(key);
  if (!publicKey && /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(key)) {
    try {
      const payload = JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
      publicKey = payload.role === 'anon' && payload.ref === ref;
    } catch { return null; }
  }
  if (!publicKey) return null;
  // These flags affect the UI only; auth service must enforce equivalent rules.
  return { url: url.origin, key, signup: env.signup === 'true', naver: env.naver === 'true', link: env.link === 'true' };
}

export function memberRedirect(origin, basePath = '') {
  let url;
  try { url = new URL(origin); } catch { return null; }
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) return null;
  if (basePath && !/^\/[A-Za-z0-9_-]+$/.test(basePath)) return null;
  return `${url.origin}${basePath}/store/login/`;
}
