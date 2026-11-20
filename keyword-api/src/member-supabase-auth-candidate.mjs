// Review-only adapter. No deployment, repository, rate-limit, session ledger,
// or app integration is supplied. A request-scoped public Supabase client is
// created for every operation. This is not safe to expose on its own.
import {randomUUID} from 'node:crypto';

const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const tokenOK = value => typeof value === 'string' && value.length > 0 && value.length <= 8192 && !/\s/.test(value);
function validPublicKey(key) {
  if (typeof key !== 'string') return false;
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return true;
  const parts = key.split('.');
  if (parts.length !== 3 || !parts.every(part => /^[A-Za-z0-9_-]+$/.test(part))) return false;
  try {return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')).role === 'anon';} catch {return false;}
}
function checkedOrigin(value, expected) {
  let u; try {u = new URL(value);} catch {throw new TypeError('invalid_project_url');}
  if (value !== expected || u.origin !== value || u.username || u.password ||
      (u.protocol !== 'https:' && !(u.protocol === 'http:' && ['127.0.0.1','localhost'].includes(u.hostname)))) throw new TypeError('invalid_project_url');
}
function checkedRedirect(value, expected) {
  let u;try{u=new URL(value);}catch{throw new TypeError('invalid_redirect');}
  if (u.origin !== expected || u.username || u.password || u.search || u.hash ||
      (u.protocol !== 'https:' && !(u.protocol === 'http:' && ['127.0.0.1','localhost'].includes(u.hostname)))) throw new TypeError('invalid_redirect');
}

/**
 * createClient is the Supabase SDK factory, not a pre-created client.  The
 * injected active-session authority must independently validate that this
 * token's verified session remains active and bound to the supplied user ID;
 * getUser alone is not this guarantee. revokeExactSession must revoke only
 * the newly issued session and must throw or return false on failure.
 * These two services are NOT provided here; without them construction fails.
 */
export function createMemberSupabaseAuthCandidate({createClient,projectUrl,expectedProjectUrl,publicKey,redirectTo,expectedRedirectOrigin,activeSession,revokeExactSession}) {
  checkedOrigin(projectUrl,expectedProjectUrl);checkedRedirect(redirectTo,expectedRedirectOrigin);
  if (!validPublicKey(publicKey) || typeof createClient !== 'function' || typeof activeSession !== 'function' || typeof revokeExactSession !== 'function') throw new TypeError('invalid_dependencies');
  const clients = new WeakSet();
  function auth() {
    const client = createClient(projectUrl,publicKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,flowType:'implicit'}});
    if (!client || (typeof client !== 'object' && typeof client !== 'function') || clients.has(client) || !client.auth) throw new Error('invalid_request_scoped_client');
    clients.add(client);
    return client.auth;
  }
  async function revokeSession(session) {
    if (!session || !tokenOK(session.access_token)) throw new Error('revocation_unavailable');
    const result=await revokeExactSession({accessToken:session.access_token});
    if (result !== true) throw new Error('revocation_unavailable');
    return true;
  }
  async function verifySession(token) {
    if (!tokenOK(token)) return null;
    try {
      const result=await auth().getUser(token), user=result?.data?.user;
      if (result?.error || !uuid(user?.id) || typeof user.email !== 'string' || user.email.length > 254 || !user.email_confirmed_at ||
          user.app_metadata?.provider !== 'email' || !Array.isArray(user.identities) || !user.identities.some(identity=>identity?.provider==='email')) return null;
      // The authority must verify session_id and its subject on the server.
      if (await activeSession({accessToken:token,expectedUserId:user.id}) !== true) return null;
      return {id:user.id,email:user.email,emailConfirmed:true,emailProvider:true};
    } catch {return null;}
  }
  return {
    async signUp({email,password,evidence}) {
      if (typeof email !== 'string' || typeof password !== 'string' || !evidence || evidence.termsAccepted !== true || evidence.privacyAcknowledged !== true ||
          typeof evidence.termsVersion !== 'string' || typeof evidence.privacyVersion !== 'string') return {accepted:false};
      let result;try{result=await auth().signUp({email,password,options:{emailRedirectTo:redirectTo,data:{kitsnode_consent:{termsVersion:evidence.termsVersion,privacyVersion:evidence.privacyVersion,termsAccepted:true,privacyAcknowledged:true}}}});}catch{return {accepted:false};}
      // Never lose a session issued unexpectedly even on a partial error; the
      // caller must invoke revokeSession and treat the response as unavailable.
      if (result?.data?.session) return {accepted:false,session:result.data.session};
      if (result?.error?.code === 'user_already_exists') return {accepted:true,userId:randomUUID()};
      if (result?.error || !uuid(result?.data?.user?.id)) return {accepted:false};
      return {accepted:true,userId:result.data.user.id};
    },
    async signInWithPassword({email,password}) {
      if (typeof email !== 'string' || typeof password !== 'string') return null;
      let result;try{result=await auth().signInWithPassword({email,password});}catch{return null;}
      const session=result?.data?.session;
      if (!session) return null;
      const user=await verifySession(session.access_token);
      if (result.error || !user || !tokenOK(session.refresh_token)) {
        await revokeSession(session); // Do not swallow revoke failure.
        return null;
      }
      return {user,session:{access_token:session.access_token,refresh_token:session.refresh_token}};
    },
    verifySession,
    revokeSession,
  };
}
