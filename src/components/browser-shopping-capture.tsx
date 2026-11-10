"use client";
import {useEffect,useRef,useState} from 'react';
import {captureBrowserScreen,type BrowserScreenCapture} from '@/lib/browser-screen-capture';
import {shoppingSearchUrl} from '@/lib/shopping-ad-snapshot';
export function BrowserShoppingCapture({keyword,onCapture}:{keyword:string;onCapture:(capture:BrowserScreenCapture)=>void}){
 const [notice,setNotice]=useState('');const [busy,setBusy]=useState(false);const [preview,setPreview]=useState<BrowserScreenCapture|null>(null);const [confirmed,setConfirmed]=useState(false);
 const controller=useRef<AbortController|null>(null);
 useEffect(()=>{setNotice('');setBusy(false);setPreview(null);setConfirmed(false);return()=>{controller.current?.abort();};},[keyword]);
 async function capture(){
  if(!navigator.mediaDevices?.getDisplayMedia){setNotice('이 브라우저는 탭 캡처를 지원하지 않아요. PC의 Chrome 또는 Edge에서 열어 주세요.');return;}
  controller.current?.abort();const active=new AbortController();controller.current=active;
  setBusy(true);setNotice('네이버쇼핑 탭을 선택하고 공유를 눌러 주세요.');setPreview(null);setConfirmed(false);
  try{const frame=await captureBrowserScreen(active.signal);if(!active.signal.aborted){setPreview(frame);setNotice('공유를 종료했어요. 캡처된 검색어와 광고 3개를 확인한 뒤 보고서에 넣어 주세요.');}}
  catch(error){if(!active.signal.aborted)setNotice(error instanceof DOMException&&error.name==='NotAllowedError'?'화면 선택을 취소했거나 공유가 허용되지 않았어요. 다시 캡처할 수 있어요.':error instanceof Error?error.message:'화면을 캡처하지 못했어요.');}
  finally{if(!active.signal.aborted)setBusy(false);}
 }
 return <div className="mp-browser-capture"><h5>설치 없이 네이버쇼핑 화면 캡처</h5><p>광고 1·2·3위가 한 화면에 보이게 준비한 뒤, 캡처할 네이버쇼핑 탭을 선택하세요. 선택한 화면만 이미지로 저장하며 공유는 즉시 종료돼요.</p><div className="mp-capture-actions"><a className="mp-secondary" href={shoppingSearchUrl(keyword)} target="_blank" rel="noopener noreferrer">네이버쇼핑 열기</a><button type="button" className="mp-primary" disabled={busy} onClick={capture}>{busy?'화면 선택 중…':'네이버쇼핑 탭 캡처'}</button></div><p>필요하면 네이버쇼핑 화면 배율을 줄여 광고 3개가 모두 보이게 해주세요. 이미지는 서버로 전송하지 않아요.</p>{notice&&<p role="status">{notice}</p>}{preview&&<div className="mp-screen-preview"><img src={preview.image} alt="보고서에 넣기 전 선택한 탭 캡처 미리보기"/><label><input type="checkbox" checked={confirmed} onChange={event=>setConfirmed(event.target.checked)}/>‘{keyword}’ 검색의 광고 1·2·3위가 보이는 화면입니다.</label><div className="mp-capture-actions"><button type="button" className="mp-primary" disabled={!confirmed} onClick={()=>{onCapture(preview);setPreview(null);setConfirmed(false);setNotice('실제 화면 이미지를 보고서에 넣었어요.');}}>이 이미지를 보고서에 넣기</button><button type="button" className="mp-secondary" onClick={()=>{setPreview(null);setConfirmed(false);setNotice('이미지를 버렸어요. 다시 캡처할 수 있어요.');}}>이미지 버리기</button></div></div>}</div>;
}
