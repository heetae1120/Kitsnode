import type {AuthClient} from '@supabase/supabase-js';
export function naverIdentityState(user: {id?: string; email_confirmed_at?: string | null; identities?: Array<{provider?: string}>} | null | undefined): {linked:boolean;canLinkEmail:boolean};
export function oauthCallbackError(value:string): 'identity_conflict' | 'cancelled' | 'unavailable' | null;
export function createNaverAuth(options:{auth:AuthClient;redirectTo:string;trustedOrigin:string;allowSignIn:boolean;allowLink:boolean}):{signIn():Promise<{ok:boolean;code:string}>;link():Promise<{ok:boolean;code:string}>};
