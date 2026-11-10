// Probe an isolated, explicitly created HTTPS gateway endpoint that returns
// only synthetic cookies; never point at the real login or send credentials.
import {pathToFileURL} from 'node:url';
export function verifyProbeCookies(response) {
  const cookies=response.headers.getSetCookie();
  const names=cookies.map(value=>value.split(';',1)[0]);
  return response.status===200 && cookies.length===2 && names.includes('kits_probe_a=1') && names.includes('kits_probe_b=2');
}
export async function probe(endpoint, fetchImpl=fetch) {
  const u=new URL(endpoint);
  if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash) throw new Error('A clean HTTPS probe URL is required');
  const response=await fetchImpl(u,{redirect:'error',signal:AbortSignal.timeout(10000),headers:{'cache-control':'no-store'}});
  return verifyProbeCookies(response);
}
if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  try { if (!await probe(process.argv[2])) throw new Error('Probe failed'); console.log('Two separate synthetic cookies were received.'); }
  catch { console.error('Cookie probe failed or endpoint is invalid.'); process.exitCode=1; }
}
