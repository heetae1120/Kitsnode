import test from 'node:test';
import assert from 'node:assert/strict';
import {reportPriority} from '../src/lib/report-priority';
import {keywordGoalDiagnostics} from '../src/lib/keyword-goal';
const base={margin:10000,perOrder:10000,exampleCosts:false};
test('loss takes priority over budget and demand shortfalls',()=>{const diagnostic=keywordGoalDiagnostics({cpc:2000,perOrder:10000,budget:1000,quantity:100,months:1,cvr:1,monthlySearches:10});assert.equal(reportPriority({...base,diagnostic}).title,'한 건당 광고비부터 낮추세요');});
test('demand shortage takes priority over reference costs',()=>{const diagnostic=keywordGoalDiagnostics({cpc:100,perOrder:10000,budget:1000000,quantity:100,months:1,cvr:10,monthlySearches:10});assert.equal(reportPriority({...base,exampleCosts:true,diagnostic}).title,'검색량을 확보할 검색어부터 찾으세요');});
test('missing diagnostics request evidence instead of promising feasibility',()=>{assert.equal(reportPriority({...base,diagnostic:null}).title,'대표 검색어의 검색량부터 확인하세요');assert.equal(reportPriority({...base,margin:0,diagnostic:null}).title,'판매 가격과 원가부터 조정하세요');});
