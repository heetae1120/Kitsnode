// Read-only anonymous readiness probe; it never accepts sessions, tokens, API
// keys, or email addresses. It does not verify OAuth, delivery, or DB writes.
// Run only after the operator has verified an isolated remote preview and DB.
import {pathToFileURL} from 'node:url';

export async function inspectIsolatedPublic({authOrigin, frontendOrigin, fetchImpl=fetch}) {
  function origin(value) {
    const u=new URL(value);
    if(u.protocol!=='https:' || u.origin!==value || u.username || u.password || u.search || u.hash) throw new Error('Expected an exact HTTPS origin');
    return u.origin;
  }
  const auth=origin(authOrigin), front=origin(frontendOrigin);
  const read=async path=>{
    const response=await fetchImpl(new URL(path,auth),{method:'GET',headers:{origin:front,accept:'application/json'},redirect:'manual',credentials:'omit',signal:AbortSignal.timeout(10000)});
    if(!response.ok || response.redirected || response.headers.get('access-control-allow-origin')!==front || response.headers.get('access-control-allow-credentials')!=='true') throw new Error('Readiness request failed');
    return response.json();
  };
  const docs=await read('/api/member/terms');
  const list=docs?.documents;
  if(!Array.isArray(list) || list.length!==2 || new Set(list.map(d=>d?.type)).size!==2 || !['terms','privacy'].every(type=>list.some(d=>d?.type===type && typeof d.version==='string' && d.version.trim() && typeof d.text==='string' && d.text.trim()))) throw new Error('Document contract invalid');
  // Do not reproduce document text. Require a visible test-only marker in each
  // document before claiming the endpoint belongs to a synthetic setup.
  if(!list.every(d=>/테스트|test|synthetic/i.test(d.text))) throw new Error('Both documents must contain a test-only marker');
  const session=await read('/api/member/session');
  if(session?.authenticated!==false || session?.consented!==false || session?.consentStatus?.terms!==false || session?.consentStatus?.privacy!==false || session?.emailVerified!==false || typeof session?.naverAvailable!=='boolean' || typeof session?.emailVerificationAvailable!=='boolean') throw new Error('Anonymous session contract invalid');
  return {documents:2,anonymous:true,naverAvailable:session.naverAvailable,emailVerificationAvailable:session.emailVerificationAvailable};
}

if (import.meta.url===pathToFileURL(process.argv[1] || '').href) {
  const [ack,authOrigin,frontendOrigin,confirmation]=process.argv.slice(2);
  if(ack!=='--isolated-read-only' || !authOrigin || !frontendOrigin || confirmation!==authOrigin) {
    console.error('Usage: node isolated-public-smoke.mjs --isolated-read-only <auth-origin> <frontend-origin> <repeat-auth-origin>');
    process.exitCode=2;
  } else {
    try {
      const result=await inspectIsolatedPublic({authOrigin,frontendOrigin});
      console.log(`Two test-marked documents: ok; anonymous session: ok; Naver available: ${result.naverAvailable}; email verification available: ${result.emailVerificationAvailable}`);
      console.log('Read-only checks only. OAuth, mailbox delivery, authenticated consent storage and Hyperdrive identity require separate checks.');
    } catch { console.error('Isolated readiness check failed. No response content or credentials were logged.'); process.exitCode=1; }
  }
}
