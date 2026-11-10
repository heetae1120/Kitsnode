export type BrowserScreenCapture={image:string;observedAt:string};
type Dependencies={getDisplayMedia:(options:DisplayMediaStreamOptions)=>Promise<MediaStream>;createVideo:()=>HTMLVideoElement;createCanvas:()=>HTMLCanvasElement};
/** A single user-selected tab frame; never uploads pixels or infers ad ranks. */
export async function captureBrowserScreen(signal:AbortSignal,deps?:Dependencies):Promise<BrowserScreenCapture>{
 const api=deps??{getDisplayMedia:(options:DisplayMediaStreamOptions)=>navigator.mediaDevices.getDisplayMedia(options),createVideo:()=>document.createElement('video'),createCanvas:()=>document.createElement('canvas')};
 let stream:MediaStream|undefined;let video:HTMLVideoElement|undefined;let timer:ReturnType<typeof setTimeout>|undefined;
 const stop=()=>stream?.getTracks().forEach(track=>track.stop());
 signal.addEventListener('abort',stop,{once:true});
 try{
  if(signal.aborted)throw new DOMException('취소됐어요.','AbortError');
  stream=await api.getDisplayMedia({video:{displaySurface:'browser',frameRate:{ideal:1,max:1}},audio:false,selfBrowserSurface:'exclude',monitorTypeSurfaces:'exclude',surfaceSwitching:'exclude'} as DisplayMediaStreamOptions);
  if(signal.aborted)throw new DOMException('취소됐어요.','AbortError');
  const track=stream.getVideoTracks()[0];
  if(!track||track.getSettings().displaySurface!=='browser')throw Error('전체 화면이나 창 대신 네이버쇼핑이 열린 브라우저 탭을 선택해 주세요.');
  video=api.createVideo();video.muted=true;video.playsInline=true;video.srcObject=stream;
  await Promise.race([video.play(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('화면을 읽지 못했어요. 탭이 정상적으로 보이는지 확인해 주세요.')),10000);})]);
  if(signal.aborted)throw new DOMException('취소됐어요.','AbortError');
  if(track.readyState==='ended'||video.videoWidth<1||video.videoHeight<1)throw Error('공유가 종료됐거나 화면을 읽지 못했어요. 다시 캡처해 주세요.');
  const canvas=api.createCanvas();const scale=Math.min(1,2400/video.videoWidth,1800/video.videoHeight);
  canvas.width=Math.max(1,Math.round(video.videoWidth*scale));canvas.height=Math.max(1,Math.round(video.videoHeight*scale));
  const context=canvas.getContext('2d');if(!context)throw Error('이 브라우저에서 이미지를 만들지 못했어요.');
  context.drawImage(video,0,0,canvas.width,canvas.height);
  return {image:canvas.toDataURL('image/jpeg',0.85),observedAt:new Date().toISOString()};
 }finally{clearTimeout(timer);stop();if(video){video.pause();video.srcObject=null;}signal.removeEventListener('abort',stop);}
}
