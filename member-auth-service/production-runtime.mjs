import {createNaverMemberAuth} from './auth.mjs';
import {createPostgresSupport} from './postgres-support.mjs';
import {createPostgresMemberApp} from './app.mjs';
import {createSensMailSender} from './mail.mjs';

// Dependency injection keeps DB connections, secrets and HTTP transport out of
// the auth core. No environment variables are read, migrations run, or server started.
export async function createProductionMemberHandler({database, pool, authOrigin, secret, frontendOrigins, callbackURLs, terms, documents, naver, sens, emailAvailable = true, fetchImpl = fetch, accountLimit, cloudflareClientIP = false, naverIdentityLookup}) {
  if (!Array.isArray(callbackURLs) || callbackURLs.length === 0) throw new Error('Frontend callbacks required');
  if (!Array.isArray(documents)) throw new Error('Separate consent documents required');
  const store = createPostgresSupport(pool);
  if (typeof emailAvailable !== 'boolean') throw new Error('Invalid email setting');
  const sendMail = emailAvailable ? createSensMailSender({...sens,authBaseURL:authOrigin,redirectOrigins:frontendOrigins,fetchImpl}) : async () => { throw new Error('Email authentication is disabled'); };
  const {auth,handle} = createNaverMemberAuth({database,baseURL:authOrigin,secret,trustedOrigins:frontendOrigins,sendMail,naver,claimState:digest=>store.claimState(digest),fetchImpl,cloudflareClientIP});
  // Preserve Better Auth API while ensuring OAuth callbacks go through provider state wrapper.
  return createPostgresMemberApp({auth:{api:auth.api,handler:handle},pool,documents,allowedOrigins:frontendOrigins,naverCallbackURLs:callbackURLs,emailAvailable,accountLimit,naverIdentityLookup});
}
