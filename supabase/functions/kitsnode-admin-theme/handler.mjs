import { validateTheme, contrastIssues } from './theme-schema.mjs';
const authorizedOrigin = 'https://kitsnode-studio-owner.junho960809.chatgpt.site';
const revision = value => Number.isSafeInteger(value) && value >= 0;
const snapshot = value => !!value && validateTheme(value.theme) && revision(value.revision) && (value.updatedAt === null || (typeof value.updatedAt === 'string' && Number.isFinite(Date.parse(value.updatedAt))));
export function createHandler({projectUrl, serviceKey, fetchImpl = fetch}) {
  const rest = async (path, options = {}) => {
    const result = await fetchImpl(`${projectUrl}/rest/v1/${path}`, {...options, redirect:'error', headers:{apikey:serviceKey,Authorization:`Bearer ${serviceKey}`,'Content-Type':'application/json','Accept-Profile':'public','Content-Profile':'public'},signal:AbortSignal.timeout(10000)});
    if (!result.ok) throw new Error('storage_unavailable');
    return result.json();
  };
  return async request => {
    const origin = request.headers.get('origin') || '';
    const publicRead = request.method === 'GET' && !new URL(request.url).search;
    const cors = {'Cache-Control':'no-store','Vary':'Origin','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'content-type, x-github-token',...(origin === authorizedOrigin ? {'Access-Control-Allow-Origin':origin} : publicRead ? {'Access-Control-Allow-Origin':'*'} : {})};
    const respond = (body,status=200) => Response.json(body,{status,headers:cors});
    if (request.method === 'OPTIONS') return origin === authorizedOrigin ? new Response(null,{status:204,headers:cors}) : respond({error:'origin_not_allowed'},403);
    try {
      if (publicRead) {
        const rows = await rest('kitsnode_admin_theme_state?singleton=eq.true&select=theme,revision,updated_at&limit=1');
        const value = rows?.[0] && {theme:rows[0].theme,revision:rows[0].revision,updatedAt:rows[0].updated_at};
        return snapshot(value) ? respond(value) : respond({error:'unavailable'},503);
      }
      if (origin !== authorizedOrigin) return respond({error:'origin_not_allowed'},403);
      if (request.method !== 'POST' || new URL(request.url).search) return respond({error:'not_found'},404);
      const token = request.headers.get('x-github-token') || '';
      if (!/^[A-Za-z0-9_]{20,255}$/.test(token)) return respond({error:'authentication_required'},401);
      const ghHeaders = {Accept:'application/vnd.github+json',Authorization:`Bearer ${token}`,'User-Agent':'KITSNODE-Studio'};
      const repoResponse = await fetchImpl('https://api.github.com/repos/heetae1120/Kitsnode',{headers:ghHeaders,redirect:'error',signal:AbortSignal.timeout(10000)});
      if (!repoResponse.ok) return respond({error:'github_auth_failed'},401);
      if ((await repoResponse.json())?.permissions?.push !== true) return respond({error:'github_write_required'},403);
      const raw = await request.text();
      if (raw.length > 16384) return respond({error:'too_large'},413);
      let body; try { body = JSON.parse(raw); } catch { return respond({error:'invalid_json'},400); }
      if (!body || Array.isArray(body) || Object.keys(body).length !== 2 || !revision(body.expectedRevision) || !validateTheme(body.theme)) return respond({error:'invalid_theme'},400);
      const issues = contrastIssues(body.theme);
      if (issues.length) return respond({error:'invalid_contrast',issues},422);
      const actorResponse = await fetchImpl('https://api.github.com/user',{headers:ghHeaders,redirect:'error',signal:AbortSignal.timeout(10000)});
      if (!actorResponse.ok) return respond({error:'github_auth_failed'},401);
      const actor = (await actorResponse.json())?.login;
      if (typeof actor !== 'string' || !/^[-A-Za-z0-9]{1,39}$/.test(actor)) return respond({error:'github_auth_failed'},401);
      const result = await rest('rpc/kitsnode_save_admin_theme',{method:'POST',body:JSON.stringify({p_expected_revision:body.expectedRevision,p_theme:body.theme,p_actor:actor})});
      if (result?.status === 'conflict' && revision(result.revision)) return respond({error:'conflict',revision:result.revision},409);
      if (result?.status !== 'ok' || !snapshot(result)) return respond({error:'unavailable'},503);
      return respond({status:'ok',theme:result.theme,revision:result.revision,updatedAt:result.updatedAt});
    } catch { return respond({error:'service_unavailable'},503); }
  };
}
