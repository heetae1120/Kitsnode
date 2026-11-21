import React from 'react';
import {createRoot} from 'react-dom/client';
import {EmailAuthForm} from '../../src/components/store/member-email-auth-form';
let calls=0;let resolve:((result:{ok:boolean;code:string})=>void)|undefined;
const fn=async()=>({ok:false,code:'disabled'});
const auth={signUp:fn,signOut:fn,requestPasswordReset:fn,updatePassword:fn,signIn:async()=>{calls++;return new Promise<{ok:boolean;code:string}>(r=>{resolve=r;});}};
Object.assign(window,{formFixture:{calls:()=>calls,finish:()=>resolve?.({ok:false,code:'sign_in_failed'})}});
createRoot(document.getElementById('root')!).render(<EmailAuthForm auth={auth}/>);
