// Disabled unless explicitly configured after the exact published documents,
// approved Naver app and verified provider-token identity mapping are confirmed.
// @ts-ignore Deno resolves npm specifiers in Edge Functions.
import {createClient} from 'npm:@supabase/supabase-js@2.119.0';
import {createNaverAgreementHandler} from '../_shared/naver-agreement-handler.mjs';
import {createNaverAuthContext} from './auth-context.mjs';
declare const Deno:{env:{get(name:string):string|undefined};serve(handler:(request:Request)=>Promise<Response>):void};
const env=(name:string)=>{const v=Deno.env.get(name);if(!v)throw Error('missing_configuration');return v};
function configure(){
 if(Deno.env.get('KITS_NAVER_AGREEMENT_ENABLED')!=='true')throw Error('disabled');
 const url=env('SUPABASE_URL');if(url!=='https://bjpguxwqxlsteektkhwf.supabase.co')throw Error('invalid_project');
 const service=env('SUPABASE_SERVICE_ROLE_KEY'),anon=env('SUPABASE_ANON_KEY');if(service===anon)throw Error('invalid_auth');
 const opts={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
 const admin=createClient(url,service,opts),authClient=createClient(url,anon,opts);
 const clientId=env('KITS_NAVER_CLIENT_ID'),termsVersion=env('KITS_NAVER_TERMS_VERSION'),privacyVersion=env('KITS_NAVER_PRIVACY_VERSION');
 const requiredTermCodes=[env('KITS_NAVER_TERMS_CODE'),env('KITS_NAVER_PRIVACY_CODE')];
 return createNaverAgreementHandler({origin:'https://heetae1120.github.io',clientId,termsVersion,privacyVersion,requiredTermCodes,
  authenticate:createNaverAuthContext({authClient}),
  recordEvidence:async(e:any)=>{const {data,error}=await admin.rpc('kits_naver_agreement_record_candidate',{p_user:e.userId,p_session:e.sessionId,p_naver_subject:e.naverSubject,p_terms_version:e.termsVersion,p_privacy_version:e.privacyVersion,p_client_id:e.clientId,p_agreements:e.agreements});return !error&&data===true;}
 });
}
Deno.serve(async request=>{try{return await configure()(request)}catch{return Response.json({ok:false,code:'unavailable'},{status:503,headers:{'cache-control':'no-store'}})}});
