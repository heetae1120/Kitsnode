// Isolated deployment candidate. Not deployed, and does not mutate the current
// kitsnode-ad-api. Serve only the consent recording route; invitation reserve
// and external send remain disabled until a trusted extension bridge exists.
// @ts-ignore Supabase Edge resolves npm packages at runtime.
import {createClient} from 'npm:@supabase/supabase-js@2.119.0';
import {createActiveSessionVerifier} from '../kitsnode-ad-api/src/invite-active-session.mjs';
import {createInviteConsentService} from '../kitsnode-ad-api/src/invite-consent-service.mjs';
import {createInviteConsentHttp} from '../kitsnode-ad-api/src/invite-consent-http.mjs';
import {createMemberEligibility} from '../kitsnode-ad-api/src/member-eligibility.mjs';
import {createSharedRateLimiter} from '../kitsnode-ad-api/src/shared-rate-limit.mjs';
import {createSupabaseConnectionStore} from '../kitsnode-ad-api/src/supabase-connection-store.mjs';
import {createSupabaseInviteStore} from './supabase-store.mjs';
declare const Deno:{env:{get(x:string):string|undefined};serve(f:(r:Request)=>Promise<Response>):void};
const e=(k:string)=>Deno.env.get(k)||'',url=e('SUPABASE_URL'),anon=e('SUPABASE_ANON_KEY'),secret=e('SUPABASE_SERVICE_ROLE_KEY'),version=e('KITS_INVITE_CONSENT_VERSION'),digest=e('KITS_INVITE_POLICY_DIGEST');
if(url!=='https://bjpguxwqxlsteektkhwf.supabase.co'||!anon||!secret||anon===secret||!version||!digest)throw Error('invalid_configuration');
const opts={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const authClient=createClient(url,anon,opts),serviceClient=createClient(url,secret,opts),store=createSupabaseInviteStore(serviceClient);
const verifySession=createActiveSessionVerifier({authClient,isActive:store.isActive});
const service=createInviteConsentService({verifySession,store,newId:()=>crypto.randomUUID(),consentVersion:version,policyDigest:digest});
const handler=createInviteConsentHttp({allowedOrigins:['https://heetae1120.github.io'],verifySession,memberAllowed:createMemberEligibility(serviceClient,{termsVersion:'2026-11-14',privacyVersion:'2026-11-14-naver'}),allowRequest:createSharedRateLimiter(serviceClient),listOwned:createSupabaseConnectionStore(serviceClient).listOwned,service});
Deno.serve(req=>{const u=new URL(req.url),base='/kitsnode-ad-consent-api';if(!u.pathname.endsWith(base+'/invite-consents'))return Promise.resolve(new Response(null,{status:404}));return handler(new Request(`https://internal.invalid/api/invite-consents${u.search}`,req));});
