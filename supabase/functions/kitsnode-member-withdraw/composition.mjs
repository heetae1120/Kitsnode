import {createSelfSupabaseAdapter} from './supabase-adapter.mjs';
import {createSelfWithdrawalWorkflow} from './workflow.mjs';
// Staff identity and permissions are removed; company-owned work and Gmail are preserved.
export function createSelfWithdrawalComposition({supabase,intent,staff}) {
 if(typeof staff?.block!=='function'||typeof staff?.cleanupIdentity!=='function'||typeof staff?.verifyIdentity!=='function')throw Error('invalid_staff');
 const db=createSelfSupabaseAdapter(supabase);
 return createSelfWithdrawalWorkflow({intent,
  blockAccess:async ctx=>await db.blockAccess(ctx)&&await staff.block(ctx),
  stopAds:ctx=>db.stopAds(ctx),
  deleteRelated:async ctx=>await db.cleanupDatabase(ctx)&&await staff.cleanupIdentity(ctx),
  deleteAuth:ctx=>db.deleteAuth(ctx),
  verifyAbsent:async ctx=>await db.verifyDatabase(ctx)&&await staff.verifyIdentity(ctx)
 });
}
