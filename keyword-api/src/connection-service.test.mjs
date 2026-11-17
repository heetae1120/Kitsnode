import test from 'node:test';
import assert from 'node:assert/strict';
import {createConnectionService} from './connection-service.mjs';
function setup() {
 const rows=new Map(); let evidenceOk=true, race=false, resolveCalled=0;
 const store={
  async createPending(r){if([...rows.values()].some(x=>x.adAccountId===r.adAccountId&&x.status!=='disconnected'))return false; rows.set(r.requestId,{...r,status:'pending_review',revision:0});return true;},
  async getOwned({requestId,userId}){const r=rows.get(requestId);return r?.userId===userId?r:null;},
  async getForReview({requestId}){const r=rows.get(requestId);return r?{...r}:null;},
  async approvePending(a){const r=rows.get(a.requestId);if(race||!r||r.status!=='pending_review'||r.revision!==a.expectedRevision||r.userId!==a.userId||r.adAccountId!==a.adAccountId)return false;Object.assign(r,{status:'read_connected',customerId:a.customerId,revision:r.revision+1});return true;},
  async disconnectOwned({requestId,userId}){const r=rows.get(requestId);if(!r||r.userId!==userId)return false;r.status='disconnected';r.revision++;return true;},
 };
 const service=createConnectionService({verifySession:async t=>t==='alice'?{id:'alice'}:t==='operator'?{id:'operator'}:t==='bob'?{id:'bob'}:null,verifyOperator:async id=>id==='operator',verifyOwnershipEvidence:async()=>evidenceOk,resolveAccount:async adAccountId=>{resolveCalled++;return {ok:true,adAccountId,customerId:'4563552',role:'MASTER'};},store,createId:()=> 'request-1'});
 return {service,rows,setEvidence(v){evidenceOk=v;},setRace(v){race=v;},getResolveCalled(){return resolveCalled;}};
}
test('pending account claim requires independently verified operator and ownership',async()=>{
 const t=setup();assert.deepEqual(await t.service.request('alice','2647636'),{ok:true,requestId:'request-1',status:'pending_review'});
 assert.equal((await t.service.approve('alice','request-1','proof')).code,'forbidden');
 t.setEvidence(false);assert.equal((await t.service.approve('operator','request-1','proof')).code,'ownership_unverified');assert.equal(t.getResolveCalled(),0);
 t.setEvidence(true);assert.equal((await t.service.approve('operator','request-1','proof')).status,'read_connected');
 assert.deepEqual(await t.service.get('alice','request-1'),{ok:true,requestId:'request-1',adAccountId:'2647636',status:'read_connected'});
 assert.equal((await t.service.get('bob','request-1')).code,'not_found');
});
test('unauthenticated and cross-user request paths fail closed',async()=>{
 const t=setup();assert.equal((await t.service.request(null,'2647636')).code,'unauthenticated');assert.equal((await t.service.request('alice','0')).code,'invalid_input');
 await t.service.request('alice','2647636');assert.equal((await t.service.disconnect('bob','request-1')).code,'not_found');
 assert.equal((await t.service.disconnect('alice','request-1')).status,'disconnected');
 assert.equal((await t.service.approve('operator','request-1','proof')).code,'not_found');
});
test('atomic approval conflict cannot create a connection after a race',async()=>{
 const t=setup();await t.service.request('alice','2647636');t.setRace(true);assert.equal((await t.service.approve('operator','request-1','proof')).code,'conflict');assert.equal(t.rows.get('request-1').status,'pending_review');
});
