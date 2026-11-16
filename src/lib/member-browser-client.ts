import {createClient, type SupabaseClient} from '@supabase/supabase-js';
import {readMemberAuthConfig} from './member-auth-config.mjs';

let client: SupabaseClient | null = null;
export function memberBrowserClient() {
  const config = readMemberAuthConfig({enabled:process.env.NEXT_PUBLIC_MEMBER_AUTH_ENABLED,projectRef:process.env.NEXT_PUBLIC_MEMBER_AUTH_PROJECT_REF,url:process.env.NEXT_PUBLIC_MEMBER_AUTH_URL,key:process.env.NEXT_PUBLIC_MEMBER_AUTH_PUBLISHABLE_KEY,signup:process.env.NEXT_PUBLIC_MEMBER_AUTH_SIGNUP_ENABLED,naver:process.env.NEXT_PUBLIC_MEMBER_AUTH_NAVER_ENABLED,link:process.env.NEXT_PUBLIC_MEMBER_AUTH_NAVER_LINK_ENABLED});
  if (!config || typeof window === 'undefined' || window.location.protocol !== 'https:') return null;
  return client ??= createClient(config.url,config.key);
}
