import React from 'react';import {createRoot} from 'react-dom/client';import {AdReadDiagnosticPanel} from '../../src/components/store/ad-read-diagnostic-panel';
const calls:{url:string;auth:string|null}[]=[];Object.assign(window,{diagnosticFixture:{calls}});
window.fetch=async(input,init)=>{const url=String(input),h=new Headers(init?.headers);calls.push({url,auth:h.get('authorization')});return new Response(JSON.stringify({status:'accessible',role:'READ_ONLY',campaigns:{status:'observed',returnedCount:0}}),{status:200,headers:{'Content-Type':'application/json'}});};
createRoot(document.getElementById('root')!).render(<AdReadDiagnosticPanel/>);
