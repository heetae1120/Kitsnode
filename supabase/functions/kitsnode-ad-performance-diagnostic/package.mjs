import {readFile} from 'node:fs/promises';
const base=new URL('.',import.meta.url),shared=new URL('../kitsnode-ad-api/src/',base);
export async function diagnosticFiles({disabled=false}={}){
 if(disabled)return Promise.all(['disabled.ts','disabled.mjs'].map(async name=>({name,content:await readFile(new URL(name,base),'utf8')})));
 const entry=(await readFile(new URL('index.ts',base),'utf8')).replaceAll('../kitsnode-ad-api/src/','./shared/');
 const names=['connection-http.mjs','operator-evidence.mjs','naver-account-map.mjs','naver-ad-read.mjs','naver-performance-read.mjs','limited-json.mjs','shared-rate-limit.mjs'];
 return [{name:'index.ts',content:entry},{name:'handler.mjs',content:await readFile(new URL('handler.mjs',base),'utf8')},...await Promise.all(names.map(async name=>({name:'shared/'+name,content:await readFile(new URL(name,shared),'utf8')})))];
}
