import test from 'node:test';
import assert from 'node:assert/strict';
import {diagnosisOutcome} from '../src/lib/diagnosis-outcome';
import {keywordGoalDiagnostics} from '../src/lib/keyword-goal';
const base={quantity:100,months:2,sales:2000000,costs:1200000,profit:800000,marketing:800000};
const evidence=(cvr:number,cpc=500)=>({keyword:{name:'가습기',cpc,cvr,device:'PC',source:'검증용 네이버 조건',volume:null,diagnostic:keywordGoalDiagnostics({cpc,perOrder:8000,budget:800000,quantity:100,months:2,cvr,monthlySearches:null})}});
test('direction uses whole-target ad spend after selling costs, not profit before ads',()=>{
 const plus=diagnosisOutcome({...base,analysis:evidence(10)}),minus=diagnosisOutcome({...base,analysis:evidence(1)});
 assert.equal(plus.status,'positive');assert.equal(plus.afterProfit,300000);assert.equal(plus.perUnit,3000);assert.match(plus.headline,/플러스에 가까워요/);
 assert.equal(minus.status,'negative');assert.equal(minus.afterProfit,-4200000);assert.match(minus.headline,/마이너스에 가까워요/);
 assert.notDeepEqual(plus.actions,minus.actions);assert(plus.conditions.some(s=>s.includes('검색량 미확인')));
 assert.equal(plus.scenarios[1].profit,plus.afterProfit);assert(plus.scenarios[0].profit>plus.scenarios[2].profit);
});
test('missing or invalid ad assumptions never become a confident positive verdict',()=>{
 for(const analysis of [undefined,evidence(0),evidence(101),evidence(2,0)]){const o=diagnosisOutcome({...base,analysis});assert.equal(o.status,'pending');assert.equal(o.afterProfit,null);assert.equal(o.scenarios.length,0);}
});
test('break-even and whole-click rounding do not turn into positive claims',()=>{
 const zero=diagnosisOutcome({...base,analysis:evidence(6.25)});assert.equal(zero.afterProfit,0);assert.equal(zero.status,'negative');assert.match(zero.summary,/본전/);
 const diagnostic=keywordGoalDiagnostics({cpc:8,perOrder:10,budget:30,quantity:3,months:1,cvr:81,monthlySearches:1000});
 const rounded=diagnosisOutcome({...base,quantity:3,months:1,profit:30,analysis:{keyword:{name:'반올림 검증',cpc:8,cvr:81,device:'PC',source:'검증용',volume:null,diagnostic}}});assert.equal(rounded.afterProfit,-2);assert.equal(rounded.status,'negative');
});
test('auto-filled conversion rates are labelled assumptions rather than observed purchases',()=>{
 const data=evidence(10);const o=diagnosisOutcome({...base,analysis:{keyword:{...data.keyword,conversionBasis:'break-even'}}});assert.match(o.summary,/자동 입력한 가정값/);assert(o.conditions.some(c=>c.includes('실제 구매 실적이 아니')));
});
