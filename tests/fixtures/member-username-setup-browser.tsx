import React from 'react';
import {createRoot} from 'react-dom/client';
import {MemberUsernameSetup} from '../../src/components/store/member-username-setup';

const scenario=new URLSearchParams(location.search).get('case');
const session={access_token:'synthetic-token',user:{id:'member-one'}};
const calls:{name:string;input?:unknown}[]=[];
(window as any).setupCalls=calls;
const client={
 auth:{
  onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),
  getSession:async()=>({data:{session:scenario==='signedout'?null:session},error:null}),
  getUser:async()=>({data:{user:{id:scenario==='mismatch'?'other':'member-one',email_confirmed_at:'2026-01-01T00:00:00Z',identities:[{provider:scenario==='naver'?'custom:naver':'email'}]}},error:null})
 },
 from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:null,error:null})})})}),
 rpc:async(name:string,input:unknown)=>{calls.push({name,input});return {data:'created',error:null}}
};
const check=async(name:string)=>({ok:true,code:name==='duplicate'?'unavailable':'available'});
createRoot(document.getElementById('root')!).render(<MemberUsernameSetup testClient={client as any} testCheckUsername={check}/>);
