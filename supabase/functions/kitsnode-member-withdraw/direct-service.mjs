// The operator list is server configuration; the caller cannot supply it.
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
export function createDirectWithdrawal({supabase,readOperators}) {
 if(typeof supabase?.rpc!=='function'||typeof readOperators!=='function')throw Error('invalid_configuration');
 return async subject=>{
  try {
   const raw=readOperators();
   const operators=typeof raw==='string'?raw.split(',').map(x=>x.trim().toLowerCase()).filter(Boolean):[];
   if(!uuid(subject)||!operators.length||!operators.every(uuid)||new Set(operators).size!==operators.length||raw!==readOperators())return {status:'pending'};
   const {data,error}=await supabase.rpc('kits_customer_withdraw_direct',{p_subject:subject,p_operator_ids:operators});
   if(!error&&['complete','admin_protected','protected_reference'].includes(data))return {status:data};
   return {status:'pending'};
  }catch{return {status:'pending'}}
 };
}
