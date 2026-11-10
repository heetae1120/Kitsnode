import test from 'node:test';
import assert from 'node:assert/strict';
import {captureBrowserScreen} from '../src/lib/browser-screen-capture';
function fixture(surface='browser',play=async()=>{}){
 let stopped=0,drawn=0,options:any;const track={getSettings:()=>({displaySurface:surface}),readyState:'live',stop:()=>{stopped++;}};
 const stream={getTracks:()=>[track],getVideoTracks:()=>[track]};
 const video={videoWidth:3840,videoHeight:2160,srcObject:null,play,pause(){},muted:false,playsInline:false};
 const canvas={width:0,height:0,getContext:()=>({drawImage(){drawn++;}}),toDataURL:()=> 'data:image/jpeg;base64,/9j/4P/Z'};
 const deps={getDisplayMedia:async(value:any)=>{options=value;return stream;},createVideo:()=>video,createCanvas:()=>canvas} as any;
 return {deps,video,canvas,stream,track,metrics:()=>({stopped,drawn,options})};
}
test('single selected tab becomes a bounded image, with no audio and tracks immediately stopped',async()=>{
 const f=fixture();const result=await captureBrowserScreen(new AbortController().signal,f.deps);
 assert.match(result.image,/^data:image\/jpeg;base64,/);assert.ok(Number.isFinite(Date.parse(result.observedAt)));assert.equal(f.canvas.width,2400);assert.equal(f.canvas.height,1350);
 assert.equal(f.metrics().stopped,1);assert.equal(f.metrics().drawn,1);assert.equal(f.metrics().options.audio,false);assert.equal(f.metrics().options.selfBrowserSurface,'exclude');assert.equal(f.video.srcObject,null);
});
test('window/monitor selection and failed frames never become report images and always release sharing',async()=>{
 for(const surface of ['monitor','window']){const f=fixture(surface);await assert.rejects(()=>captureBrowserScreen(new AbortController().signal,f.deps),/브라우저 탭/);assert.equal(f.metrics().stopped,1);assert.equal(f.metrics().drawn,0);}
 const f=fixture('browser',async()=>{throw Error('frame failed');});await assert.rejects(()=>captureBrowserScreen(new AbortController().signal,f.deps),/frame failed/);assert.equal(f.metrics().stopped,1);assert.equal(f.video.srcObject,null);
});
test('permission cancellation and unmount while picker is open do not retain a sharing stream',async()=>{
 const f=fixture();f.deps.getDisplayMedia=async()=>{throw new DOMException('cancelled','NotAllowedError');};await assert.rejects(()=>captureBrowserScreen(new AbortController().signal,f.deps),{name:'NotAllowedError'});assert.equal(f.metrics().drawn,0);
 const controller=new AbortController();let grant!:(stream:any)=>void;const g=fixture();g.deps.getDisplayMedia=()=>new Promise(resolve=>{grant=resolve;});const pending=captureBrowserScreen(controller.signal,g.deps);controller.abort();grant(g.stream);await assert.rejects(()=>pending,{name:'AbortError'});assert.equal(g.metrics().stopped,1);assert.equal(g.metrics().drawn,0);
});
