import React from 'react';import {createRoot} from 'react-dom/client';import type {SupabaseClient} from '@supabase/supabase-js';
import {MemberWithdrawTrial} from '../../src/components/store/member-withdraw-trial';
declare global {interface Window {trialCalls:string[]}}
window.trialCalls=[];
const session={access_token:'synthetic-token',user:{id:'test'}};
const client={auth:{onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),getSession:async()=>({data:{session}}),getUser:async()=>({data:{user:{id:'test'}}}),signOut:async()=>{}},functions:{invoke:async(name:string,options:{method:string})=>{window.trialCalls.push(name+':'+options.method);return {data:options.method==='GET'?{available:true}:{status:'complete'}}}}};
createRoot(document.getElementById('root')!).render(<MemberWithdrawTrial testClient={client as unknown as SupabaseClient}/>);
