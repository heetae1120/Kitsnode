import test from 'node:test';
import assert from 'node:assert/strict';
import {readSavedDiagnoses} from '../src/lib/diagnosis-document';
import {fetchShoppingAdSnapshot} from '../src/lib/fetch-shopping-ad-snapshot';
const report={version:1,id:'one',createdAt:'2026-11-19',name:'상품',months:2,quantity:100,sales:1000,costs:500,profit:500,margin:5,marketing:100,breakEven:20,priority:'비용 확인',action:'원가를 확인하세요.',examples:false};
test('saved diagnoses ignore corrupt records and cap the account list at three',()=>{assert.deepEqual(readSavedDiagnoses(null),[]);assert.equal(readSavedDiagnoses([{...report,profit:Infinity},report,...Array.from({length:5},(_,i)=>({...report,id:String(i)}))]).length,3);});
test('integrated search accepts structured ads without screenshots and preserves unavailable sales',async()=>{
 const fetcher:typeof fetch=async url=>{assert(String(url).includes('placement=integrated'));return Response.json({keyword:'가습기',device:'PC',placement:'integrated',sourceUrl:'https://search.naver.com/search.naver?query=가습기',context:'통합검색',observedAt:new Date().toISOString(),complete:false,items:[{rank:1,ad:true,title:'가습기',mall:'',price:null,image:null,dailySales:0,weeklySales:20,rating:4.9,reviewCount:'50'}]});};
 const snapshot=await fetchShoppingAdSnapshot('가습기',new AbortController().signal,()=>{},{fetcher});assert.equal(snapshot.items[0].dailySales,0);assert.equal(snapshot.items[0].weeklySales,20);assert.equal(snapshot.items[0].capture,null);
});
