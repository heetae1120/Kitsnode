import React from 'react';
import {createRoot} from 'react-dom/client';
import {AdConnectionPanel} from '../../src/components/store/ad-connection-panel';
const requestId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
let status='pending_review';
const calls:string[]=[];
const transport={
  async list(){calls.push('list');return {connections:[{requestId,adAccountId:'12345',status}]};},
  async request(){calls.push('request');return {status:'pending_review' as const};},
  async disconnect(_token:string,id:string){calls.push(`disconnect:${id}`);status='disconnected';return {status:'disconnected' as const};},
};
const extensionCalls:unknown[]=[];
let extensionAvailable=true;
Object.assign((window as unknown as {chrome:object}).chrome,{runtime:{sendMessage:async(id:string,message:{nonce:string})=>{extensionCalls.push({id,message});if(!extensionAvailable)throw new Error('unavailable');return {status:'opened',nonce:message.nonce};}}});
Object.assign(window,{connectionFixture:{calls,extensionCalls,disableExtension:()=>{extensionAvailable=false;}}});
createRoot(document.getElementById('root')!).render(<AdConnectionPanel transport={transport}/>);
