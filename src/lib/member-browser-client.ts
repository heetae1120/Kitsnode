import {createClient, type SupabaseClient} from '@supabase/supabase-js';
import {readMemberAuthConfig} from './member-auth-config.mjs';
import {createProviderRedactingStorage} from './member-auth-storage.mjs';
import {createProviderCallbackCapture} from './member-provider-callback.mjs';

let client: SupabaseClient | null = null;
let callbackCapture: ReturnType<typeof createProviderCallbackCapture>|null = null;
export function takeNaverProviderCallback(session: unknown) { return callbackCapture?.take(session) ?? null; }
export function memberBrowserClient() {
  const config = readMemberAuthConfig({enabled:process.env.NEXT_PUBLIC_MEMBER_AUTH_ENABLED,projectRef:process.env.NEXT_PUBLIC_MEMBER_AUTH_PROJECT_REF,url:process.env.NEXT_PUBLIC_MEMBER_AUTH_URL,key:process.env.NEXT_PUBLIC_MEMBER_AUTH_PUBLISHABLE_KEY,signup:process.env.NEXT_PUBLIC_MEMBER_AUTH_SIGNUP_ENABLED,naver:process.env.NEXT_PUBLIC_MEMBER_AUTH_NAVER_ENABLED,link:process.env.NEXT_PUBLIC_MEMBER_AUTH_NAVER_LINK_ENABLED});
  if (!config || typeof window === 'undefined' || window.location.protocol !== 'https:') return null;
  if(client)return client;
  // Preserve normal Supabase sessions across tabs while keeping OAuth provider
  // tokens out of persistent browser storage, including legacy sessions.
  let storage:ReturnType<typeof createProviderRedactingStorage>|undefined;
  try{storage=createProviderRedactingStorage(window.localStorage,`sb-${new URL(config.url).hostname.split('.')[0]}-auth-token`)}catch{}
  client=createClient(config.url,config.key,storage?{auth:{storage}}:undefined);
  if(process.env.NEXT_PUBLIC_NAVER_AGREEMENT_ENABLED==='true') callbackCapture=createProviderCallbackCapture(client.auth);
  return client;
}
