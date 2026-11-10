import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { getMigrations } from 'better-auth/db/migration';
import { createDevNaverAuth } from './auth.mjs';

test('provider tokens are not stored on account create or update and token routes are disabled', async () => {
  const db = new DatabaseSync(':memory:');
  const args = {database:db,baseURL:'http://127.0.0.1:4313',secret:'fixture-secret-only-0123456789abcdef',trustedOrigins:['http://127.0.0.1:4312'],sendMail:async()=>{},naver:{clientId:'fixture-client',clientSecret:'fixture-secret'},fetchImpl:async()=>{throw new Error('unexpected network')}};
  try {
    const {auth} = createDevNaverAuth(args);
    const ctx = await auth.$context;
    await (await getMigrations(ctx.options)).runMigrations();
    const user = await ctx.internalAdapter.createUser({email:'token-policy@example.test',name:'Fixture',emailVerified:true});
    const account = await ctx.internalAdapter.createAccount({userId:user.id, providerId:'naver', accountId:'fixture-provider-id', accessToken:'fixture-access', refreshToken:'fixture-refresh',idToken:'fixture-id-token'});
    let [stored] = await ctx.internalAdapter.findAccounts(user.id);
    for (const field of ['accessToken','refreshToken','idToken']) assert.ok(stored[field] == null, `${field} must not be stored`);
    await ctx.internalAdapter.updateAccount(account.id,{accessToken:'new-access',refreshToken:'new-refresh',idToken:'new-id-token'});
    [stored] = await ctx.internalAdapter.findAccounts(user.id);
    for (const field of ['accessToken','refreshToken','idToken']) assert.ok(stored[field] == null, `${field} must remain absent after update`);
    for (const path of ['/get-access-token','/refresh-token','/account-info']) {
      assert.ok(ctx.options.disabledPaths.includes(path));
      const response = await auth.handler(new Request(`http://127.0.0.1:4313/api/auth${path}`, {method:'POST',headers:{'content-type':'application/json',origin:'http://127.0.0.1:4312'},body:'{}'}));
      assert.equal(response.status,404);
    }
  } finally { db.close(); }
});

test('development factory refuses external and production configurations', () => {
  const args = {database:{},baseURL:'https://example.test',secret:'fixture-secret-only-0123456789abcdef',trustedOrigins:['https://example.test'],sendMail:async()=>{},naver:{clientId:'x',clientSecret:'y'}};
  assert.throws(()=>createDevNaverAuth(args),/loopback/);
  const previous = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';
    assert.throws(()=>createDevNaverAuth({...args,baseURL:'http://127.0.0.1:4313',trustedOrigins:['http://127.0.0.1:4312']}),/loopback/);
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous;
  }
});
