import React from 'react';import {createRoot} from 'react-dom/client';import {AdReadDiagnosticPanel} from '../../src/components/store/ad-read-diagnostic-panel';
const calls:{url:string;auth:string|null}[]=[];Object.assign(window,{diagnosticFixture:{calls}});
window.fetch=async(input,init)=>{const url=String(input),h=new Headers(init?.headers);calls.push({url,auth:h.get('authorization')});return new Response(JSON.stringify({status:'observed',period:{since:'2026-11-14',until:'2026-11-20'},metrics:{impressions:50,clicks:5,cost:1200,clickThroughRate:10,averageClickCost:240}}),{status:200,headers:{'Content-Type':'application/json'}});};
createRoot(document.getElementById('root')!).render(<AdReadDiagnosticPanel/>);
