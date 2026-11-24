import React from 'react';
import {createRoot} from 'react-dom/client';
import {AdConnectionPanel} from '../../src/components/store/ad-connection-panel';
const requestId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
let status=new URLSearchParams(location.search).has('empty')?'':'pending_review';
let selectedAccount='12345',failNext=false;
const calls:string[]=[];
const transport={
  async list(){calls.push('list');return {connections:status?[{requestId,adAccountId:selectedAccount,status}]:[]};},
  async request(_token:string,id:string){calls.push('request');if(failNext){failNext=false;throw Error('connection_unavailable');}selectedAccount=id;status='pending_review';return {status:'pending_review' as const};},
  async disconnect(_token:string,id:string){calls.push(`disconnect:${id}`);status='disconnected';return {status:'disconnected' as const};},
};
const extensionCalls:unknown[]=[];
let extensionAvailable=true;
Object.assign((window as unknown as {chrome:object}).chrome,{runtime:{sendMessage:async(id:string,message:{nonce:string;type:string})=>{extensionCalls.push({id,message});if(!extensionAvailable)throw new Error('unavailable');if(message.type==='kitsnode.account.start.v1')return {status:'started'};if(message.type==='kitsnode.account.get.v1')return {status:'selected',accountId:'12345'};return {status:'opened',nonce:message.nonce};}}});
Object.assign(window,{connectionFixture:{calls,extensionCalls,disableExtension:()=>{extensionAvailable=false;},failNext:()=>{failNext=true;}}});
createRoot(document.getElementById('root')!).render(<AdConnectionPanel transport={transport} manualEntry={new URLSearchParams(location.search).has('manual')}/>);
