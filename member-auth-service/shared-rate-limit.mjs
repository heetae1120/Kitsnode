// Conservative global fixed-window gate: never trusts client-supplied IP headers.
// Not a replacement for verified gateway per-client and account-level limits.
export function createSharedRateLimit({pool, max=120, windowSeconds=60}) {
  if (!pool?.query || !Number.isInteger(max) || max<1 || max>10000 || !Number.isInteger(windowSeconds) || windowSeconds<1 || windowSeconds>3600) throw new Error('Invalid rate limit configuration');
  return async function check() {
    const result=await pool.query(`INSERT INTO member_auth_support.request_limits AS limits (bucket,window_start,count)
      VALUES ('auth-global',now(),1)
      ON CONFLICT (bucket) DO UPDATE SET
      window_start = CASE WHEN limits.window_start <= now() - ($1 * interval '1 second') THEN now() ELSE limits.window_start END,
      count = CASE WHEN limits.window_start <= now() - ($1 * interval '1 second') THEN 1 ELSE limits.count + 1 END
      WHERE limits.window_start <= now() - ($1 * interval '1 second') OR limits.count < $2
      RETURNING count`,[windowSeconds,max]);
    return result.rows.length===1;
  };
}
export function withSharedRateLimit(handle, check, allowedOrigins = []) {
  if (typeof handle!=='function'||typeof check!=='function'||!Array.isArray(allowedOrigins)) throw new Error('Invalid rate limit handler');
  return async request=>{
    if (request.method==='OPTIONS') return handle(request);
    const errorResponse = (error, status) => {
      const headers = new Headers({'cache-control':'no-store','vary':'Origin'});
      const origin = request.headers.get('origin');
      if (origin && allowedOrigins.includes(origin)) {
        headers.set('access-control-allow-origin',origin);
        headers.set('access-control-allow-credentials','true');
      }
      if (status === 429) headers.set('retry-after','60');
      return Response.json({error},{status,headers});
    };
    try { if (!await check()) return errorResponse('rate_limited',429); }
    catch { return errorResponse('unavailable',503); }
    return handle(request);
  };
}
