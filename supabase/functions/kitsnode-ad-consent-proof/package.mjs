// Portable deployment bundle for the Supabase MCP deploy_edge_function API.
// Only proof-service dependencies are included; this does not deploy them.
import {readFile} from 'node:fs/promises';
const base=new URL('.',import.meta.url),consent=new URL('../kitsnode-ad-consent-api/',base),shared=new URL('../kitsnode-ad-api/src/',base);
export async function proofFiles(){
 const index=(await readFile(new URL('index.ts',base),'utf8')).replaceAll('../kitsnode-ad-consent-api/','./consent/');
 const factory=(await readFile(new URL('factory.mjs',base),'utf8')).replaceAll('../kitsnode-ad-consent-api/','./consent/').replaceAll('../kitsnode-ad-api/src/','./shared/');
 const consentNames=['disclosure-config.mjs','supabase-store.mjs','supabase-proof-store-candidate.mjs','consent-proof-server-candidate.mjs','consent-proof-bridge.mjs','proof-http-candidate.mjs'];
 const sharedNames=['invite-active-session.mjs','shared-rate-limit.mjs'];
 return [{name:'index.ts',content:index},{name:'factory.mjs',content:factory},...await Promise.all(consentNames.map(async name=>({name:`consent/${name}`,content:await readFile(new URL(name,consent),'utf8')}))),...await Promise.all(sharedNames.map(async name=>({name:`shared/${name}`,content:await readFile(new URL(name,shared),'utf8')})))];
}
