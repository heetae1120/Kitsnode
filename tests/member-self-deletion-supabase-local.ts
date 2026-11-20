// Run only against the disposable local Supabase fixture, never a remote project.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';
import {deleteCurrentMember} from '../src/lib/member-self-deletion';

async function main(){
const statusPath=process.env.KITS_LOCAL_STATUS_FILE;
if (!statusPath?.startsWith('/tmp/kits-supabase-delete.')) throw Error('local fixture status required');
const env=Object.fromEntries((await readFile(statusPath,'utf8')).split('\n').filter(line=>line.includes('=')).map(line=>{const i=line.indexOf('=');return [line.slice(0,i),line.slice(i+1).replace(/^"|"$/g,'')];}));
if (env.API_URL!=='http://127.0.0.1:54321' || env.DB_URL!=='postgresql://postgres:postgres@127.0.0.1:54322/postgres') throw Error('remote fixture forbidden');
const opts={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const admin=createClient(env.API_URL,env.SERVICE_ROLE_KEY,opts);
const client=createClient(env.API_URL,env.ANON_KEY,opts);
const email=`transport-${Date.now()}@example.test`,password='Fixture-pass-9724!';
const created=await admin.auth.admin.createUser({email,password,email_confirm:true});
if (created.error || !created.data.user) throw Error('fixture user creation failed');
try {
  const signed=await client.auth.signInWithPassword({email,password});
  if (signed.error || !signed.data.session) throw Error('fixture sign in failed');
  const methods:string[]=[];
  const localRequest:typeof fetch=async (input,init)=>{
    const requested=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
    assert.equal(requested.origin,'https://abcdefghijklmnopqrst.supabase.co');
    assert.equal(requested.pathname,'/functions/v1/kitsnode-member-delete');
    methods.push(String(init?.method));
    const headers=new Headers(init?.headers);headers.set('origin','https://heetae1120.github.io');
    return fetch(`${env.API_URL}${requested.pathname}`,{...init,headers});
  };
  const result=await deleteCurrentMember({url:'https://abcdefghijklmnopqrst.supabase.co',key:env.ANON_KEY,userId:created.data.user.id,getSession:()=>client.auth.getSession(),request:localRequest});
  assert.equal(result,'deleted');
  assert.deepEqual(methods,['GET','POST']);
  assert.ok((await admin.auth.admin.getUserById(created.data.user.id)).error);
  console.log('Local Supabase session → frontend transport → Edge deletion verified.');
} finally {
  await admin.auth.admin.deleteUser(created.data.user.id);
  await client.auth.signOut();
}

}
void main().catch(()=>{console.error('Local fixture verification failed.');process.exitCode=1;});
