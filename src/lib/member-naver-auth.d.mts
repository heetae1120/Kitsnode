import type {AuthClient} from '@supabase/supabase-js';
export function createNaverAuth(options:{auth:AuthClient;redirectTo:string;trustedOrigin:string;allowSignIn:boolean;allowLink:boolean}):{signIn():Promise<{ok:boolean;code:string}>;link():Promise<{ok:boolean;code:string}>};
