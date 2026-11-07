import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHandler, validateLayout } from '../supabase/functions/kitsnode-layout/handler.mjs';
const origin = 'https://kitsnode-studio-owner.junho960809.chatgpt.site';
const token = 'ghp_abcdefghijklmnopqrstuvwxyz1234567890';
const sample = {'/tools/': {'body > div:nth-of-type(1)': {text:'수정된 문구',color:'#112233'}}};
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
