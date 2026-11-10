import {shoppingContext,reportContext,cropGeometry} from './capture-core.mjs';
import {findAds,positionAd,restoreScroll} from './page-functions.mjs';
let capturing=false;
async function execute(tabId,func,args=[]){const rows=await chrome.scripting.executeScript({target:{tabId},func,args});if(rows[0]?.error)throw Error(rows[0].error.message);return rows[0]?.result;}
async function checkTab(tab,sourceUrl){const current=await chrome.tabs.get(tab.id);if(!current.active||current.windowId!==tab.windowId||current.url!==sourceUrl)throw Error('캡처 중에는 네이버쇼핑 탭을 그대로 열어 두세요.');}
async function capture(){
 if(capturing)throw Error('캡처가 진행 중이에요.');capturing=true;let tab,found,sourceUrl;
 try{
  [tab]=await chrome.tabs.query({active:true,currentWindow:true});
  if(!tab?.id)throw Error('네이버쇼핑 탭을 열어 주세요.');
  const context=shoppingContext(tab.url);sourceUrl=context.sourceUrl;
  found=await execute(tab.id,findAds);
  if(!found||found.rows.length!==3)throw Error('광고 3개를 확인하지 못했어요.');
  const items=[];
  for(let index=0;index<3;index++){
   await checkTab(tab,context.sourceUrl);
   let position=await execute(tab.id,positionAd,[index,found.rows[index].title]);
   await new Promise(resolve=>setTimeout(resolve,600)); // captureVisibleTab limit: no more than 2 captures per second.
   await checkTab(tab,context.sourceUrl);
   position=await execute(tab.id,positionAd,[index,found.rows[index].title]);
   const data=await chrome.tabs.captureVisibleTab(tab.windowId,{format:'png'});
   await checkTab(tab,context.sourceUrl);
   const bitmap=await createImageBitmap(await (await fetch(data)).blob());
   try{
    const crop=cropGeometry(position.rect,position.viewport,bitmap);
    const canvas=new OffscreenCanvas(crop.width,crop.height);canvas.getContext('2d').drawImage(bitmap,crop.x,crop.y,crop.width,crop.height,0,0,crop.width,crop.height);
    const bytes=new Uint8Array(await (await canvas.convertToBlob({type:'image/jpeg',quality:0.78})).arrayBuffer());
    let binary='';for(let n=0;n<bytes.length;n+=8192)binary+=String.fromCharCode(...bytes.subarray(n,n+8192));
    const capture='data:image/jpeg;base64,'+btoa(binary);if(capture.length>350023)throw Error('캡처 이미지가 너무 커요. 화면 배율을 조정한 뒤 다시 실행해 주세요.');
    items.push({rank:index+1,ad:true,title:found.rows[index].title,mall:'',price:null,image:null,capture});
   }finally{bitmap.close();}
  }
  await checkTab(tab,context.sourceUrl);
  const snapshot={...context,device:'PC',observedAt:new Date().toISOString(),context:'사용자 브라우저에서 직접 캡처 · 쇼핑 첫 페이지 광고 순서',complete:true,items};
  await chrome.storage.local.set({shoppingCapture:snapshot});return snapshot;
 }finally{capturing=false;if(tab?.id&&found?.scroll){try{await checkTab(tab,sourceUrl);await execute(tab.id,restoreScroll,[found.scroll]);}catch{}}}
}
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
 if(message?.type==='CAPTURE_ADS'&&!sender.tab&&sender.id===chrome.runtime.id){capture().then(snapshot=>respond({ok:true,snapshot})).catch(error=>respond({ok:false,error:error.message}));return true;}
 if(message?.type==='GET_CAPTURE'&&sender.tab&&reportContext(sender.url)&&typeof message.keyword==='string'&&message.keyword.length<=100){
  chrome.storage.local.get('shoppingCapture').then(({shoppingCapture:snapshot})=>{const normalize=x=>x.replace(/\s+/g,'').toLowerCase();respond(snapshot&&normalize(snapshot.keyword)===normalize(message.keyword)?{ok:true,snapshot}:{ok:false,error:'이 검색어의 캡처가 없어요. 네이버쇼핑에서 같은 검색어로 캡처해 주세요.'});}).catch(()=>respond({ok:false,error:'저장한 캡처를 읽지 못했어요.'}));return true;
 }
});
