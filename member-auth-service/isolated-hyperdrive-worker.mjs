// Temporary Hyperdrive preview; synthetic inserts are rolled back immediately.
import pg from 'pg';
export default {
 async fetch(request,env) {
  if(request.method!=='GET'||new URL(request.url).pathname!=='/probe'||!env.TEST_PROBE_SECRET||request.headers.get('authorization')!==`Bearer ${env.TEST_PROBE_SECRET}`)return new Response(null,{status:404});
  let pool;
  try {
   if(!env.TEST_HYPERDRIVE?.connectionString)throw Error('missing binding');
   pool=new pg.Pool({connectionString:env.TEST_HYPERDRIVE.connectionString,max:2,connectionTimeoutMillis:10000});
   const r=await pool.query(`SELECT current_user AS role,
    has_schema_privilege(current_user,'kitsnode_auth_test','USAGE') AS test_schema,
    has_schema_privilege(current_user,'member_auth','USAGE') AS production_auth,
    has_schema_privilege(current_user,'member_auth_support','USAGE') AS production_support,
    has_table_privilege(current_user,'kitsnode_auth_test.document_consents','INSERT') AS insert_consent`);
   const x=r.rows?.[0];
   if(r.rows.length!==1||x.role!=='kitsnode_auth_test_runtime'||!x.test_schema||x.production_auth||x.production_support||!x.insert_consent)throw Error('invalid role');
   const versions=await pool.query('SELECT document_type,version FROM kitsnode_auth_test.document_current ORDER BY document_type');
   if(versions.rows.length!==2)throw Error('test documents missing');
   const client=await pool.connect();
   try{
    await client.query('BEGIN');
    await client.query("INSERT INTO kitsnode_auth_test.document_consents(user_id,document_type,version) SELECT 'synthetic-hyperdrive-probe', document_type,version FROM kitsnode_auth_test.document_current");
    const result=await client.query("SELECT count(*)::int AS n FROM kitsnode_auth_test.document_consents WHERE user_id='synthetic-hyperdrive-probe'");
    if(result.rows[0]?.n!==2)throw Error('test insert failed');
    await client.query('ROLLBACK');
   }catch(e){await client.query('ROLLBACK').catch(()=>{});throw e;}finally{client.release();}
   return Response.json({ok:true,restrictedRole:true,documents:versions.rows.length,consentsInsertedAndRolledBack:2},{headers:{'cache-control':'no-store'}});
  }catch{return Response.json({error:'unavailable'},{status:503,headers:{'cache-control':'no-store'}})}
  finally{if(pool)await pool.end().catch(()=>{});}
 }
};
