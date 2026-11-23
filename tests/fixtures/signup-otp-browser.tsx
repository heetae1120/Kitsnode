import React from 'react';
import {createRoot} from 'react-dom/client';
import {EmailAuthForm} from '../../src/components/store/member-email-auth-form';
const calls:{action:string;email?:string;code?:string}[]=[];(window as any).otpCalls=calls;
const auth={signUp:async()=>({ok:true,code:'signup_requested'}),signIn:async()=>({ok:false,code:'unavailable'}),signOut:async()=>({ok:true,code:'signed_out'}),requestPasswordReset:async()=>({ok:true,code:'reset_requested'}),updatePassword:async()=>({ok:true,code:'password_updated'}),verifySignupCode:async(email:string,code:string)=>{calls.push({action:'verify',email,code});return code==='123456'?{ok:true,code:'email_verified'}:{ok:false,code:'invalid_code'}},resendSignupCode:async(email:string)=>{calls.push({action:'resend',email});return {ok:true,code:'signup_code_resent'}}};
const consent={terms:{href:'/terms/',version:'v1'},privacy:{href:'/privacy/',version:'v1'},register:async()=>({ok:true,code:'signup_requested'})};
createRoot(document.getElementById('root')!).render(<EmailAuthForm auth={auth} initialMode="signup" allowSignup signupConsent={consent} checkUsername={async()=>({ok:true,code:'available'})}/>);
