import {createMemberDeleteHandler} from './handler.mjs';
// Wiring candidate only. The private RPC must be exposed safely to the service
// client, and a shared limiter must be supplied. Neither is provisioned here.
export function createSupabaseMemberDeleteCandidate({enabled=false,allowedOrigins,authClient,serviceClient,allowRequest}) {
 if(typeof authClient?.auth?.getUser!=='function'||typeof serviceClient?.auth?.admin?.deleteUser!=='function'||typeof serviceClient?.rpc!=='function'||typeof allowRequest!=='function')throw Error('Invalid dependencies');
 return createMemberDeleteHandler({enabled,allowedOrigins,allowRequest,
  verifySession:async token=>{
   const {data,error}=await authClient.auth.getUser(token);
   if(error){if(error.status===401||error.status===403)return null;throw Error('Auth unavailable');}
   return data?.user??null;
  },
  deleteMember:async userId=>{
   const check=await serviceClient.rpc('kitsnode_delete_member_precheck',{p_user_id:userId});
   if(check.error||typeof check.data!=='boolean')throw Error('Precheck unavailable');
   if(check.data)return 'blocked';
   const {error}=await serviceClient.auth.admin.deleteUser(userId);
   if(error)throw Error('Deletion unavailable');
   return 'deleted';
  }
 });
}
