// Generates a review-only artifact. This script does not upload or publish.
// The operator must obtain the current name and version from the existing
// store item. This script cannot independently verify either value or item ID.
import {execFileSync} from 'node:child_process';
import {constants} from 'node:fs';
import {copyFile, lstat, mkdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname, isAbsolute, join, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const source=join(root,'browser-extension/naver-invite-preflight');
const files=['account-discovery.mjs','popup.html','popup.mjs','web-start-worker.mjs','web-start-bridge.mjs','automatic-start.mjs','automatic-controller.html','automatic-controller.mjs','automatic-driver.mjs','automatic-invite.mjs','preflight.mjs','send-invite.mjs','consent-message-v2-candidate.mjs','consent-controller-v2-candidate.mjs','consent-proof-bridge-v2-candidate.mjs','invite-status.mjs'];
export function parseChromeVersion(value){
 if(typeof value!=='string'||!/^\d+(?:\.\d+){0,3}$/.test(value))throw Error('invalid Chrome version');
 const parts=value.split('.');if(parts.some(p=>p.length>1&&p[0]==='0'||Number(p)>65535)||parts.every(p=>Number(p)===0))throw Error('invalid Chrome version');
 return [...parts.map(Number),...Array(4-parts.length).fill(0)];
}
export function isNewerVersion(next,current){const a=parseChromeVersion(next),b=parseChromeVersion(current);for(let i=0;i<4;i++){if(a[i]!==b[i])return a[i]>b[i];}return false;}
export async function buildStoreCandidate({currentVersion,version,name,output}){
 if(!isNewerVersion(version,currentVersion))throw Error('new version must exceed the operator-provided current version');
 if(typeof name!=='string'||!name.trim()||name!==name.trim()||name.length>75||/[\x00-\x1f]/.test(name))throw Error('provide the verified store item name');
 if(typeof output!=='string'||!isAbsolute(output)||!output.endsWith('.zip'))throw Error('output must be an absolute .zip path');
 const manifest=JSON.parse(await readFile(join(source,'manifest.json'),'utf8'));
 if(manifest.manifest_version!==3||manifest.key!==undefined||manifest.background?.service_worker!=='web-start-worker.mjs'||manifest.action?.default_popup!=='popup.html'||JSON.stringify(manifest.host_permissions)!==JSON.stringify(['https://ads.naver.com/*','https://bjpguxwqxlsteektkhwf.supabase.co/*'])||JSON.stringify(manifest.externally_connectable?.matches)!==JSON.stringify(['https://heetae1120.github.io/*']))throw Error('source manifest does not match the reviewed candidate');
 // A store item keeps its ID only when updating the same publisher item.
 // A ZIP or local unpacked ID cannot prove publisher ownership or store ID.
 manifest.name=name;manifest.version=version;
 const blobs=new Map();
 for(const file of files){const path=join(source,file);if(!(await lstat(path)).isFile())throw Error(`non-regular source file: ${file}`);const text=await readFile(path,'utf8');if(/(?:127\.0\.0\.1|localhost|2632357|jonho1)/i.test(text))throw Error(`test-only configuration in ${file}`);if(/\bimport\s*\(/.test(text))throw Error(`dynamic import requires manual package review: ${file}`);for(const match of text.matchAll(/(?:import|export)\s+(?:[^'";]*?\s+from\s*)?['"]([^'"]+)['"]/g)){if(!match[1].startsWith('./')||!files.includes(match[1].slice(2)))throw Error(`missing or external package dependency in ${file}`);}blobs.set(file,text);}
 if(!blobs.get('automatic-controller.mjs').includes('https://bjpguxwqxlsteektkhwf.supabase.co/functions/v1/kitsnode-ad-consent-proof/proof'))throw Error('unexpected proof endpoint');
 const staging=await mkdtemp(join(tmpdir(),'kitsnode-store-candidate-'));
 try{
  const dir=join(staging,'package');await mkdir(dir);await writeFile(join(dir,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  for(const [file,text] of blobs)await writeFile(join(dir,file),text);
  const zip=join(staging,'candidate.zip');execFileSync('zip',['-q','-X',zip,'manifest.json',...files],{cwd:dir,stdio:'pipe'});
  await copyFile(zip,output,constants.COPYFILE_EXCL);
 } finally {await rm(staging,{recursive:true,force:true});}
 return {output,version,itemId:'ciohpfgnccmnpbldolbfediamifaiocf',warning:'Review candidate only; store ownership, installed version, integration and submission are not verified.'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const args=process.argv.slice(2);if(args.length!==4){console.error('Usage: node scripts/build-invite-store-candidate.mjs CURRENT_STORE_VERSION NEW_VERSION VERIFIED_STORE_NAME /absolute/output.zip');process.exitCode=2;}
 else buildStoreCandidate({currentVersion:args[0],version:args[1],name:args[2],output:args[3]}).then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(e.message);process.exitCode=1;});
}
