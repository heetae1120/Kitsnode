import test from 'node:test';
import assert from 'node:assert/strict';
import { bidRankRequests, loadBidRanks, validateBidRank, type BidRankQuery, type BidRank } from '../src/lib/bid-ranks';

const query:BidRankQuery={adType:'shopping-search',targetType:'id',target:'nad-test-0001',device:'PC',count:4};
const response=(position:number,bid:number|null=300)=>({source:'naver-shopping-bid-estimate',adType:'shopping-search',targetType:'id',targetId:query.target,device:'PC',position,bid,fetchedAt:'2026-10-30T01:00:00Z',cached:false});
test('rank requests use the material ID and keep device, position and ad type separate',()=>{
  const requests=bidRankRequests('https://example.com/api/keywords',query);
  assert.equal(requests.length,4);
  assert.deepEqual(requests.map(url=>url.searchParams.get('position')),['1','2','3','4']);
  assert.equal(requests[0].searchParams.get('targetId'),query.target);
  assert.equal(requests[0].searchParams.get('mode'),'shopping-bid-estimate');
  assert.equal(requests[0].searchParams.has('keywords'),false);
  const keyword=bidRankRequests('https://example.com/api/keywords',{...query,adType:'powerlink',target:'미니 가습기',count:5});
  assert.equal(keyword[0].searchParams.get('keywords'),'미니가습기');
  assert.equal(keyword[0].searchParams.has('targetId'),false);
  assert.throws(()=>bidRankRequests('https://example.com/api/keywords',{...query,target:''}));
  assert.throws(()=>bidRankRequests('https://example.com/api/keywords',{...query,device:'MOBILE',count:10}));
});
test('rank responses never substitute another material, device, rank or advertising product',()=>{
  assert.equal(validateBidRank(response(1,null),query,1).bid,null);
  assert.equal(validateBidRank(response(1),query,1).bid,300);
  for(const patch of [{position:2},{targetId:'nad-unrelated'},{targetType:'product'},{device:'MOBILE'},{adType:'powerlink'},{source:'demo'},{bid:0},{bid:'300'},{fetchedAt:'invalid'}])
    assert.throws(()=>validateBidRank({...response(1),...patch},query,1));
});
test('rank lookup preserves partial errors and unavailable prices without inventing amounts',async()=>{
  const rows:BidRank[]=[];
  const request:typeof fetch=async(url)=>{
    const position=Number(new URL(String(url)).searchParams.get('position'));
    return position===2?Response.json({error:'API 권한 확인 필요'},{status:403}):Response.json(response(position,position===3?null:position*100));
  };
  await loadBidRanks('https://example.com/api/keywords',query,new AbortController().signal,row=>rows.push(row),request);
  assert.equal(rows.length,4);
  assert.equal(rows.find(row=>row.position===2)?.error,'API 권한 확인 필요');
  assert.equal(rows.find(row=>row.position===3)?.bid,null);
  assert.equal(rows.find(row=>row.position===4)?.bid,400);
});
test('cancelled rank requests do not publish stale results',async()=>{
  const controller=new AbortController();
  const rows:BidRank[]=[];
  await loadBidRanks('https://example.com/api/keywords',query,controller.signal,row=>rows.push(row),async()=>{controller.abort();return Response.json(response(1));});
  assert.deepEqual(rows,[]);
});
