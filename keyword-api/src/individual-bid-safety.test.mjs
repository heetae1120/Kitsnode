import test from 'node:test';
import assert from 'node:assert/strict';
import {assessIndividualBidSafety,classifyIndividualBidWriteOutcome} from './individual-bid-safety.mjs';
const snapshot=()=>({group:{id:'grp-1',status:'ELIGIBLE',bid:70},target:{id:'nad-1',status:'ELIGIBLE',useGroupBid:true,bid:null}});
const input=()=>({kind:'product',targetId:'nad-1',groupId:'grp-1',first:snapshot(),second:snapshot(),startedAt:1000,finishedAt:2000,desiredBid:80});
test('stable product conversion remains blocked without conditional write or write permission',()=>{
 const x=assessIndividualBidSafety(input());assert.equal(x.execution,'disabled');assert.equal(x.currentBid,70);assert.equal(x.conversionRequired,true);assert.ok(x.blockers.includes('atomic_update_unavailable'));assert.ok(x.blockers.includes('individual_bid_conversion_required'));assert.ok(x.blockers.includes('write_permission_unverified'));
});
test('detects concurrent changes to group, mode, amount and status for product and keyword',()=>{
 for(const change of [s=>s.group.bid=80,s=>s.target.useGroupBid=false,s=>s.target.status='PAUSED',s=>s.target.bid=100]){const v=input();change(v.second);assert.ok(assessIndividualBidSafety(v).blockers.includes('target_changed_during_read'))}
 const v=input();v.kind='keyword';v.targetId='nkw-1';v.first.target.id=v.second.target.id='nkw-1';v.first.target.useGroupBid=v.second.target.useGroupBid=false;v.first.target.bid=70;v.second.target.bid=80;assert.ok(assessIndividualBidSafety(v).blockers.includes('target_changed_during_read'));
});
test('unknown, wrong target, stale or invalid amounts fail closed',()=>{
 for(const change of [v=>v.second.target.id='nad-other',v=>v.second.target.useGroupBid=null,v=>v.second.group.bid=null]){const v=input();change(v);assert.ok(assessIndividualBidSafety(v).blockers.includes('snapshot_invalid'))}
 const v=input();v.finishedAt=62000;assert.ok(assessIndividualBidSafety(v).blockers.includes('snapshot_stale'));v.desiredBid=55;assert.ok(assessIndividualBidSafety(v).blockers.includes('desired_bid_invalid'));
});
test('ambiguous responses never imply success or permit automatic retry',()=>{
 const expected={kind:'product',targetId:'nad-1',groupId:'grp-1',bid:80},observed={targetId:'nad-1',groupId:'grp-1',bid:80,useGroupBid:false};
 assert.deepEqual(classifyIndividualBidWriteOutcome({requestState:'timeout',expected,observed}),{status:'unconfirmed',retry:'disabled'});
 assert.deepEqual(classifyIndividualBidWriteOutcome({requestState:'accepted',expected,observed}),{status:'observed_applied',retry:'disabled'});
 assert.deepEqual(classifyIndividualBidWriteOutcome({requestState:'accepted',expected,observed:{...observed,useGroupBid:true}}),{status:'mismatch',retry:'disabled'});
 assert.deepEqual(classifyIndividualBidWriteOutcome({requestState:'accepted',expected,observed:{...observed,targetId:'nad-2'}}),{status:'unconfirmed',retry:'disabled'});
});
