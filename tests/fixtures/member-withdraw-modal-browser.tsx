import React from 'react';
import {createRoot} from 'react-dom/client';
import {MemberSelfWithdraw} from '../../src/components/store/member-self-withdraw';

declare global {interface Window {withdrawCalls:number}}
window.withdrawCalls=0;
createRoot(document.getElementById('root')!).render(<MemberSelfWithdraw withdraw={async()=>{window.withdrawCalls++;return {ok:true,code:'complete'}}}/>);
