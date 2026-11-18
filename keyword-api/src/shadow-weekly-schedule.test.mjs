import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateShadowSchedule as evaluate,validShadowSchedule as valid} from './shadow-weekly-schedule.mjs';
const schedule=slots=>({timezone:'Asia/Seoul',slots});
const allOff=schedule('0'.repeat(168));
const allOn=schedule('1'.repeat(168));
const one=index=>schedule('0'.repeat(index)+'1'+'0'.repeat(167-index));
test('midnight and week boundaries are Seoul Monday-first, including 23:00–24:00',()=>{
 const prior=Date.parse('2026-11-15T14:59:59.999Z'),start=Date.parse('2026-11-15T15:00:00.000Z');
 assert.deepEqual(evaluate(one(167),prior),{status:'on',timezone:'Asia/Seoul',day:'sun',hour:23,slotIndex:167});
 assert.deepEqual(evaluate(one(0),start),{status:'on',timezone:'Asia/Seoul',day:'mon',hour:0,slotIndex:0});
 assert.equal(evaluate(one(167),start).status,'off');
 assert.equal(evaluate(one(23),Date.parse('2026-11-16T14:00:00Z')).hour,23);
 assert.equal(evaluate(one(24),Date.parse('2026-11-16T15:00:00Z')).day,'tue');
});
test('every one of 168 slots is selected by its own Seoul hour',()=>{
 const monday=Date.parse('2026-11-15T15:00:00Z');
 for(let i=0;i<168;i++){
  const t=monday+i*3600000;
  assert.equal(evaluate(one(i),t).status,'on');assert.equal(evaluate(one(i),t).slotIndex,i);
  assert.equal(evaluate(one((i+1)%168),t).status,'off');
  assert.equal(evaluate(allOn,t).status,'on');assert.equal(evaluate(allOff,t).status,'off');
 }
});
test('unset, malformed or unsupported timezones never become on',()=>{
 assert.equal(evaluate(null,0).status,'unset');assert.equal(evaluate(undefined,0).status,'unset');
 for(const s of [false,[],{},schedule('0'.repeat(167)),schedule('0'.repeat(167)+'x'),{timezone:'UTC',slots:'1'.repeat(168)},{...allOn,enabled:true}]){
  assert.equal(valid(s),false);assert.equal(evaluate(s,0).status,'invalid');
 }
 for(const t of [NaN,Infinity,1.5,'0',9007199254740991])assert.equal(evaluate(allOn,t).status,'invalid');
});
