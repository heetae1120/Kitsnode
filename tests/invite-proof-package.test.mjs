import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,mkdir,rm,writeFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import {dirname,join} from 'node:path';import {pathToFileURL} from 'node:url';
import {proofFiles} from '../supabase/functions/kitsnode-ad-consent-proof/package.mjs';
test('deploy bundle contains every local import and starts its factory independently',async t=>{
 const files=await proofFiles(),names=new Set(files.map(x=>x.name));assert.equal(names.size,files.length);assert.equal(files.length,10);
 const dir=await mkdtemp(join(tmpdir(),'kits-proof-bundle-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 for(const {name,content} of files){assert.ok(!name.startsWith('/')&&!name.includes('..'));const path=join(dir,name);await mkdir(dirname(path),{recursive:true});await writeFile(path,content);}
 const {createExecutionProofHandler}=await import(pathToFileURL(join(dir,'factory.mjs')));assert.equal(typeof createExecutionProofHandler,'function');
 const entry=files.find(f=>f.name==='index.ts').content;assert.ok(entry.includes("from './consent/disclosure-config.mjs'"));
});
