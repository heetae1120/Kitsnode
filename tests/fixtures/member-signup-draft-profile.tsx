import React from 'react';
import {createRoot} from 'react-dom/client';
import {MemberEmailProfile} from '../../src/components/store/member-email-profile';

const params=new URL(location.href).searchParams,calls:any[]=[];
(window as any).fixture={calls};
const id='11111111-1111-4111-8111-111111111111';
const client={
 from:()=>({select(){return this},eq(){return this},async maybeSingle(){return {data:null,error:null}}}),
 auth:{async getUser(){return {data:{user:{id:params.has('different')?'22222222-2222-4222-8222-222222222222':id,email_confirmed_at:'2026-01-01',user_metadata:{kitsnode_signup_draft:{username:'seller_one',name:'Synthetic',phone:'01012345678',company:'Example',ageConfirmed:true}}}},error:null}}},
 async rpc(name:string,input:any){calls.push({name,input});return {data:params.has('taken')?'username_taken':'created',error:null}},
};
createRoot(document.getElementById('root')!).render(<MemberEmailProfile client={client} userId={id} checkUsername={async()=>({ok:true,code:'available'})}/>);
