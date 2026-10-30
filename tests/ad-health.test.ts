import test from 'node:test';
import assert from 'node:assert/strict';
import { diagnose,parseDataset,summarize,csvRows,type Goal } from '../src/lib/ad-health';
import { SAMPLE } from '../src/lib/calculator';
const goal:Goal={mode:'profit',targetKind:'orders',target:100,days:30,unitProfit:3000,lossLimit:0};
test('profit blocks additional spend below requested margin; rotation respects loss cap',()=>{
 const p={...SAMPLE,price:28500,cost:12000,feePercent:7,cpc:1742,cvrPercent:7.77,budget:5493141};
 const profit=diagnose(p,goal);assert.equal(profit.recommendedBudget,0);assert.equal(profit.requiredSpend,2243696);assert.ok(profit.maxCpc!<p.cpc);
 const rotation=diagnose(p,{...goal,mode:'rotation',lossLimit:500000});assert.ok(rotation.recommendedBudget>0);assert.ok(rotation.recommended.totalProfit>=-500000);assert.ok(rotation.recommendedBudget<=p.budget);
 assert.equal(diagnose(p,{...goal,mode:'rotation',lossLimit:0}).recommendedBudget,0);
});
test('budget ceiling, target revenue rounding, zero conversion and invalid horizon',()=>{
 const r=diagnose({...SAMPLE,budget:1000},goal);assert.ok(r.budgetGap!<0);assert.ok(r.recommendedBudget<=1000);
 assert.equal(diagnose(SAMPLE,{...goal,targetKind:'revenue',target:39001}).targetOrders,2);
 assert.equal(diagnose({...SAMPLE,cvrPercent:0},goal).requiredSpend,null);
 assert.equal(diagnose({...SAMPLE,cpc:0},goal).recommendedBudget,0);
 assert.throws(()=>diagnose(SAMPLE,{...goal,days:0}));assert.throws(()=>diagnose(SAMPLE,{...goal,target:NaN}));
});
test('CSV quoting, Korean headers, missing values, invalid or duplicated statistics',()=>{
 assert.deepEqual(csvRows('a,b\r\n"one,two","three"'),[['a','b'],['one,two','three']]);
 const d=parseDataset('날짜,상품번호,방문수,상품결제건수\n2026-10-01,P1,100,5','daily','local.csv');assert.equal(summarize(d.rows).cvr,5);assert.equal(summarize(d.rows).dwell,null);assert.equal(summarize(d.rows).cpc,null);
 assert.throws(()=>parseDataset('date,productId,visits\n2026-10-01,ALL,100\n2026-10-01,P1,50','daily','x'));
 assert.throws(()=>parseDataset('date,productId,visits\n2026-10-01,P1,100\n2026-10-01,P1,50','daily','x'));
 assert.throws(()=>parseDataset('date,productId,visits\n2026-02-30,P1,100','daily','x'));
 assert.throws(()=>parseDataset('date,productId,전화번호\n2026-10-01,P1,01012345678','daily','x'));
 assert.throws(()=>parseDataset('[{"date":"2026-10-01","productId":"P1","visits":-1}]','daily','x'));
});
test('incomplete columns stay unknown; dwell averages are weighted by visits',()=>{
 assert.equal(summarize([{date:'2026-10-01',productId:'P',visits:100,orders:5},{date:'2026-10-02',productId:'P',visits:50}]).orders,null);
 assert.equal(summarize([{date:'2026-10-01',productId:'P',visits:10,dwellSeconds:20},{date:'2026-10-02',productId:'P',visits:30,dwellSeconds:40}]).dwell,35);
});
