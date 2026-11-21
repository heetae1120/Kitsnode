import {readFile} from 'node:fs/promises';
const base=new URL('.',import.meta.url),shared=new URL('../kitsnode-ad-api/src/',base);
export async function consentFiles(){
 const entry=(await readFile(new URL('index.ts',base),'utf8')).replaceAll('../kitsnode-ad-api/src/','./shared/');
 const names=['invite-active-session.mjs','invite-consent-service.mjs','invite-consent-http.mjs','member-eligibility.mjs','shared-rate-limit.mjs','supabase-connection-store.mjs'];
 return [{name:'index.ts',content:entry},{name:'disclosure-config.mjs',content:await readFile(new URL('disclosure-config.mjs',base),'utf8')},{name:'supabase-store.mjs',content:await readFile(new URL('supabase-store.mjs',base),'utf8')},...await Promise.all(names.map(async n=>({name:'shared/'+n,content:await readFile(new URL(n,shared),'utf8')})))];
}
