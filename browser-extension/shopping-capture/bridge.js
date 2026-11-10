(() => {
 const origin='https://heetae1120.github.io';
 window.addEventListener('message',event=>{
  const data=event.data;
  if(event.source!==window||event.origin!==origin||!location.pathname.startsWith('/Kitsnode/tools/')||data?.type!=='KITSNODE_CAPTURE_REQUEST'||typeof data.id!=='string'||data.id.length>100||typeof data.keyword!=='string'||data.keyword.length>100)return;
  chrome.runtime.sendMessage({type:'GET_CAPTURE',keyword:data.keyword},response=>{
   const failed=chrome.runtime.lastError;
   window.postMessage({type:'KITSNODE_CAPTURE_RESPONSE',id:data.id,...(failed?{ok:false,error:'확장 프로그램을 다시 열고 캡처해 주세요.'}:response)},origin);
  });
 });
})();
