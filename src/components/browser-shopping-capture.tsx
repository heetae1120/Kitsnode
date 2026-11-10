"use client";
import {useEffect,useRef,useState} from 'react';
import {validateShoppingAdSnapshot,type ShoppingAdSnapshot} from '@/lib/shopping-ad-snapshot';
export function BrowserShoppingCapture({keyword,onCapture}:{keyword:string;onCapture:(snapshot:ShoppingAdSnapshot)=>void}){
 const [notice,setNotice]=useState('');const [busy,setBusy]=useState(false);
 const cleanup=useRef<(()=>void)|null>(null);
 useEffect(()=>{setNotice('');setBusy(false);return()=>{cleanup.current?.();cleanup.current=null;};},[keyword]);
 function importCapture(){
  cleanup.current?.();setBusy(true);setNotice('저장한 캡처를 확인하고 있어요…');
  const id=crypto.randomUUID();let timer:ReturnType<typeof setTimeout>;
  const stop=()=>{window.removeEventListener('message',receive);clearTimeout(timer);cleanup.current=null;};
  const receive=(event:MessageEvent)=>{
   if(event.source!==window||event.origin!==location.origin||event.data?.type!=='KITSNODE_CAPTURE_RESPONSE'||event.data.id!==id)return;
   stop();setBusy(false);
   try{
    if(event.data.ok!==true)throw Error(typeof event.data.error==='string'?event.data.error.slice(0,200):'캡처를 불러오지 못했어요.');
    const snapshot=validateShoppingAdSnapshot(event.data.snapshot,keyword);
    if(!snapshot.complete||snapshot.items.length!==3||snapshot.items.some(item=>!item.capture))throw Error('광고 3개가 모두 캡처된 자료가 필요해요.');
    onCapture(snapshot);setNotice('광고 1·2·3위 실제 캡처를 불러왔어요.');
   }catch(error){setNotice(error instanceof Error?error.message:'캡처를 확인하지 못했어요.');}
  };
  window.addEventListener('message',receive);
  timer=setTimeout(()=>{stop();setBusy(false);setNotice('캡처 도구를 설치한 뒤 이 페이지를 새로고침해 주세요. 네이버쇼핑 탭에서 먼저 광고 3개를 캡처해야 해요.');},2500);
  cleanup.current=stop;window.postMessage({type:'KITSNODE_CAPTURE_REQUEST',id,keyword},location.origin);
 }
 return <div className="mp-browser-capture"><h5>내 브라우저에서 실제 광고 화면 가져오기</h5><p>네이버쇼핑을 열고 캡처 도구로 광고 3개를 저장한 뒤 불러오세요.</p><div className="mp-capture-actions"><a className="mp-secondary" href={
 (process.env.NEXT_PUBLIC_BASE_PATH||'')+'/downloads/kitsnode-shopping-capture.zip'} download>캡처 도구 다운로드</a><button type="button" className="mp-primary" disabled={busy} onClick={importCapture}>{busy?'불러오는 중…':'내 브라우저 캡처 불러오기'}</button></div><details><summary>처음 한 번 설치하기</summary><ol><li>다운로드한 ZIP을 압축 해제하세요.</li><li>Chrome의 <code>chrome://extensions</code>에서 개발자 모드를 켜세요.</li><li>‘압축해제된 확장 프로그램을 로드합니다’를 눌러 <code>shopping-capture</code> 폴더를 선택하세요.</li><li>이 페이지를 새로고침하고 네이버쇼핑에서 같은 검색어를 검색하세요.</li><li>확장 메뉴의 ‘KITSNODE 쇼핑광고 캡처’를 실행한 뒤 보고서로 돌아와 불러오세요.</li></ol><p>캡처 이미지는 이 브라우저에만 저장돼요. 네이버 접속 제한 화면에서는 캡처할 수 없어요.</p></details>{notice&&<p role="status">{notice}</p>}</div>;
}
