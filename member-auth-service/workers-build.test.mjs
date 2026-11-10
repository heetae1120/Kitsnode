import test from 'node:test';
import assert from 'node:assert/strict';
import {workersBuildEnvironment} from './workers-build.mjs';

test('Workers build uses one exact public origin and root base path',()=>{
  const origin='https://site.account.workers.dev';
  const value=workersBuildEnvironment({WORKERS_FRONTEND_ORIGIN:origin});
  assert.equal(value.NEXT_PUBLIC_MEMBER_AUTH_URL,origin);assert.equal(value.PAGES_BASE_PATH,'');
  for(const bad of [undefined,'http://site.account.workers.dev','https://site.account.workers.dev/path','https://site.account.workers.dev/','https://site.account.workers.dev.evil.test']) assert.throws(()=>workersBuildEnvironment({WORKERS_FRONTEND_ORIGIN:bad}));
  assert.throws(()=>workersBuildEnvironment({WORKERS_FRONTEND_ORIGIN:origin,PAGES_BASE_PATH:'/Kitsnode'}));
  assert.throws(()=>workersBuildEnvironment({WORKERS_FRONTEND_ORIGIN:origin,NEXT_PUBLIC_MEMBER_AUTH_URL:'https://other.account.workers.dev'}));
});
