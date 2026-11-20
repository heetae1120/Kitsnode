import React from 'react';
import {createRoot} from 'react-dom/client';
import {EmailAuthForm} from '../../src/components/store/member-email-auth-form';

type Result = {ok:boolean;code:string};
type Pending = {username:string;resolve:(result:Result)=>void};
const pending:Pending[] = [];
const registrations:unknown[] = [];
const signupFixture={pending,registrations,manual:false,resolve:(index:number,result:Result)=>pending[index].resolve(result)};
Object.assign(window, {signupFixture});
const denied = async () => ({ok:false,code:'unavailable'});
const auth = {signUp:denied,signIn:denied,signOut:denied,requestPasswordReset:denied,updatePassword:denied};
createRoot(document.getElementById('root')!).render(<EmailAuthForm auth={auth} initialMode="signup" allowSignup signupVariant="extended"
 signupConsent={{terms:{href:'/terms/',version:'v1'},privacy:{href:'/privacy/',version:'v1'},register:denied}}
 extendedSignup={{checkUsername:username=>new Promise(resolve=>pending.push({username,resolve})),register:async input=>{registrations.push(input);return {ok:true,code:signupFixture.manual?'signup_requested_manual':'signup_requested'};}}}/>);
