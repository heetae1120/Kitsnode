// Builds a separate, fixed-recipient *local test* extension. Never changes the
// kitsnode production candidate or connects to the website/server bridge.
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const source=dirname(fileURLToPath(import.meta.url));
const files={
 'preflight.mjs':5,'send-invite.mjs':3,'automatic-start.mjs':2,
 'automatic-controller.mjs':1,'automatic-driver.mjs':1,'automatic-invite.mjs':10,
 'popup.mjs':3,'popup.html':2,'automatic-controller.html':0,
};
export async function buildJonho1TestExtension() {
 const dir=await mkdtemp(join(tmpdir(),'kitsnode-jonho1-test-'));
 try {
  for (const [name,count] of Object.entries(files)) {
   const input=await readFile(join(source,name),'utf8');
   if((input.match(/kitsnode/g)||[]).length!==count)throw Error('source_changed');
   await writeFile(join(dir,name),input.replaceAll('kitsnode','jonho1'),{mode:0o600});
  }
  // No externally_connectable or background worker: this isolates manual
  // local testing from website integration and any production extension ID.
  const manifest={manifest_version:3,name:'유니킴 jonho1 초대 로컬 시험',version:'0.0.1',description:'시험 전용. 유니킴 계정에서 jonho1 초대.',permissions:['activeTab','scripting','storage'],host_permissions:['https://ads.naver.com/*'],action:{default_popup:'popup.html'}};
  await writeFile(join(dir,'manifest.json'),JSON.stringify(manifest,null,2),{mode:0o600});
  return dir;
 } catch(error) {await rm(dir,{recursive:true,force:true});throw error;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try {process.stdout.write((await buildJonho1TestExtension())+'\n');} catch {process.stderr.write('시험 패키지를 생성하지 못했습니다. 원본 구성을 확인해 주세요.\n');process.exitCode=1;}
}
