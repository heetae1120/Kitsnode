// Local fixture-only browser automation. This module cannot reach Naver and is
// deliberately not mounted to any application route. The fixture selectors are
// not claims about the real Naver UI. Live operation needs a separately reviewed
// account-ownership proof, browser-session isolation, and provider policy review.
const validId=x=>typeof x==='string'&&/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(x);
const validAccount=x=>typeof x==='string'&&/^[1-9][0-9]{0,15}$/.test(x);
const fail=reason=>({ok:false,reason,retry:'disabled'});

export function createInviteBrowserFixture({page,fixtureOrigin,accountId,recipientId}={}){
 if(!page||typeof page.url!=='function'||typeof page.getByTestId!=='function'||!validId(recipientId)||!validAccount(accountId))throw TypeError('invalid_configuration');
 let origin;
 try{const u=new URL(fixtureOrigin);if(u.protocol!=='http:'||u.hostname!=='127.0.0.1'||u.username||u.password||u.pathname!=='/'||u.search||u.hash||!u.port)throw Error();origin=u.origin;}catch{throw TypeError('fixture_only');}
 let attempted=false;
 async function validate(expectedMode){
  const u=new URL(page.url());if(u.origin!==origin||u.pathname!=='/fixture.html'||u.search||u.hash)return false;
  const x=async id=>(await page.getByTestId(id).textContent())?.trim();
  return await x('session-mode')===expectedMode&&await x('account-id')===accountId&&await x('recipient-id')===recipientId&&await x('role')==='운영 관리'&&await x('challenge')==='none';
 }
 async function perform(mode,button,result){
  if(attempted)return fail('already_attempted');
  try{if(!await validate(mode))return fail('context_unverified');}catch{return fail('context_unverified');}
  attempted=true;
  try{
   await page.getByTestId(button).click({timeout:1500});
   // The local fixture may update the result asynchronously after its own
   // simulated server responds. A timeout is an uncertain outcome, not retry.
   await page.getByTestId('result').filter({hasText:result}).waitFor({state:'visible',timeout:1500});
   if(!await validate(mode))return fail('outcome_unconfirmed');
   if((await page.getByTestId('result').textContent())?.trim()!==result)return fail('outcome_unconfirmed');
   return {ok:true,status:result,retry:'disabled'};
  }catch{return fail('outcome_unconfirmed');}
 }
 return Object.freeze({invite:()=>perform('advertiser','send-invite','invited'),accept:()=>perform('recipient','accept-invite','accepted')});
}
