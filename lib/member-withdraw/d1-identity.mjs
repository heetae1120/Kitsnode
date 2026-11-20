const valid=s=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
// Candidate for the intranet's server-to-server endpoint. This covers identity
// records and permissions, not all owner-scoped work, files, or other stores.
export function createD1IdentityAdapter(db,{now=Date.now}={}) {
 if(!db?.prepare||!db?.batch)throw Error('invalid_db');
 const guard='EXISTS(SELECT 1 FROM member_self_deletion_blocks WHERE subject=? AND request_id=?)';
 async function setup(){
  await db.prepare('CREATE TABLE IF NOT EXISTS member_self_deletion_blocks(subject TEXT PRIMARY KEY NOT NULL,request_id TEXT UNIQUE NOT NULL,created_at INTEGER NOT NULL)').run();
  await db.prepare("CREATE TRIGGER IF NOT EXISTS member_self_deletion_approval_insert BEFORE INSERT ON employee_approvals WHEN EXISTS(SELECT 1 FROM member_self_deletion_blocks WHERE subject=NEW.subject) BEGIN SELECT RAISE(ABORT,'account_deletion_in_progress'); END").run();
  await db.prepare("CREATE TRIGGER IF NOT EXISTS member_self_deletion_approval_update BEFORE UPDATE OF status ON employee_approvals WHEN NEW.status<>'revoked' AND EXISTS(SELECT 1 FROM member_self_deletion_blocks WHERE subject=NEW.subject) BEGIN SELECT RAISE(ABORT,'account_deletion_in_progress'); END").run();
 }
 async function reserved(subject,requestId){return !!(await db.prepare('SELECT 1 ok FROM member_self_deletion_blocks WHERE subject=? AND request_id=?').bind(subject,requestId).first())}
 return {
  async block({subject,requestId}){
   if(!valid(subject)||!valid(requestId))return false;
   try {await setup();await db.batch([
    db.prepare('INSERT INTO member_self_deletion_blocks(subject,request_id,created_at) VALUES(?,?,?) ON CONFLICT(subject) DO NOTHING').bind(subject,requestId,now()),
    db.prepare(`UPDATE employee_approvals SET status='revoked',reviewed_at=?,reviewed_by=NULL WHERE subject=? AND ${guard}`).bind(now(),subject,subject,requestId),
    db.prepare(`DELETE FROM employee_office_sessions WHERE subject=? AND ${guard}`).bind(subject,subject,requestId),
    db.prepare(`UPDATE secretary_memberships SET status='revoked' WHERE subject=? AND ${guard}`).bind(subject,subject,requestId),
    db.prepare(`UPDATE secretary_runner_grants SET revoked_at=? WHERE subject=? AND revoked_at IS NULL AND ${guard}`).bind(now(),subject,subject,requestId),
    db.prepare(`UPDATE secretary_plan_runner_registrations SET revoked_at=? WHERE subject=? AND revoked_at IS NULL AND ${guard}`).bind(now(),subject,subject,requestId),
    db.prepare(`UPDATE secretary_runner_issuance_approvals SET status='revoked' WHERE subject=? AND ${guard}`).bind(subject,subject,requestId),
    db.prepare(`UPDATE virtual_runner_grants SET revoked_at=? WHERE owner=? AND revoked_at IS NULL AND ${guard}`).bind(now(),'employee:'+subject,subject,requestId)
   ]);return await reserved(subject,requestId)}catch{return false}
  },
  async cleanupIdentity({subject,requestId}){
   if(!valid(subject)||!valid(requestId))return false;
   try {if(!await reserved(subject,requestId))return false;const tables=['employee_avatars','employee_office_sessions','employee_signup_applications','employee_password_resets','employee_profiles','employee_identity_links','secretary_memberships','secretary_runner_grants','secretary_plan_runner_registrations','secretary_runner_issuance_approvals','employee_approvals'];
    const ops=tables.map(table=>db.prepare(`DELETE FROM ${table} WHERE subject=? AND ${guard}`).bind(subject,subject,requestId));
    ops.push(db.prepare(`DELETE FROM employee_weekly_hermes_pilot WHERE owner_subject=? AND ${guard}`).bind(subject,subject,requestId));
    ops.push(db.prepare(`UPDATE employee_approvals SET reviewed_by=NULL WHERE reviewed_by=? AND ${guard}`).bind(subject,subject,requestId));
    await db.batch(ops);
    for(const table of tables){if(await db.prepare(`SELECT 1 present FROM ${table} WHERE subject=? LIMIT 1`).bind(subject).first())return false}
    if(await db.prepare('SELECT 1 present FROM employee_weekly_hermes_pilot WHERE owner_subject=? LIMIT 1').bind(subject).first())return false;
    if(await db.prepare('SELECT 1 active FROM virtual_runner_grants WHERE owner=? AND revoked_at IS NULL LIMIT 1').bind('employee:'+subject).first())return false;
    return await reserved(subject,requestId);
   }catch{return false}
  },
  async verifyIdentity({subject,requestId}){
   if(!valid(subject)||!valid(requestId))return false;
   try {
    if(!await reserved(subject,requestId))return false;
    const tables=['employee_avatars','employee_office_sessions','employee_signup_applications','employee_password_resets','employee_profiles','employee_identity_links','secretary_memberships','secretary_runner_grants','secretary_plan_runner_registrations','secretary_runner_issuance_approvals','employee_approvals'];
    for(const table of tables)if(await db.prepare(`SELECT 1 present FROM ${table} WHERE subject=? LIMIT 1`).bind(subject).first())return false;
    if(await db.prepare('SELECT 1 present FROM employee_approvals WHERE reviewed_by=? LIMIT 1').bind(subject).first())return false;
    if(await db.prepare('SELECT 1 present FROM employee_weekly_hermes_pilot WHERE owner_subject=? LIMIT 1').bind(subject).first())return false;
    if(await db.prepare('SELECT 1 present FROM virtual_runner_grants WHERE owner=? AND revoked_at IS NULL LIMIT 1').bind('employee:'+subject).first())return false;
    return true;
   }catch{return false}
  }
 };
}
