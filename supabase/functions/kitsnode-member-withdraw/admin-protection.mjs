const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
// Current KITSNODE advertising operator configuration; unknown configuration is
// denied. User-editable metadata is never used for authorization.
export function createAdminProtection({operatorIds}){
 const ids=typeof operatorIds==='string'?operatorIds.split(',').map(x=>x.trim().toLowerCase()).filter(Boolean):[];
 if(!ids.length||!ids.every(uuid)||new Set(ids).size!==ids.length)throw Error('protected_admin_configuration_required');
 const isProtected=user=>{
  if(!uuid(user?.id))throw Error('invalid_user');
  const metadata=user.app_metadata??{},roles=Array.isArray(metadata.roles)?metadata.roles:[];
  return ids.includes(user.id.toLowerCase())||metadata.role==='admin'||metadata.admin===true||roles.includes('admin');
 };
 isProtected.registryEvidence=async()=>({p_operator_ids:ids});
 return isProtected;
}
