import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHandler, validateLayout } from '../supabase/functions/kitsnode-layout/handler.mjs';
const origin = 'https://kitsnode-studio-owner.junho960809.chatgpt.site';
const token = 'ghp_abcdefghijklmnopqrstuvwxyz1234567890';
const sample = {'/tools/': {'body > div:nth-of-type(1)': {text:'수정된 문구',color:'#112233'}}};

test('auth page patches only allow designated presentation targets and fields', () => {
  const heading = 'body [data-auth-edit="heading"]';
  const description = 'body [data-auth-edit="description"]';
  for (const page of ['/store/login/', '/store/signup/']) {
    assert.equal(validateLayout({ [page]: { [heading]: { text: '안내', color: '#333', backgroundColor: '#fff', fontSize: '16px', padding: '8px' }, [description]: { text: '설명' } } }), true);
    for (const patch of [{ hidden: true }, { width: '100%' }, { text: 'x'.repeat(4001) }, { text: false }]) {
      assert.equal(validateLayout({ [page]: { [heading]: patch } }), false);
    }
    for (const selector of ['body > form', 'body [data-auth-edit="password"]', `${heading}, input`]) {
      assert.equal(validateLayout({ [page]: { [selector]: { text: 'x' } } }), false);
    }
    for (const target of ['email-input', 'password-input', 'submit-button', 'naver-button']) {
      const selector = `body [data-auth-edit="${target}"]`;
      assert.equal(validateLayout({ [page]: { [selector]: { color: '#123456', backgroundColor: '#ffffff', fontSize: '16px', padding: '8px' } } }), true);
      for (const patch of [{ text: '변경' }, { hidden: true }, { width: '100%' }, { left: '1px' }, { order: '1' }, { color: 'x'.repeat(4001) }]) {
        assert.equal(validateLayout({ [page]: { [selector]: patch } }), false, `${target}: ${JSON.stringify(patch)}`);
      }
    }
  }
  assert.equal(validateLayout({ '/store/': { [heading]: { text: 'x' } } }), false);
});
function fakeFetch(push = true) {
  return async (input: string | URL | Request, options?: RequestInit) => {
    const url = String(input);
    if (url === 'https://api.github.com/repos/heetae1120/Kitsnode') return Response.json({permissions:{push}});
    if (url === 'https://api.github.com/user') return Response.json({login:'reviewer'});
    if (url.includes('kitsnode_layout_state?')) return Response.json([{published:sample,published_revision:3,updated_at:'today',draft:sample,draft_revision:4,draft_base_revision:3}]);
    if (url.endsWith('/rpc/kitsnode_save_draft')) {
      const body = JSON.parse(String(options?.body));
      return Response.json(body.p_expected_draft === 4 ? {status:'ok',draftRevision:5,publishedRevision:3} : {status:'conflict',draftRevision:4,publishedRevision:3});
    }
    if (url.endsWith('/rpc/kitsnode_publish_draft')) return Response.json({status:'ok',draftRevision:5,publishedRevision:4});
    throw new Error(`unexpected ${url}`);
  };
}
const create = (push = true) => createHandler({projectUrl:'https://example.supabase.co',serviceKey:'server-secret',fetchImpl:fakeFetch(push)});
const request = (resource:string, options:RequestInit={}) => new Request(`https://service.test/kitsnode-layout?resource=${resource}`, options);
const headers = {origin, 'x-github-token':token,'content-type':'application/json'};

test('public read exposes approved layout only; draft requires authenticated origin', async () => {
  const h=create(); const result=await (await h(request('published'))).json();
  assert.deepEqual(result.changes,sample); assert.equal('draft' in result,false);
  assert.equal((await h(request('draft'))).status,403);
  assert.equal((await h(request('draft',{headers:{origin}}))).status,401);
  assert.equal((await create(false)(request('draft',{headers}))).status,403);
  assert.equal((await h(request('draft',{headers}))).status,200);
});
test('validates layouts and returns conflict on stale draft', async () => {
  const h=create(); assert.equal(validateLayout(sample),true);
  assert.equal(validateLayout({'/admin/':{}}),false);
  assert.equal(validateLayout({'/tools/':{'body > div':{unknown:'bad'}}}),false);
  const save=(revision:number) => request('save',{method:'POST',headers,body:JSON.stringify({draftRevision:revision,publishedRevision:3,changes:sample})});
  assert.equal((await h(save(3))).status,409);
  assert.equal((await h(save(4))).status,200);
  const invalid=request('save',{method:'POST',headers,body:JSON.stringify({draftRevision:4,publishedRevision:3,changes:{'/tools/':{'body > div':{hidden:'yes'}}}})});
  assert.equal((await h(invalid)).status,400);
});
test('publish verifies GitHub permission and does not reveal token', async () => {
  const h=create();const res=await h(request('publish',{method:'POST',headers,body:JSON.stringify({draftRevision:4,publishedRevision:3})}));
  assert.equal(res.status,200); const body=await res.text(); assert.equal(body.includes(token),false); assert.equal(JSON.parse(body).publishedRevision,4);
});

const commonSample = {
  '/tools/': {
    'body .tool-topbar': { backgroundColor: '#112233' },
    'body .tool-topbar > nav:nth-of-type(1) > a:nth-of-type(2) > span:nth-of-type(1)': { text: '메뉴 예시' },
    'body .mp-live-bar': { padding: '12px' },
    'body .mp-live-bar > div:nth-of-type(1) > span:nth-of-type(2)': { text: '요약 예시' },
  },
  '/tools/about/': { 'body .tool-topbar > nav:nth-of-type(1)': { hidden: false } },
};

