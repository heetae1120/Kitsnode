// No request bodies, URLs, IP addresses, tokens, or user agents are logged here.
export const ANALYTICS_PAGES = ['/tools/','/tools/start/','/tools/rankings/','/tools/seo/','/tools/traffic/','/tools/bidding/','/tools/negative-search/','/tools/keywords/','/tools/survey/','/tools/about/','/tools/market/','/tools/consultation/'];
export const SURVEY_STEPS = ['brandVision','audience','category','stage','budget','support','brandGoal','contact'];
export const SURVEY_FIELDS = ['brandVision','audience','categoryOther','brandGoal','store','company','nameRole','phone'];
const reasons = ['heartbeat','hidden','pagehide','navigation','complete'];
const object = value => !!value && typeof value === 'object' && !Array.isArray(value);
const exactKeys = (value, keys) => object(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const integer = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;
export const ATTRIBUTION_VALUES = {"source": ["google", "naver", "daum", "bing", "yahoo", "duckduckgo", "youtube", "instagram", "facebook", "kakao", "x", "linkedin", "newsletter", "internal", "other_referral", "direct_or_unknown", "other_tagged"], "medium": ["organic", "social", "referral", "email", "paid_search", "paid_social", "display", "internal", "direct_or_unknown", "other_tagged"], "campaign": ["none", "other_tagged"], "basis": ["utm", "referrer", "internal", "unknown"]};
export function validateAttribution(value) {
  return exactKeys(value, Object.keys(ATTRIBUTION_VALUES)) && Object.entries(ATTRIBUTION_VALUES).every(([key, values]) => values.includes(value[key]));
}
export function validateAnalyticsEvent(value) {
  if (!exactKeys(value, ['version','viewId','sequence','page','visibleMs','engagedMs','reason','survey', ...(value?.version === 3 ? ['attribution'] : [])])) return false;
  if (![1,2,3].includes(value.version) || typeof value.viewId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.viewId)) return false;
  if (value.version === 3 && !validateAttribution(value.attribution)) return false;
  if (!integer(value.sequence, 1, 100000) || !ANALYTICS_PAGES.includes(value.page) || !integer(value.visibleMs, 0, 86400000) || !integer(value.engagedMs, 0, value.visibleMs) || !reasons.includes(value.reason)) return false;
  if (value.page !== '/tools/survey/') return value.survey === null && value.reason !== 'complete';
  const survey = value.survey;
  if (!exactKeys(survey, value.version === 1 ? ['step','lastField','lastInputAgoMs','completed'] : ['step','lastField','lastInputAgoMs','completed','timing']) || !SURVEY_STEPS.includes(survey.step) || typeof survey.completed !== 'boolean') return false;
  if (survey.lastField === null ? survey.lastInputAgoMs !== null : !SURVEY_FIELDS.includes(survey.lastField) || !integer(survey.lastInputAgoMs, 0, 86400000)) return false;
  if (value.version >= 2 && survey.timing !== null) {
    const timing = survey.timing;
    if (!exactKeys(timing, ['elapsedMs','visibleMs','engagedMs']) || !integer(timing.elapsedMs, 0, 86400000) || !integer(timing.visibleMs, 0, Math.min(timing.elapsedMs, value.visibleMs)) || !integer(timing.engagedMs, 0, Math.min(timing.visibleMs, value.engagedMs))) return false;
  }
  return (!survey.completed || survey.step === 'contact') && (value.reason !== 'complete' || survey.completed);
}
export function parseAnalyticsOrigins(value = '') {
  return [...new Set(value.split(',').map(item => item.trim()).filter(item => {
    try { const url = new URL(item); return url.protocol === 'https:' && url.origin === item && !url.username && !url.password; } catch { return false; }
  }))];
}
async function limitedBody(request, maxBytes = 2048) {
  const length = request.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > maxBytes)) throw new Error('too_large');
  if (!request.body) return '';
  const reader = request.body.getReader(); const chunks = []; let size = 0;
  try {
    while (true) {
      const {done, value} = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new Error('too_large'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return new TextDecoder('utf-8', {fatal:true}).decode(bytes);
}
export function createAnalyticsHandler({projectUrl, serviceKey, ingestEnabled = false, frontendOrigins = /** @type {string[]} */ ([]), adminOrigins = /** @type {string[]} */ ([]), fetchImpl = fetch, now = Date.now}) {
  // CORS is a browser boundary, not proof of origin. Global durable ingestion caps live in SQL.
  const front = new Set(frontendOrigins); const admins = new Set(adminOrigins);
  const reportRequests = new Map();
  const rpc = async (name, body) => {
    const result = await fetchImpl(`${projectUrl}/rest/v1/rpc/${name}`, {method:'POST', headers:{apikey:serviceKey,Authorization:`Bearer ${serviceKey}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(10000),redirect:'error'});
    if (!result.ok) throw new Error('storage_unavailable');
    return result.json();
  };
  return async request => {
    const url = new URL(request.url); const resource = url.searchParams.get('resource') || 'collect';
    const origin = request.headers.get('origin') || '';
    const allowed = resource === 'report' ? admins.has(origin) : ['collect','session'].includes(resource) && front.has(origin);
    const headers = {'Cache-Control':'no-store','Vary':'Origin','Content-Type':'application/json; charset=utf-8','X-Content-Type-Options':'nosniff', ...(allowed ? {'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':resource === 'report' ? 'GET, OPTIONS' : 'POST, OPTIONS','Access-Control-Allow-Headers':resource === 'report' ? 'x-github-token' : 'content-type'} : {})};
    const respond = (body, status = 200, extra = {}) => new Response(JSON.stringify(body), {status,headers:{...headers,...extra}});
    if (!allowed) return respond({error:'origin_not_allowed'},403);
    if (request.method === 'OPTIONS') return new Response(null,{status:204,headers});
    try {
      if (resource === 'session') {
        if (request.method !== 'POST') return respond({error:'method_not_allowed'},405);
        if (!ingestEnabled) return respond({error:'collection_disabled'},503);
        if ([...url.searchParams.keys()].some(key=>key!=='resource') || url.searchParams.getAll('resource').length!==1) return respond({error:'invalid_query'},400);
        if (!['application/json','text/plain'].includes((request.headers.get('content-type')||'').split(';')[0].trim().toLowerCase())) return respond({error:'unsupported_content_type'},415);
        let data; try { data=JSON.parse(await limitedBody(request)); } catch { return respond({error:'invalid_json'},400); }
        if (!exactKeys(data,['version','sessionId','landing','attribution']) || data.version!==1 || !['main','site'].includes(data.landing) || typeof data.sessionId!=='string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.sessionId) || !validateAttribution(data.attribution) || data.attribution.basis==='internal' || data.attribution.source==='internal' || data.attribution.medium==='internal') return respond({error:'invalid_event'},400);
        const result=await rpc('kitsnode_record_main_session',{p_origin:origin,p_event:data});
        if (result?.status==='rate_limited') return respond({error:'rate_limited'},429);
        return result?.status==='ok'?respond({accepted:true},202):respond({error:'invalid_event'},400);
      }
      if (resource === 'collect') {
        if (request.method !== 'POST') return respond({error:'method_not_allowed'},405);
        if (!ingestEnabled) return respond({error:'collection_disabled'},503);
        if ([...url.searchParams.keys()].some(key => key !== 'resource')) return respond({error:'invalid_query'},400);
        if (!['application/json','text/plain'].includes((request.headers.get('content-type') || '').split(';')[0].trim().toLowerCase())) return respond({error:'unsupported_content_type'},415);
        let data;
        try { data = JSON.parse(await limitedBody(request)); } catch (error) { return respond({error:error?.message === 'too_large' ? 'too_large' : 'invalid_json'}, error?.message === 'too_large' ? 413 : 400); }
        if (!validateAnalyticsEvent(data)) return respond({error:'invalid_event'},400);
        const result = await rpc('kitsnode_record_analytics', {p_origin:origin,p_event:data});
        if (result?.status === 'rate_limited') return respond({error:'rate_limited'},429,{'Retry-After':'60'});
        if (['ok','duplicate'].includes(result?.status)) return respond({accepted:true},202);
        if (['invalid_event','expired_view'].includes(result?.status)) return respond({error:'invalid_event'},400);
        return respond({error:'service_unavailable'},503);
      }
      if (request.method !== 'GET') return respond({error:'method_not_allowed'},405);
      if ([...url.searchParams.keys()].some(key => !['resource','days'].includes(key))) return respond({error:'invalid_query'},400);
      const days = url.searchParams.get('days') || '7';
      if (!['1','7','30'].includes(days)) return respond({error:'invalid_days'},400);
      // Bounded origin-level protection before GitHub calls; no token or IP is retained.
      const minute = Math.floor(now() / 60000); const bucket = reportRequests.get(origin);
      const count = bucket?.minute === minute ? bucket.count + 1 : 1;
      reportRequests.set(origin,{minute,count});
      if (count > 30) return respond({error:'rate_limited'},429,{'Retry-After':'60'});
      const token = request.headers.get('x-github-token') || '';
      if (!/^[A-Za-z0-9_]{20,255}$/.test(token)) return respond({error:'authentication_required'},401);
      let repo;
      try {
        const gh = await fetchImpl('https://api.github.com/repos/heetae1120/Kitsnode',{headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${token}`,'User-Agent':'KITSNODE-Analytics'},signal:AbortSignal.timeout(10000),redirect:'error'});
        if (!gh.ok) return respond({error:gh.status === 401 || gh.status === 403 ? 'github_auth_failed' : 'github_unavailable'},gh.status === 401 || gh.status === 403 ? 401 : 503);
        repo = await gh.json();
      } catch { return respond({error:'github_unavailable'},503); }
      if (repo?.permissions?.push !== true) return respond({error:'github_write_required'},403);
      const report = await rpc('kitsnode_analytics_report',{p_days:Number(days)});
      // SQL returns aggregates only. Never fall back to raw table reads.
      if (!object(report) || !Array.isArray(report.pages) || !object(report.survey)) throw new Error('invalid_report');
      report.sessions = await rpc('kitsnode_main_session_report',{p_days:Number(days)});
      return respond(report);
    } catch { return respond({error:'service_unavailable'},503); }
  };
}

