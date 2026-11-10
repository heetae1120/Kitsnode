// Transport adapter only. No credentials, database, or provider configuration.
// The caller supplies a trusted fixed public origin and a Fetch-compatible handler.
export function createCloudFunctionsAdapter({ origin, handle, bodyEncoding = 'base64' }) {
  const base = new URL(origin);
  if (base.protocol !== 'https:' || base.origin !== origin || base.username || base.password || typeof handle !== 'function' || !['base64', 'text'].includes(bodyEncoding)) throw new Error('Invalid adapter configuration');
  const failure = (statusCode, error) => ({statusCode, headers:{'content-type':'application/json','cache-control':'no-store'}, body:JSON.stringify({error})});
  return async event => {
    try {
      if (!event || typeof event !== 'object' || Array.isArray(event)) return failure(400,'invalid_request');
      const method = typeof event.__ow_method === 'string' ? event.__ow_method.toUpperCase() : '';
      const path = event.__ow_path;
      const query = event.__ow_query ?? '';
      if (!['GET','POST','OPTIONS'].includes(method) || typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//') || /[\\?#\x00-\x1f]/.test(path) || typeof query !== 'string' || /[\r\n#]/.test(query)) return failure(400,'invalid_request');
      const url = new URL(path + (query ? '?' + query : ''), origin);
      if (url.origin !== origin || url.pathname !== path) return failure(400,'invalid_request');
      if (!event.__ow_headers || typeof event.__ow_headers !== 'object' || Array.isArray(event.__ow_headers)) return failure(400,'invalid_request');
      const headers = new Headers();
      for (const [name, value] of Object.entries(event.__ow_headers)) {
        if (typeof value !== 'string') return failure(400,'invalid_request');
        if (!['host','content-length','forwarded','x-forwarded-host','x-forwarded-proto','x-forwarded-for','x-real-ip'].includes(name.toLowerCase())) headers.append(name,value);
      }
      let body;
      if (event.__ow_body != null) {
        if (typeof event.__ow_body !== 'string' || event.__ow_body.length > 90000 || ['GET','OPTIONS'].includes(method)) return failure(400,'invalid_request');
        if (bodyEncoding === 'base64') {
          if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(event.__ow_body)) return failure(400,'invalid_request');
          body = Buffer.from(event.__ow_body,'base64');
        } else body = event.__ow_body;
        if (Buffer.byteLength(body) > 65536) return failure(413,'request_too_large');
      }
      const response = await handle(new Request(url, {method,headers,body}));
      if (!(response instanceof Response)) throw new Error('Invalid handler response');
      const cookies = response.headers.getSetCookie();
      const outputHeaders = {};
      for (const [key,value] of response.headers) if (key !== 'set-cookie') outputHeaders[key] = value;
      if (cookies.length === 1) outputHeaders['Set-Cookie'] = cookies[0];
      // Verified against an isolated Ncloud KR VPC Web Action and API Gateway:
      // array entries arrive as distinct Set-Cookie response headers.
      if (cookies.length > 1) outputHeaders['Set-Cookie'] = cookies;
      return {statusCode:response.status,headers:outputHeaders,body:await response.text()};
    } catch { return failure(503,'unavailable'); }
  };
}
