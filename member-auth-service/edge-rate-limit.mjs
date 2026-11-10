import {createHmac} from 'node:crypto';
import {isIP} from 'node:net';

// Cloudflare binding limits are per-location and approximate, not global.
export function createEdgeRateLimits({ipLimiter, accountLimiter, secret}) {
  if (typeof ipLimiter?.limit !== 'function' || typeof accountLimiter?.limit !== 'function' || typeof secret !== 'string' || secret.length < 32) throw new Error('Edge rate limits unavailable');
  const key = (kind, value) => createHmac('sha256',secret).update(`${kind}\0${value}`).digest('hex');
  return {
    async ip(request) {
      const ip=request.headers.get('cf-connecting-ip');
      if (!ip || ip.length > 45 || !isIP(ip)) throw new Error('Client IP unavailable');
      // URL parsing canonicalizes IPv6 spellings before deriving the key.
      const canonical=isIP(ip)===6 ? new URL(`http://[${ip}]/`).hostname : ip;
      return (await ipLimiter.limit({key:key('ip',canonical)})).success === true;
    },
    async account(userId) {
      if (typeof userId !== 'string' || !userId || userId.length > 256) throw new Error('Invalid account');
      return (await accountLimiter.limit({key:key('account',userId)})).success === true;
    }
  };
}
