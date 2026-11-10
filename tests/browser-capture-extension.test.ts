import test from 'node:test';
import assert from 'node:assert/strict';
import {shoppingContext,reportContext,cropGeometry} from '../browser-extension/shopping-capture/capture-core.mjs';
import {findAds,positionAd} from '../browser-extension/shopping-capture/page-functions.mjs';
test('local capture only accepts the exact shopping origin and first page with entered keyword',()=>{
 const url='https://search.shopping.naver.com/search/all?query='+encodeURIComponent('보조배터리 & 케이블');
 assert.equal(shoppingContext(url).keyword,'보조배터리 & 케이블');
 for(const invalid of ['https://evil.test/search/all?query=x','https://search.shopping.naver.com.evil.test/search/all?query=x','https://user:secret@search.shopping.naver.com/search/all?query=x',url+'&pagingIndex=2','https://search.shopping.naver.com/search/all'])assert.throws(()=>shoppingContext(invalid));
 assert.equal(reportContext('https://heetae1120.github.io/Kitsnode/tools/'),true);assert.equal(reportContext('https://evil.test/Kitsnode/tools/'),false);assert.equal(reportContext('https://heetae1120.github.io/other/'),false);
});
test('screenshot crop scales CSS pixels to captured pixels and rejects clipped ads',()=>{
 assert.deepEqual(cropGeometry({x:10,y:140,width:600,height:300},{width:1000,height:800},{width:2000,height:1600}),{x:20,y:280,width:1200,height:600});
 for(const rect of [{x:-1,y:140,width:600,height:300},{x:10,y:700,width:600,height:300},{x:900,y:140,width:600,height:300},{x:10,y:140,width:NaN,height:300}])assert.throws(()=>cropGeometry(rect,{width:1000,height:800},{width:2000,height:1600}));
});
test('ad detection preserves displayed order, drops organic cards, nested duplicates and hidden cards',async()=>{
 const old={document:globalThis.document,scrollX:globalThis.scrollX,scrollY:globalThis.scrollY};
 const card=(title:string,ad=true,width=600)=>({querySelectorAll:()=>ad?[{textContent:'광고'}]:[],querySelector:()=>({textContent:title}),getBoundingClientRect:()=>({width,height:250}),contains:(_other?:unknown)=>false});
 const one=card('첫 광고'),two=card('둘째 광고'),three=card('셋째 광고'),nested=card('첫 광고 내부');one.contains=(other:unknown)=>other===nested;
 try{
 Object.assign(globalThis,{scrollX:0,scrollY:50,document:{body:{innerText:'네이버 쇼핑 결과'},querySelectorAll:()=>[card('일반 상품',false),one,nested,card('숨김',true,0),two,three]}});
 assert.deepEqual(findAds().rows.map((x:any)=>x.title),['첫 광고','둘째 광고','셋째 광고']);
 await assert.rejects(()=>positionAd(0,'바뀐 상품'),/순서가 바뀌/);
 (globalThis.document as any).querySelectorAll=()=>[one,two];assert.throws(()=>findAds(),/3개/);
 (globalThis.document as any).body.innerText='쇼핑 서비스 접속이 일시적으로 제한되었습니다.';assert.throws(()=>findAds(),/접속 제한/);
 }finally{Object.assign(globalThis,old);}
});

test('extension captures three crops in order, stores locally, and refuses unrelated report origins',async()=>{
 let listener:any;let stored:any;let count=0;const crops:any[]=[];
 const globals={chrome:(globalThis as any).chrome,OffscreenCanvas:(globalThis as any).OffscreenCanvas,createImageBitmap:(globalThis as any).createImageBitmap};
 const url='https://search.shopping.naver.com/search/all?query='+encodeURIComponent('보조배터리');
 const tab={id:1,windowId:1,active:true,url};
 const chromeMock={runtime:{id:'capture-test',onMessage:{addListener:(fn:any)=>{listener=fn;}}},tabs:{query:async()=>[tab],get:async()=>tab,captureVisibleTab:async()=>{count++;return 'data:image/jpeg;base64,/9j/4P/Z';}},scripting:{executeScript:async({func,args}:any)=>[{result:func.name==='findAds'?{rows:[{title:'one'},{title:'two'},{title:'three'}],scroll:{x:0,y:0}}:func.name==='positionAd'?{rect:{x:10,y:140,width:600,height:250},viewport:{width:1000,height:800}}:undefined}]},storage:{local:{set:async(value:any)=>{stored=value.shoppingCapture;},get:async()=>({shoppingCapture:stored})}}};
 class CanvasMock{constructor(public width:number,public height:number){}getContext(){return{drawImage:(...args:any[])=>{crops.push(args.slice(1));}};}async convertToBlob(){return new Blob([new Uint8Array([255,216,255,224,255,217])],{type:'image/jpeg'});}}
 try{
 Object.assign(globalThis,{chrome:chromeMock,OffscreenCanvas:CanvasMock,createImageBitmap:async()=>({width:2000,height:1600,close(){}})});
 await import('../browser-extension/shopping-capture/background.mjs');
 const captured:any=await new Promise(resolve=>listener({type:'CAPTURE_ADS'},{id:'capture-test'},resolve));
 assert.equal(captured.ok,true,captured.error);assert.equal(count,3);assert.deepEqual(stored.items.map((x:any)=>x.rank),[1,2,3]);assert.deepEqual(stored.items.map((x:any)=>x.title),['one','two','three']);assert.equal(crops.length,3);assert.deepEqual(crops[0],[20,280,1200,500,0,0,1200,500]);
 assert.equal(listener({type:'GET_CAPTURE',keyword:'보조배터리'},{tab:{id:2},url:'https://evil.test/'},()=>assert.fail('unrelated origin received capture')),undefined);
 const imported:any=await new Promise(resolve=>listener({type:'GET_CAPTURE',keyword:'보조배터리'},{tab:{id:2},url:'https://heetae1120.github.io/Kitsnode/tools/'},resolve));assert.equal(imported.ok,true);assert.equal(imported.snapshot.items.length,3);
 const mismatch:any=await new Promise(resolve=>listener({type:'GET_CAPTURE',keyword:'시계'},{tab:{id:2},url:'https://heetae1120.github.io/Kitsnode/tools/'},resolve));assert.equal(mismatch.ok,false);
 tab.url='https://example.com/';const rejected:any=await new Promise(resolve=>listener({type:'CAPTURE_ADS'},{id:'capture-test'},resolve));assert.equal(rejected.ok,false);assert.equal(count,3);
 }finally{Object.assign(globalThis,globals);}
});
