import type {SupabaseClient} from '@supabase/supabase-js';
export function trialWithdrawalAvailable(client:SupabaseClient|null,expectedUserId:string):Promise<boolean>;
export function requestTrialWithdrawal(client:SupabaseClient|null,expectedUserId:string,onComplete?:()=>void):Promise<{ok:boolean;code:string}>;
