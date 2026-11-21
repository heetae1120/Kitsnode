// Disabled deployment candidate. This function does not grant account access.
// @ts-ignore Supabase Edge resolves pinned npm packages at runtime.
import {createClient} from 'npm:@supabase/supabase-js@2.119.0';
import {createExecutionProofHandler} from './factory.mjs';
import {INVITE_CONSENT_VERSION,INVITE_CONSENT_DIGEST} from '../kitsnode-ad-consent-api/disclosure-config.mjs';
declare const Deno:{env:{get(x:string):string|undefined};serve(f:(r:Request)=>Promise<Response>):void};
const e=(k:string)=>Deno.env.get(k)||'';
const url=e('SUPABASE_URL'),anon=e('SUPABASE_ANON_KEY'),secret=e('SUPABASE_SERVICE_ROLE_KEY'),extensionId=e('KITS_INVITE_EXTENSION_ID');
if(url!=='https://bjpguxwqxlsteektkhwf.supabase.co'||!anon||!secret||anon===secret||!/^[a-p]{32}$/.test(extensionId))throw Error('invalid_configuration');
const opts={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const authClient=createClient(url,anon,opts),serviceClient=createClient(url,secret,opts);
Deno.serve(createExecutionProofHandler({authClient,serviceClient,extensionId,consentVersion:INVITE_CONSENT_VERSION,consentDigest:INVITE_CONSENT_DIGEST}));
