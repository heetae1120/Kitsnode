const allowedPages = new Set(['/tools/','/tools/start/','/tools/rankings/','/tools/seo/','/tools/traffic/','/tools/bidding/','/tools/negative-search/','/tools/keywords/','/tools/survey/','/tools/about/','/tools/market/','/tools/consultation/']);
const fields = new Set(['text','color','backgroundColor','fontSize','padding','width','left','top','order','hidden']);
const isObject = x => !!x && typeof x === 'object' && !Array.isArray(x);
export function validateLayout(value) {
  if (!isObject(value) || Object.keys(value).length > allowedPages.size) return false;
  return Object.entries(value).every(([page, entries]) => allowedPages.has(page) && isObject(entries) && Object.keys(entries).length <= 1000 && Object.entries(entries).every(([selector, patch]) => /^body(?::has\(.+\))* > /.test(selector) && selector.length <= 2000 && isObject(patch) && Object.entries(patch).every(([key, val]) => fields.has(key) && (key === 'hidden' ? typeof val === 'boolean' : typeof val === 'string' && val.length <= 4000))));
}
const authorizedOrigins = new Set(['https://kitsnode-studio-owner.junho960809.chatgpt.site']);
export function createHandler({ projectUrl, serviceKey, fetchImpl = fetch }) {
  const restHeaders = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json', 'Accept-Profile': 'public', 'Content-Profile': 'public' };
  const rest = async (path, options={}) => {
    const response = await fetchImpl(`${projectUrl}/rest/v1/${path}`, { ...options, headers: { ...restHeaders, ...(options.headers || {}) }, signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('storage_unavailable');
    return response.json();
  };
  return async request => {
    const origin = request.headers.get('origin') || '';
    const cors = { 'Access-Control-Allow-Origin': authorizedOrigins.has(origin) ? origin : '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'content-type, x-github-token', 'Cache-Control': 'no-store', 'Vary': 'Origin' };
    const response = (value, status=200) => new Response(JSON.stringify(value), { status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' } });
    if (request.method === 'OPTIONS') return new Response(null, {status:204,headers:cors});
    const url = new URL(request.url); const resource = url.searchParams.get('resource') || 'published';
    try {
      if (request.method === 'GET' && resource === 'published') {
        const rows = await rest('kitsnode_layout_state?singleton=eq.true&select=published,published_revision,updated_at&limit=1');
        if (!rows[0] || !validateLayout(rows[0].published)) return response({error:'unavailable'},503);
        return response({changes:rows[0].published, revision:rows[0].published_revision, updatedAt:rows[0].updated_at});
      }
      if (!authorizedOrigins.has(origin)) return response({error:'origin_not_allowed'},403);
      const token = request.headers.get('x-github-token') || '';
      if (!/^[A-Za-z0-9_]{20,255}$/.test(token)) return response({error:'authentication_required'},401);
      let repo;
      try {
        const gh = await fetchImpl('https://api.github.com/repos/heetae1120/Kitsnode', {headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${token}`,'User-Agent':'KITSNODE-Studio'},signal:AbortSignal.timeout(10000)});
        if (!gh.ok) return response({error:'github_auth_failed'},401);
        repo=await gh.json();
      } catch { return response({error:'github_unavailable'},503); }
      if (repo?.permissions?.push !== true) return response({error:'github_write_required'},403);
      if (request.method === 'GET' && resource === 'draft') {
        const rows=await rest('kitsnode_layout_state?singleton=eq.true&select=draft,draft_revision,draft_base_revision,published_revision&limit=1');
        if(!rows[0] || !validateLayout(rows[0].draft))return response({error:'unavailable'},503);
        return response({changes:rows[0].draft,draftRevision:rows[0].draft_revision,baseRevision:rows[0].draft_base_revision,publishedRevision:rows[0].published_revision});
      }
      if (request.method === 'GET' && resource === 'versions') return response({versions:await rest('kitsnode_layout_versions?select=revision,actor,created_at&order=revision.desc&limit=50')});
      if (request.method === 'GET' && resource === 'version') {
        const revision=url.searchParams.get('revision');if(!/^\d{1,15}$/.test(revision||''))return response({error:'invalid_revision'},400);
        const rows=await rest(`kitsnode_layout_versions?revision=eq.${revision}&select=revision,content,actor,created_at&limit=1`);return rows[0]?response(rows[0]):response({error:'not_found'},404);
      }
      if (request.method !== 'POST' || !['save','publish'].includes(resource)) return response({error:'not_found'},404);
      const raw=await request.text();if(raw.length>500000)return response({error:'too_large'},413);
      let data;try{data=JSON.parse(raw);}catch{return response({error:'invalid_json'},400);}
      if(!isObject(data)||!Number.isSafeInteger(data.draftRevision)||data.draftRevision<0||!Number.isSafeInteger(data.publishedRevision)||data.publishedRevision<0)return response({error:'invalid_revision'},400);
      let result;
      if(resource==='save'){
        if(!validateLayout(data.changes))return response({error:'invalid_layout'},400);
        result=await rest('rpc/kitsnode_save_draft',{method:'POST',body:JSON.stringify({p_expected_draft:data.draftRevision,p_expected_published:data.publishedRevision,p_content:data.changes})});
      } else {
        // Obtain the authenticated account independently; never trust a client-supplied actor.
        const userResponse=await fetchImpl('https://api.github.com/user',{headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${token}`,'User-Agent':'KITSNODE-Studio'},signal:AbortSignal.timeout(10000)});
        if(!userResponse.ok)return response({error:'github_auth_failed'},401);
        const user=await userResponse.json();if(typeof user.login!=='string'||!/^[-A-Za-z0-9]{1,39}$/.test(user.login))return response({error:'github_auth_failed'},401);
        result=await rest('rpc/kitsnode_publish_draft',{method:'POST',body:JSON.stringify({p_expected_draft:data.draftRevision,p_expected_published:data.publishedRevision,p_actor:user.login})});
      }
      return result?.status==='ok'?response(result):response(result,result?.status==='conflict'?409:503);
    } catch { return response({error:'service_unavailable'},503); }
  };
}
