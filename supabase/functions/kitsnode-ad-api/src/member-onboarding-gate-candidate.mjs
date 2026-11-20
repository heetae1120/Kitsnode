// REVIEW ONLY: not wired into an API, RLS policy, or operational configuration.
// readServerMembership must read a server-controlled record, never user metadata.
// A trusted, validated Auth subject and current consent are separate requirements.
// Separate reads can race with withdrawal or consent changes. Privileged writes
// must recheck both inside their own transaction; this candidate is not a DB
// gate and does not protect direct service calls, RLS, workers, or Storage.
// Legacy and Naver statuses require an audited server-side migration; never
// infer them from a client claim or timestamp alone.
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const allowed=new Set(['completed','verified_legacy','verified_naver']);

export function createMemberOnboardingGateCandidate({currentConsent,readServerMembership}) {
  if(typeof currentConsent!=='function'||typeof readServerMembership!=='function') throw new TypeError('invalid_dependencies');
  return async function memberAllowed(subject) {
    if(typeof subject!=='string'||!UUID.test(subject)) return false;
    try {
      if(await currentConsent(subject)!==true) return false;
      const record=await readServerMembership(subject);
      return Boolean(record && record.userId===subject && allowed.has(record.status));
    } catch {return false;}
  };
}
