import test from 'node:test';
import assert from 'node:assert/strict';
import {validMemberReturn} from '../src/lib/member-return';

test('return target stays within the deployed site and excludes auth pages',()=>{
  for (const path of ['/Kitsnode/','/Kitsnode/tools/start/','/Kitsnode/store/ads/']) assert.equal(validMemberReturn(path,'/Kitsnode'),true,path);
  for (const path of ['//evil.test','/Kitsnode/\\evil.test','/elsewhere','/Kitsnode/store/login/','/Kitsnode/store/signup/','/Kitsnode/%2e%2e/escape','/Kitsnode/tools/?token=x','/Kitsnode/tools/#x']) assert.equal(validMemberReturn(path,'/Kitsnode'),false,path);
});

test('return target is consumed only once and expires', async()=>{
  const {takeMemberReturn}=await import('../src/lib/member-return');
  const values = new Map<string,string>();
  const fake={getItem:(key:string)=>values.get(key)??null,removeItem:(key:string)=>values.delete(key)};
  Object.defineProperty(globalThis,'sessionStorage',{value:fake,configurable:true});
  try {
    values.set('kitsnode-login-return-v1',JSON.stringify({path:'/tools/start/',at:Date.now()}));
    assert.equal(takeMemberReturn(),'/tools/start/');
    assert.equal(takeMemberReturn(),null);
    values.set('kitsnode-login-return-v1',JSON.stringify({path:'/tools/start/',at:Date.now()-31*60*1000}));
    assert.equal(takeMemberReturn(),null);
  } finally { delete (globalThis as {sessionStorage?:unknown}).sessionStorage; }
});
