import test from 'node:test';
import assert from 'node:assert/strict';
import {createConnectionService} from '../../supabase/functions/kitsnode-ad-api/src/connection-service.mjs';
import {createAutoConnectCandidate} from '../../supabase/functions/kitsnode-ad-api/src/auto-connect-candidate.mjs';

test('isolated connection request stays pending until simulated Naver acceptance, then transitions',async()=>{
 const sessions=new Map([['token',{id:'member'}]]);const rows=new Map();let accepted=false;
 const store={
  async createPending({requestId,userId,adAccountId}){rows.set(requestId,{requestId,userId,adAccountId,status:'pending_review',revision:0});return true},
  async getOwned({requestId,userId}){const r=rows.get(requestId);return r?.userId===userId?{...r}:null},
  async getForReview(){return null},async approvePending(){return false},async disconnectOwned(){return false},
  async approveVerified(a){const r=rows.get(a.requestId);if(!r||r.userId!==a.userId||r.adAccountId!==a.adAccountId||r.revision!==a.expectedRevision||r.status!=='pending_review')return false;r.status='read_connected';r.revision++;return true}
 };
 const verifySession=async token=>sessions.get(token)||null;
 const resolveAccount=async id=>accepted?{ok:true,adAccountId:id,customerId:'12345',role:'READ_ONLY'}:{ok:false,code:'not_accessible'};
 const service=createConnectionService({verifySession,verifyOperator:async()=>false,verifyOwnershipEvidence:async()=>false,resolveAccount,store,createId:()=> 'request'});
 const check=createAutoConnectCandidate({verifySession,resolveAccount,store});
 assert.equal((await service.request('token','1234567')).status,'pending_review');
 assert.equal((await check('token','request')).code,'naver_access_unverified');
 assert.equal((await service.get('token','request')).status,'pending_review');
 accepted=true;
 assert.equal((await check('token','request')).status,'read_connected');
 assert.equal((await service.get('token','request')).status,'read_connected');
});
