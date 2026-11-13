import test from 'node:test';
import assert from 'node:assert/strict';
import {reportPriority} from '../src/lib/report-priority';
import {keywordGoalDiagnostics} from '../src/lib/keyword-goal';
const base={margin:10000,perOrder:10000,exampleCosts:false};
test('loss takes priority over budget and demand shortfalls',()=>{const diagnostic=keywordGoalDiagnostics({cpc:2000,perOrder:10000,budget:1000,quantity:100,months:1,cvr:1,monthlySearches:10});assert.equal(reportPriority({...base,diagnostic}).title,'광고비가 더 적게 드는 검색어를 고르세요');});
test('demand shortage takes priority over reference costs',()=>{const diagnostic=keywordGoalDiagnostics({cpc:100,perOrder:10000,budget:1000000,quantity:100,months:1,cvr:10,monthlySearches:10});assert.equal(reportPriority({...base,exampleCosts:true,diagnostic}).title,'찾는 사람이 더 많은 검색어를 고르세요');});
test('missing diagnostics request evidence instead of promising feasibility',()=>{assert.equal(reportPriority({...base,diagnostic:null}).title,'이 상품을 찾는 사람이 얼마나 되는지 확인하세요');assert.equal(reportPriority({...base,margin:0,diagnostic:null}).title,'원가를 낮추세요');});
