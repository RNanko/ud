import { neon, Pool, neonConfig } from '@neondatabase/serverless';

export const QA_DATABASE = 'qa_tablename';
export const QA_ROLE = 'manforth_mobile_qa';
export function assertQaIdentity(row) {
  if (!row || row.database !== QA_DATABASE || row.role !== QA_ROLE || !row.login || row.superuser || row.create_database || row.create_role || row.replication || row.bypass_rls || row.memberships || row.database_owner || row.create_schema || row.create_database_objects) {
    throw Error('QA identity/permissions are not restricted to the expected runtime role and database.');
  }
}
export async function verifyQaConnection(connection) {
  const url = new URL(connection);
  if (decodeURIComponent(url.pathname.slice(1)) !== QA_DATABASE || decodeURIComponent(url.username) !== QA_ROLE) throw Error('Use the dedicated QA runtime connection.');
  const sql = neon(connection);
  const rows = await sql.query(`SELECT current_database() AS database,current_user AS role,
    r.rolcanlogin AS login,r.rolsuper AS superuser,r.rolcreatedb AS create_database,r.rolcreaterole AS create_role,
    r.rolreplication AS replication,r.rolbypassrls AS bypass_rls,
    EXISTS(SELECT 1 FROM pg_auth_members WHERE member=r.oid) AS memberships,
    d.datdba=r.oid AS database_owner,has_schema_privilege(current_user,'public','CREATE') AS create_schema,
    has_database_privilege(current_user,current_database(),'CREATE') AS create_database_objects
    FROM pg_roles r JOIN pg_database d ON d.datname=current_database() WHERE r.rolname=current_user`);
  assertQaIdentity(rows[0]);
  neonConfig.webSocketConstructor = globalThis.WebSocket;
  const pool = new Pool({ connectionString: connection, connectionTimeoutMillis: 10000 });
  try {
    const identity = (await pool.query('SELECT current_database() AS database,current_user AS role')).rows[0];
    if (identity.database !== QA_DATABASE || identity.role !== QA_ROLE) throw Error('QA transactional transport identity differs.');
  } finally { await pool.end(); }
  return { database: QA_DATABASE, role: QA_ROLE, http: true, websocket: true };
}
