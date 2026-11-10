/** Finite categories only: never persist URLs, domains, query values or identifiers. */
export const ATTRIBUTION_SOURCES = ['google','naver','daum','bing','yahoo','duckduckgo','youtube','instagram','facebook','kakao','x','linkedin','newsletter','internal','other_referral','direct_or_unknown','other_tagged'] as const;
export const ATTRIBUTION_MEDIA = ['organic','social','referral','email','paid_search','paid_social','display','internal','direct_or_unknown','other_tagged'] as const;
export type Attribution = { basis: 'utm' | 'referrer' | 'internal' | 'unknown'; source: typeof ATTRIBUTION_SOURCES[number]; medium: typeof ATTRIBUTION_MEDIA[number]; campaign: 'none' | 'other_tagged' };
export const UNKNOWN_ATTRIBUTION: Attribution = {basis:'unknown',source:'direct_or_unknown',medium:'direct_or_unknown',campaign:'none'};
const sources: Record<string, Attribution['source']> = {google:'google',naver:'naver',daum:'daum',bing:'bing',yahoo:'yahoo',duckduckgo:'duckduckgo',youtube:'youtube',instagram:'instagram',facebook:'facebook',kakao:'kakao',twitter:'x',x:'x',linkedin:'linkedin',newsletter:'newsletter'};
const media: Record<string, Attribution['medium']> = {organic:'organic',social:'social',referral:'referral',email:'email',cpc:'paid_search',ppc:'paid_search',paid_search:'paid_search',paid_social:'paid_social',display:'display'};
const hosts: [string,string,Attribution['medium']][] = [
  ['google.com','google','organic'],['google.co.kr','google','organic'],['naver.com','naver','organic'],['daum.net','daum','organic'],['bing.com','bing','organic'],['yahoo.com','yahoo','organic'],['duckduckgo.com','duckduckgo','organic'],['youtube.com','youtube','social'],['youtu.be','youtube','social'],['instagram.com','instagram','social'],['facebook.com','facebook','social'],['fb.com','facebook','social'],['kakao.com','kakao','social'],['kakao.co.kr','kakao','social'],['x.com','x','social'],['twitter.com','x','social'],['t.co','x','social'],['linkedin.com','linkedin','social']
];
/** Call only after consent. Attribution describes this page arrival, not a user/session. */
export function classifyAttribution(search: string, referrer: string, origin: string, internalNavigation = false): Attribution {
  const query = new URLSearchParams(search);
  const tagged = ['utm_source','utm_medium','utm_campaign'].some(k => query.has(k));
  if (tagged) {
    const category = <T extends string>(key: string, allow: Record<string,T>): T | 'other_tagged' => {
      const values = query.getAll(key);
      const value = values.length === 1 && values[0].length <= 32 ? values[0].trim().toLowerCase() : '';
      return Object.hasOwn(allow,value) ? allow[value] : 'other_tagged';
    };
    return {basis:'utm',source:category('utm_source',sources),medium:category('utm_medium',media),campaign:query.has('utm_campaign') ? 'other_tagged' : 'none'};
  }
  if (internalNavigation) return {basis:'internal',source:'internal',medium:'internal',campaign:'none'};
  if (!referrer) return {...UNKNOWN_ATTRIBUTION};
  try {
    const url = new URL(referrer);
    if (!['http:','https:'].includes(url.protocol) || url.username || url.password) return {...UNKNOWN_ATTRIBUTION};
    if (url.origin === origin) return {basis:'internal',source:'internal',medium:'internal',campaign:'none'};
    const match = hosts.find(([host]) => url.hostname === host || url.hostname.endsWith('.'+host));
    return {basis:'referrer',source:match ? sources[match[1]] : 'other_referral',medium:match ? match[2] : 'referral',campaign:'none'};
  } catch { return {...UNKNOWN_ATTRIBUTION}; }
}
