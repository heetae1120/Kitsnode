import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';

const require=createRequire(import.meta.url),pw=process.env.KITS_PLAYWRIGHT_PATH;
test('Naver login requires explicit signup for a user with no consent history',{skip:!pw,timeout:30000},async t=>{
 const env={NEXT_PUBLIC_MEMBER_AUTH_ENABLED:'true',NEXT_PUBLIC_MEMBER_AUTH_PROJECT_REF:'abcdefghijklmnopqrst',NEXT_PUBLIC_MEMBER_AUTH_URL:'https://abcdefghijklmnopqrst.supabase.co',NEXT_PUBLIC_MEMBER_AUTH_PUBLISHABLE_KEY:'sb_publishable_synthetic',NEXT_PUBLIC_MEMBER_AUTH_SIGNUP_ENABLED:'true',NEXT_PUBLIC_MEMBER_AUTH_NAVER_ENABLED:'true',NEXT_PUBLIC_MEMBER_AUTH_NAVER_LINK_ENABLED:'false',NEXT_PUBLIC_NAVER_SIGNUP_BOUNDARY:'true',NEXT_PUBLIC_NAVER_AGREEMENT_ENABLED:'false',NEXT_PUBLIC_MEMBER_EMAIL_PROFILE_ENABLED:'false',NEXT_PUBLIC_SELF_WITHDRAW_ENABLED:'false',NEXT_PUBLIC_MEMBER_USERNAME_ENABLED:'false',NEXT_PUBLIC_BASE_PATH:''};
 const fakeClient=`const listeners=new Set(); const auth={onAuthStateChange(fn){listeners.add(fn);setTimeout(()=>fn('SIGNED_IN',{user:{id:'synthetic',identities:[{provider:'custom:naver'}]}}),0);return {data:{subscription:{unsubscribe(){listeners.delete(fn)}}}}},signOut:async()=>{window.fakeSignedOut=true;for(const fn of listeners)fn('SIGNED_OUT',null);return {error:null}},signInWithOAuth:async()=>({error:null})};export const memberBrowserClient=()=>({auth});`;
 const fakeConsent=`export const MEMBER_TERMS_VERSION='terms',MEMBER_PRIVACY_VERSION='privacy';export const bindConsentToUser=(c)=>c.accept;export const createMemberConsent=()=>({hasCurrent:async()=>({ok:true,accepted:new URLSearchParams(location.search).has('current')}),hasAny:async()=>({ok:true,accepted:new URLSearchParams(location.search).has('history')}),accept:async()=>({ok:true})});`;
 const bundle=await build({entryPoints:[fileURLToPath(new URL('./fixtures/naver-boundary-browser.tsx',import.meta.url))],bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',logLevel:'silent',define:Object.fromEntries(Object.entries(env).map(([k,v])=>['process.env.'+k,JSON.stringify(v)])),plugins:[{name:'synthetic-member',setup(b){b.onResolve({filter:/\.css$/},()=>({path:'style',namespace:'mock'}));b.onResolve({filter:/^@\/lib\/member-browser-client$/},()=>({path:'client',namespace:'mock'}));b.onResolve({filter:/^@\/lib\/member-consent\.mjs$/},()=>({path:'consent',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:a.path==='style'?'export default {}':a.path==='client'?fakeClient:fakeConsent,loader:'js'}))}}]});
 const browser=await require(pw).chromium.launch({headless:true,executablePath:process.env.KITS_CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});t.after(()=>browser.close());
 for(const scenario of [{intent:null,expected:'가입된 키츠노드 회원이 아닙니다.'},{intent:'signin',expected:'가입된 키츠노드 회원이 아닙니다.'},{intent:'signup',expected:'회원 이용 안내 확인'},{intent:null,query:'?history=1',expected:'회원 이용 안내 확인'},{intent:null,query:'?current=1',expected:'로그아웃'}]){
  const context=await browser.newContext();const page=await context.newPage();if(scenario.intent)await page.addInitScript(intent=>sessionStorage.setItem('kitsnode.naver.auth.intent',JSON.stringify({kind:intent,at:Date.now()})),scenario.intent);
  await page.route('https://example.test/**',route=>route.fulfill({status:200,contentType:route.request().url().includes('/app.js')?'text/javascript':'text/html',body:route.request().url().includes('/app.js')?bundle.outputFiles[0].text:'<div id="root"></div><script src="/app.js"></script>'}));
  await page.goto('https://example.test/'+(scenario.query||''));await page.getByText(scenario.expected,{exact:false}).first().waitFor();
  const refused=scenario.expected.startsWith('가입된');assert.equal(await page.evaluate(()=>Boolean(window.fakeSignedOut)),refused);await context.close();
 }
});
