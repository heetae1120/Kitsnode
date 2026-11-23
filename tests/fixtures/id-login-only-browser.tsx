import React from 'react';
import {createRoot} from 'react-dom/client';
import {EmailAuthForm} from '../../src/components/store/member-email-auth-form';
const calls:{action:string;value?:unknown}[]=[];(window as any).loginCalls=calls;
const auth={signUp:async()=>({ok:false,code:'unavailable'}),signIn:async(email:string)=>{calls.push({action:'email',value:email});return {ok:true,code:'signed_in'}},signOut:async()=>({ok:true,code:'signed_out'}),requestPasswordReset:async(email:string)=>{calls.push({action:'reset',value:email});return {ok:true,code:'reset_requested'}},updatePassword:async()=>({ok:true,code:'password_updated'})};
const signIn=async(username:string)=>{calls.push({action:'username',value:username});return {ok:true,code:'signed_in'}};
const disabled=new URLSearchParams(location.search).has('disabled');
createRoot(document.getElementById('root')!).render(<EmailAuthForm auth={auth} usernameSignIn={disabled?undefined:signIn}/>);
