import test from 'node:test';
import assert from 'node:assert/strict';
import {deleteCurrentMember} from '../src/lib/member-self-deletion';
const url='https://abcdefghijklmnopqrst.supabase.co';
const key='public-key';
const userId='test-user';
const getSession=async()=>({data:{session:{access_token:'fixture-token',user:{id:userId}}},error:null});

test('checks capability then sends the confirmed authenticated request',async()=>{
  const calls:{method:string;body:unknown;authorization:string|null}[]=[];
  const request:typeof fetch=async (_input,init)=>{
    calls.push({method:String(init?.method),body:init?.body,authorization:new Headers(init?.headers).get('Authorization')});
    return Response.json(init?.method==='GET'?{available:true}:{deleted:true});
  };
  assert.equal(await deleteCurrentMember({url,key,userId,getSession,request}),'deleted');
  assert.deepEqual(calls.map(c=>c.method),['GET','POST']);
  assert.equal(calls[1].body,JSON.stringify({confirm:'회원탈퇴'}));
  assert.equal(calls[1].authorization,'Bearer fixture-token');
});

test('disabled capability and account change prevent deletion',async()=>{
  let calls=0;
  const unavailable:typeof fetch=async()=>{calls++;return Response.json({available:false});};
  assert.equal(await deleteCurrentMember({url,key,userId,getSession,request:unavailable}),'blocked');
  assert.equal(calls,1);
  let sessions=0;
  const changed=async()=>({data:{session:{access_token:'fixture-token',user:{id:++sessions===1?userId:'other'}}},error:null});
  const available:typeof fetch=async()=>{calls++;return Response.json({available:true});};
  assert.equal(await deleteCurrentMember({url,key,userId,getSession:changed,request:available}),'blocked');
  assert.equal(calls,2);
});

test('uncertain POST failure never retries or claims success',async()=>{
  let calls=0;
  const request:typeof fetch=async()=>{calls++;if(calls===1)return Response.json({available:true});throw Error('network');};
  assert.equal(await deleteCurrentMember({url,key,userId,getSession,request}),'uncertain');
  assert.equal(calls,2);
});

test('only an explicit deletion_blocked response confirms a preflight block',async()=>{
  for (const [body,expected] of [[{error:'deletion_blocked'},'needs_review'],[{error:'other'},'uncertain']] as const) {
    let calls=0;
    const request:typeof fetch=async()=>++calls===1?Response.json({available:true}):Response.json(body,{status:409});
    assert.equal(await deleteCurrentMember({url,key,userId,getSession,request}),expected);
    assert.equal(calls,2);
  }
});
