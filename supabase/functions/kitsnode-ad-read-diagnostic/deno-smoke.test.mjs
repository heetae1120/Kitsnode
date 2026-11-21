// Launch the actual Deno entrypoint with synthetic secrets; never reaches Supabase or Naver.
import test from 'node:test';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {setTimeout as sleep} from 'node:timers/promises';
test('Deno runtime starts and rejects unauthenticated and unexpected-origin requests', {timeout:30000},async()=>{
 const env={...process.env,SUPABASE_URL:'https://bjpguxwqxlsteektkhwf.supabase.co',SUPABASE_ANON_KEY:'fake-anon',SUPABASE_SERVICE_ROLE_KEY:'fake-service',NAVER_SEARCHAD_API_KEY:'fake-api',NAVER_SEARCHAD_SECRET_KEY:'fake-secret',KITS_AD_OPERATOR_IDS:'11111111-1111-4111-8111-111111111111',PORT:'8000'};
 const child=spawn('npx',['--yes','deno','run','--node-modules-dir=none','--allow-env','--allow-net=0.0.0.0:8000','supabase/functions/kitsnode-ad-read-diagnostic/index.ts'],{env,stdio:'ignore'});
 try {let response;for(let i=0;i<80;i++){try{response=await fetch('http://127.0.0.1:8000/',{method:'POST',headers:{Origin:'https://heetae1120.github.io'}});break}catch{if(child.exitCode!==null)throw Error('runtime_exited');await sleep(200)}}assert.ok(response,'server failed to start');assert.equal(response.status,401);assert.deepEqual(await response.json(),{error:'unauthenticated'});const denied=await fetch('http://127.0.0.1:8000/',{method:'POST',headers:{Origin:'https://invalid.example'}});assert.equal(denied.status,403);}finally{child.kill('SIGTERM');}
});
test('Deno disabled deployment always responds 410', {timeout:30000},async()=>{
 const child=spawn('npx',['--yes','deno','run','--allow-net=0.0.0.0:8000','supabase/functions/kitsnode-ad-read-diagnostic/disabled.ts'],{env:process.env,stdio:'ignore'});
 try{let r;for(let i=0;i<80;i++){try{r=await fetch('http://127.0.0.1:8000/',{method:'POST'});break}catch{if(child.exitCode!==null)throw Error('runtime_exited');await sleep(200)}}assert.ok(r,'server failed to start');assert.equal(r.status,410);assert.equal(await r.text(),'');}finally{child.kill('SIGTERM');}
});
