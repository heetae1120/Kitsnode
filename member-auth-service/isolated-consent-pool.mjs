// Test-only adapter for the document consent store. The underlying database
// role must itself be restricted; SQL rewriting is not an access boundary.
const TEST_ROLE = 'kitsnode_auth_test_runtime';

export async function createIsolatedConsentPool(pool) {
  if (!pool?.query || !pool?.connect) throw new Error('Test pool required');
  const check = await pool.query(`SELECT current_user AS role,
    has_schema_privilege(current_user, 'kitsnode_auth_test', 'USAGE') AS test_schema,
    has_schema_privilege(current_user, 'member_auth', 'USAGE') AS auth_schema,
    has_schema_privilege(current_user, 'member_auth_support', 'USAGE') AS support_schema,
    has_table_privilege(current_user, 'kitsnode_auth_test.document_consents', 'INSERT') AS insert_consent,
    has_table_privilege(current_user, 'kitsnode_auth_test.document_current', 'UPDATE') AS update_current`);
  const row=check.rows?.[0];
  if (check.rows?.length!==1 || row.role!==TEST_ROLE || row.test_schema!==true || row.auth_schema!==false || row.support_schema!==false || row.insert_consent!==true || row.update_current!==false) throw new Error('Test database role or privileges invalid');
  const rewrite = sql => {
    if (typeof sql !== 'string') throw new Error('Only parameterized test queries are allowed');
    // The test role cannot access the real schema, even if this check fails.
    return sql.replaceAll('member_auth_support.', 'kitsnode_auth_test.')
      .replaceAll('149909178437', '149909178537')
      .replaceAll('149909178438', '149909178538');
  };
  return {
    query(sql, values) { return pool.query(rewrite(sql), values); },
    async connect() {
      const client=await pool.connect();
      return { query(sql, values) {return client.query(rewrite(sql), values);}, release() {client.release();} };
    }
  };
}
