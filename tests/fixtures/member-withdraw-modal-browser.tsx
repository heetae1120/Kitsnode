import React from 'react';
import {createRoot} from 'react-dom/client';
import {MemberSelfWithdraw} from '../../src/components/store/member-self-withdraw';

declare global {interface Window {withdrawCalls:number;withdrawMode:'pending'|'complete'}}
window.withdrawCalls=0;
window.withdrawMode='complete';
createRoot(document.getElementById('root')!).render(<MemberSelfWithdraw withdraw={async()=>{window.withdrawCalls++;return window.withdrawMode==='pending'?{ok:false,code:'pending'}:{ok:true,code:'complete'}}}/>);
