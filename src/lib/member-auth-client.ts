/** Public endpoint only; no credentials belong in frontend configuration. */
export function memberAuthBase(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/') return null;
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) return null;
    return url.origin;
  } catch { return null; }
}

export function isMemberPreview(search: string): boolean {
  const query = new URLSearchParams(search);
  return query.has('kits_preview') || query.has('kits_editor');
}

export function isEmailAuthAvailable(session: { emailAvailable?: unknown } | null): boolean {
  return session?.emailAvailable === true;
}

/** Only the actual Naver authorization endpoint and this server's callback are allowed. */
export function naverAuthorizationUrl(value: unknown, base: string): string | null {
  if (typeof value !== 'string') return null;
  try {
    const target = new URL(value);
    if (target.origin !== 'https://nid.naver.com' || target.pathname !== '/oauth2.0/authorize' || target.username || target.password || target.hash) return null;
    for (const field of ['client_id', 'state', 'response_type', 'redirect_uri']) {
      if (target.searchParams.getAll(field).length !== 1 || !target.searchParams.get(field)) return null;
    }
    if (target.searchParams.get('response_type') !== 'code' || target.searchParams.get('redirect_uri') !== `${base}/api/auth/callback/naver`) return null;
    return target.href;
  } catch { return null; }
}

export async function memberRequest(base: string | null, search: string, path: string, body?: Record<string, unknown>): Promise<unknown> {
  if (!base || isMemberPreview(search) || !/^\/api\/(?:auth|member)\/[a-z0-9/-]+$/.test(path)) throw new Error('인증 서비스를 사용할 수 없습니다.');
  const response = await fetch(base + path, { credentials: 'include', cache: 'no-store', ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
  if (!response.ok) throw new Error('요청을 처리하지 못했습니다. 입력 정보와 연결 상태를 확인하고 다시 시도해 주세요.');
  return response.json();
}
