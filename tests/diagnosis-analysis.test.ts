import test from 'node:test';
import {gunzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
import {diagnosisAnalysis} from '../src/lib/diagnosis-analysis';
import {keywordGoalDiagnostics} from '../src/lib/keyword-goal';
import {readPeriodSales} from '../keyword-api/src/integrated-ad-details.mjs';
import {diagnosisPdf} from '../src/lib/diagnosis-document';
import {readFile} from 'node:fs/promises';
import {PDFDocument,PDFName,PDFDict} from 'pdf-lib';
import {encodeDiagnoses,decodeDiagnoses} from '../src/lib/diagnosis-storage';
const report={version:1 as const,id:'analysis-test',createdAt:'2026-11-19T00:00:00Z',name:'가습기',months:2,quantity:100,sales:2000000,costs:1200000,profit:800000,margin:8000,marketing:800000,breakEven:100,priority:'전환 조건 확인',action:'실제 구매 비율을 검증하세요.',examples:false};
test('three expanded diagnoses round trip compactly and legacy account records remain readable',async()=>{
 const records=[report,{...report,id:'two'},{...report,id:'three'}];
 const packed=await encodeDiagnoses(records);assert(packed.startsWith('gz1:'));assert.deepEqual(await decodeDiagnoses(packed),records);
 assert.deepEqual(await decodeDiagnoses(records),records);assert.deepEqual(await decodeDiagnoses('gz1:invalid'),[]);
});
test('period sales retain zero and do not relabel an undated total or buyer count',()=>{
 assert.deepEqual(readPeriodSales('최근 1일 판매 0개\n최근 7일간 구매 25개'),{dailySales:0,weeklySales:25});
 assert.deepEqual(readPeriodSales('구매 1,633\n최근 1주간 30명 구매\n리뷰 4,153'),{dailySales:null,weeklySales:null});
});
test('analysis distinguishes unit ad losses, missing data, and loss before ads',()=>{
 assert.match(diagnosisAnalysis(report).verdict,/보류/);
 assert.equal(diagnosisAnalysis({...report,profit:-1}).outcome.status,'pending');
 const diagnostic=keywordGoalDiagnostics({cpc:500,perOrder:8000,budget:800000,quantity:100,months:2,cvr:1,monthlySearches:1000});
 const result=diagnosisAnalysis({...report,analysis:{keyword:{name:'가습기',cpc:500,cvr:1,device:'PC',source:'검증용 가정',volume:{min:1000,max:1000},diagnostic}}});
 assert.match(result.verdict,/마이너스에 가까워요/);assert(result.findings.some(s=>s.includes('42,000원')));assert(result.market.some(s=>s.includes('임의로 추정하지')));
});
test('whole-click rounding losses are included even when unit CPA is below the margin',()=>{
 const diagnostic=keywordGoalDiagnostics({cpc:8,perOrder:10,budget:30,quantity:3,months:1,cvr:81,monthlySearches:1000});
 assert.equal(diagnostic?.unitAdLoss,0);assert.equal(diagnostic?.goal.loss,true);
 const result=diagnosisAnalysis({...report,quantity:3,profit:30,margin:10,marketing:30,analysis:{keyword:{name:'검증용 상품',cpc:8,cvr:81,device:'PC',source:'검증용 가정',volume:{min:1000,max:1000},diagnostic}}});
 assert.match(result.verdict,/마이너스에 가까워요/);assert(result.findings.some(s=>s.includes('-2원')));
});
test('diagnosis is a paginated text PDF with embedded Korean font and no screenshot XObjects',async()=>{
 const bytes=gunzipSync(await readFile(new URL('../public/fonts/Pretendard-Regular.ttf.gz',import.meta.url)));
 const pdf=await diagnosisPdf(report,bytes);const doc=await PDFDocument.load(await pdf.arrayBuffer());
 assert(doc.getPageCount()>=2);assert.match(doc.getTitle()??'',/광고 운영 진단서/);
 for(const page of doc.getPages()){assert(page.node.Resources()?.has(PDFName.of('Font')));const images=page.node.Resources()?.lookup(PDFName.of('XObject'),PDFDict);assert(!images||images.entries().length===0);}
});