test('accepts common editor roots and generated descendant paths alongside legacy selectors', () => {
  assert.equal(validateLayout(commonSample), true);
  assert.equal(validateLayout({ '/tools/': {
    ...commonSample['/tools/'],
    'body:has(#mp-available) > div:nth-of-type(1) > main:nth-of-type(1)': { text: '기존 단계' },
  } }), true);
});

test('common selectors cannot escape the two roots or add unsupported selector syntax', () => {
  const rejected = [
    'body .other', 'body .tool-topbar-other', 'body .mp-live-bar-other',
    'body .tool-topbar, body > main', 'body .tool-topbar > a:nth-of-type(1), body',
    'body .tool-topbar + main:nth-of-type(1)', 'body .mp-live-bar ~ main:nth-of-type(1)',
    'body .tool-topbar span:nth-of-type(1)', 'body .tool-topbar > *',
    'body .tool-topbar:has(main)', 'body .tool-topbar > a:nth-of-type(1):has(span)',
    'body .tool-topbar > a[href]', 'body .tool-topbar > a:nth-of-type(0)',
    'body .tool-topbar > a:nth-of-type(-1)', 'body .tool-topbar > a:nth-of-type(01)',
    'body .tool-topbar > a:nth-of-type(2n)', 'body .tool-topbar > a:nth-of-type(1) > ',
    'body .tool-topbar\n', 'body .mp-live-bar\r', 'body .tool-topbar\u2028',
  ];
  for (const selector of rejected) {
    assert.equal(validateLayout({ '/tools/': { [selector]: { text: 'blocked' } } }), false, selector);
  }
});

test('common layout support preserves page, field, value and count limits', () => {
  const root = 'body .tool-topbar';
  const layout = (patch: unknown) => ({ '/tools/': { [root]: patch } });
  assert.equal(validateLayout({ '/admin/': commonSample['/tools/'] }), false);
  assert.equal(validateLayout(layout({ unknown: 'blocked' })), false);
  assert.equal(validateLayout(layout({ hidden: 'true' })), false);
  assert.equal(validateLayout(layout({ text: 'x'.repeat(4001) })), false);
  assert.equal(validateLayout(layout({ text: 'x'.repeat(4000), hidden: true })), true);
  const selector = `${root}${' > div:nth-of-type(1)'.repeat(105)}`;
  assert.ok(selector.length > 2000);
  assert.equal(validateLayout({ '/tools/': { [selector]: { text: 'blocked' } } }), false);
  const entries = Object.fromEntries(Array.from({ length: 1001 }, (_, index) => [`${root} > a:nth-of-type(${index + 1})`, { text: 'example' }]));
  assert.equal(validateLayout({ '/tools/': entries }), false);
  delete entries[`${root} > a:nth-of-type(1001)`];
  assert.equal(validateLayout({ '/tools/': entries }), true);
});

test('public and authorized draft reads accept stored common layouts', async () => {
  const baseFetch = fakeFetch();
  const h = createHandler({ projectUrl: 'https://example.supabase.co', serviceKey: 'server-secret', fetchImpl: async (input: string | URL | Request, options?: RequestInit) => {
    if (String(input).includes('kitsnode_layout_state?')) return Response.json([{ published: commonSample, published_revision: 3, updated_at: 'today', draft: commonSample, draft_revision: 4, draft_base_revision: 3 }]);
    return baseFetch(input, options);
  } });
  const published = await h(request('published'));
  assert.equal(published.status, 200);
  const publishedBody = await published.json();
  assert.deepEqual(publishedBody.changes, commonSample);
  assert.equal('draft' in publishedBody, false);
  const draft = await h(request('draft', { headers }));
  assert.equal(draft.status, 200);
  assert.deepEqual((await draft.json()).changes, commonSample);
});

test('common layout saves retain revision conflicts and do not publish implicitly', async () => {
  const calls: string[] = [];
  const baseFetch = fakeFetch();
  const h = createHandler({ projectUrl: 'https://example.supabase.co', serviceKey: 'server-secret', fetchImpl: async (input: string | URL | Request, options?: RequestInit) => {
    const url = String(input); calls.push(url);
    if (url.endsWith('/rpc/kitsnode_save_draft')) assert.deepEqual(JSON.parse(String(options?.body)).p_content, commonSample);
    return baseFetch(input, options);
  } });
  const save = (draftRevision: number) => request('save', { method: 'POST', headers, body: JSON.stringify({ draftRevision, publishedRevision: 3, changes: commonSample }) });
  assert.equal((await h(save(3))).status, 409);
  assert.equal((await h(save(4))).status, 200);
  assert.equal(calls.some(url => url.includes('kitsnode_publish_draft')), false);
});

test('common layout saves still require the authorized origin, token and repository write permission', async () => {
  const body = JSON.stringify({ draftRevision: 4, publishedRevision: 3, changes: commonSample });
  const calls: string[] = [];
  const h = createHandler({ projectUrl: 'https://example.supabase.co', serviceKey: 'server-secret', fetchImpl: async (input: string | URL | Request) => {
    calls.push(String(input)); return Response.json({ permissions: { push: false } });
  } });
  assert.equal((await h(request('save', { method: 'POST', headers: { ...headers, origin: 'https://untrusted.example' }, body }))).status, 403);
  assert.equal((await h(request('save', { method: 'POST', headers: { origin }, body }))).status, 401);
  assert.equal(calls.length, 0);
  assert.equal((await h(request('save', { method: 'POST', headers, body }))).status, 403);
  assert.deepEqual(calls, ['https://api.github.com/repos/heetae1120/Kitsnode']);
});
