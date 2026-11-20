import type {SupabaseClient} from '@supabase/supabase-js';
export function selfWithdrawalAvailable(client:SupabaseClient|null,expectedUserId:string):Promise<boolean>;
export function requestSelfWithdrawal(client:SupabaseClient|null,expectedUserId:string,onComplete?:()=>void):Promise<{ok:boolean;code:string}>;
