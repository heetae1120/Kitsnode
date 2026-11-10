import nodemailer from 'nodemailer';
import { createHmac } from 'node:crypto';

// Deliberately accept one plain mailbox only, not a list, display name, or headers.
const isMailbox = value => typeof value === 'string' && value.length <= 254 && /^[^\s@,;<>"\\\x00-\x1f\x7f]+@[^\s@,;<>"\\\x00-\x1f\x7f]+$/.test(value);
function configuredOrigin(value) {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) return null;
    return parsed.origin;
  } catch { return null; }
}

function createMailBuilder({ from, authBaseURL, redirectOrigins = [] }) {
  const allowedOrigin = configuredOrigin(authBaseURL);
  const allowedRedirectOrigins = Array.isArray(redirectOrigins) ? redirectOrigins.map(configuredOrigin) : [null];
  if (!isMailbox(from) || !allowedOrigin || allowedRedirectOrigins.includes(null)) throw new Error('Incomplete mail configuration');
  return ({ to, kind, url }) => {
    let link;
    try { link = new URL(url); } catch { throw new Error('Invalid mail request'); }
    if (!['verification', 'reset'].includes(kind) || !isMailbox(to) || link.origin !== allowedOrigin || link.username || link.password || link.hash || (kind === 'verification' ? link.pathname !== '/api/auth/verify-email' : !/^\/api\/auth\/reset-password\/[A-Za-z0-9_-]+$/.test(link.pathname))) throw new Error('Invalid mail request');
    for (const key of ['token', 'callbackURL']) if (link.searchParams.getAll(key).length > 1) throw new Error('Invalid mail request');
    if (kind === 'verification' && !link.searchParams.get('token')) throw new Error('Invalid mail request');
    const callback = link.searchParams.get('callbackURL');
    if (callback) {
      // Only an explicitly allowed frontend origin or a same-origin relative
      // path may receive a post-verification or post-reset redirect.
      let destination;
      try { destination = new URL(callback, allowedOrigin); } catch { throw new Error('Invalid mail request'); }
      if (destination.username || destination.password || ![allowedOrigin, ...allowedRedirectOrigins].includes(destination.origin)) throw new Error('Invalid mail request');
    }
    return { from, to, subject: kind === 'verification' ? '이메일 인증' : '비밀번호 재설정', link: link.href };
  };
}

export function createSmtpMailSender({ host, port, user, password, from, authBaseURL, redirectOrigins = [], transport }) {
  const build = createMailBuilder({from,authBaseURL,redirectOrigins});
  if (typeof host !== 'string' || !/^[a-z0-9.-]+$/i.test(host) || typeof user !== 'string' || !user || /[\r\n]/.test(user) || typeof password !== 'string' || !password || !Number.isInteger(port) || ![465, 587].includes(port)) throw new Error('Incomplete SMTP configuration');
  const client = transport || nodemailer.createTransport({ host, port, secure: port === 465, requireTLS: true, auth: { user, pass: password }, disableFileAccess: true, disableUrlAccess: true });
  return async request => {
    const {to,subject,link} = build(request);
    try {
      const result = await client.sendMail({ from, to, subject, text: `${subject} 링크입니다.\n${link}` });
      if (Array.isArray(result?.rejected) && result.rejected.length) throw new Error('Recipient rejected');
    } catch {
      // SMTP library errors may embed account details or the one-time link.
      throw new Error('Mail delivery failed');
    }
  };
}

// Ncloud SENS MAIL v2: HTTP 202 means accepted for asynchronous delivery,
// not delivered. Avoid automatic retries when the outcome is unknown.
export function createSensMailSender({ serviceId, accessKey, secretKey, from, authBaseURL, redirectOrigins = [], fetchImpl = fetch, clock = Date.now }) {
  const build = createMailBuilder({from,authBaseURL,redirectOrigins});
  if (typeof serviceId !== 'string' || !/^[A-Za-z0-9:._-]{1,255}$/.test(serviceId) || typeof accessKey !== 'string' || !/^[A-Za-z0-9_-]{1,255}$/.test(accessKey) || typeof secretKey !== 'string' || !secretKey || /[\r\n]/.test(secretKey) || typeof fetchImpl !== 'function' || typeof clock !== 'function') throw new Error('Incomplete SENS configuration');
  const path = `/mail/v2/services/${serviceId}/requests`;
  return async request => {
    const {to,subject,link} = build(request);
    const timestamp = String(clock());
    if (!/^\d{13}$/.test(timestamp)) throw new Error('Mail delivery failed');
    const signature = createHmac('sha256', secretKey).update(`POST ${path}\n${timestamp}\n${accessKey}`).digest('base64');
    const escaped = link.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
    try {
      const response = await fetchImpl(`https://sens.apigw.ntruss.com${path}`, {
        method:'POST', redirect:'error', signal:AbortSignal.timeout(10000),
        headers:{'content-type':'application/json','x-ncp-apigw-timestamp':timestamp,'x-ncp-iam-access-key':accessKey,'x-ncp-apigw-signature-v2':signature},
        body:JSON.stringify({senderAddress:from,title:subject,body:`<p>${subject} 링크입니다.</p><p><a href="${escaped}">${escaped}</a></p>`,individual:true,advertising:false,recipients:[{address:to,type:'TO'}]})
      });
      if (response.status !== 202) throw new Error('Mail request not accepted');
      // The provider is asynchronous. Preserve only a bounded request ID for
      // server-side delivery tracking; an invalid response is uncertain, not
      // proof of failure or grounds for an automatic retry.
      const declaredLength = Number(response.headers.get('content-length') || 0);
      if (declaredLength > 4096) throw new Error('Invalid mail response');
      const reader = response.body?.getReader();
      if (!reader) throw new Error('Invalid mail response');
      const chunks = []; let total = 0;
      try {
        while (true) {
          const {done,value} = await reader.read();
          if (done) break;
          total += value.byteLength;
          if (total > 4096) { await reader.cancel(); throw new Error('Invalid mail response'); }
          chunks.push(value);
        }
      } finally { reader.releaseLock(); }
      const receipt = JSON.parse(new TextDecoder().decode(Buffer.concat(chunks)));
      if (typeof receipt?.requestId !== 'string' || !receipt.requestId || receipt.requestId.length > 256 || receipt.requestCount !== 1) throw new Error('Invalid mail response');
      return {accepted:true,requestId:receipt.requestId};
    } catch { throw new Error('Mail delivery failed'); }
  };
}
