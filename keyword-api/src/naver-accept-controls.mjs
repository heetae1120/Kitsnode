// Candidate based on observed Naver invitation screen. Requires isolated,
// authenticated recipient session and caller authorization. Not wired to app.
const validId = x => typeof x === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(x);
const validAccount = x => typeof x === 'string' && /^[1-9][0-9]{0,15}$/.test(x);
export function createNaverAcceptControls({page, accountId, recipientId, authorize = async () => false} = {}) {
 if (!page || !validAccount(accountId) || !validId(recipientId) || typeof authorize !== 'function') throw TypeError('invalid_configuration');
 let attempted = false;
 async function inspect() {
  return page.evaluate(({ accountId, recipientId }) => {
   const url = new URL(location.href);
   if (url.origin !== 'https://ads.naver.com' || url.pathname !== '/settings/ad-account/invited' || url.search || url.hash) return null;
   const visible = e => e.getClientRects().length > 0;
   const profiles = [...document.querySelectorAll('a')].filter(e => visible(e) && e.textContent.trim() === recipientId && e.href === 'https://ads.naver.com/settings/profile-info');
   if (profiles.length !== 1) return null;
   const rows = [...document.querySelectorAll('tr')].filter(visible).filter(r => {
    const cells = [...r.querySelectorAll('td')];
    const text = cells.map(c => c.innerText.replace(/\s+/g, ' ').trim());
    return cells.length >= 3 && new RegExp(`(?:^|\\s)\\(\\s*${accountId}\\s*\\)(?:\\s|$)`).test(text[0]) && text[1] === '운영 관리' && [...r.querySelectorAll('button')].filter(b => visible(b) && !b.disabled && b.innerText.trim() === '승인').length === 1;
   });
   const dialogs = [...document.querySelectorAll('[role=dialog]')].filter(visible).filter(d => d.innerText.includes('광고 계정 초대를 승인하시겠습니까?'));
   return { rows: rows.length, dialogs: dialogs.length };
  }, {accountId, recipientId});
 }
 async function clickButton(kind) {
  const h = await page.evaluateHandle(({kind,accountId}) => {
   const visible=e=>e.getClientRects().length > 0;
   let buttons=[];
   if(kind === 'approve') {
    const rows=[...document.querySelectorAll('tr')].filter(visible).filter(r=>{const c=[...r.querySelectorAll('td')];const t=c.map(x=>x.innerText.replace(/\s+/g,' ').trim());return c.length>=3&&new RegExp(`(?:^|\\s)\\(\\s*${accountId}\\s*\\)(?:\\s|$)`).test(t[0])&&t[1]==='운영 관리';});
    if(rows.length!==1)return null;
    buttons=[...rows[0].querySelectorAll('button')].filter(b=>visible(b)&&!b.disabled&&b.innerText.trim()==='승인');
   } else {
    const dialogs=[...document.querySelectorAll('[role=dialog]')].filter(visible).filter(d=>d.innerText.includes('광고 계정 초대를 승인하시겠습니까?'));
    if(dialogs.length!==1)return null;
    buttons=[...dialogs[0].querySelectorAll('button')].filter(b=>visible(b)&&!b.disabled&&b.innerText.trim()==='확인');
   }
   return buttons.length===1?buttons[0]:null;
  }, {kind,accountId});
  try {const e=h.asElement();if(!e)return false;await e.click();return true;}finally{await h.dispose();}
 }
 return Object.freeze({async accept(){
  if(attempted)return {status:'blocked',retry:'disabled'};
  try {
   const before=await inspect();
   if(!before||before.rows!==1||before.dialogs!==0||await authorize({accountId,recipientId,role:'OPERATIONS_MANAGER'})!==true)return {status:'blocked',retry:'disabled'};
   const again=await inspect();if(!again||again.rows!==1||again.dialogs!==0)return {status:'blocked',retry:'disabled'};
   if(!await clickButton('approve'))return {status:'blocked',retry:'disabled'};
   const confirm=await inspect();if(!confirm||confirm.rows!==1||confirm.dialogs!==1)return {status:'blocked',retry:'disabled'};
   if(await authorize({accountId,recipientId,role:'OPERATIONS_MANAGER'})!==true)return {status:'blocked',retry:'disabled'};
   const final=await inspect();if(!final||final.rows!==1||final.dialogs!==1)return {status:'blocked',retry:'disabled'};
   attempted=true;
   if(!await clickButton('confirm'))return {status:'uncertain',retry:'disabled'};
   // A separate membership/API check is required to confirm the resulting access.
   return {status:'uncertain',retry:'disabled'};
  }catch{return {status:attempted?'uncertain':'blocked',retry:'disabled'};}
 }});
}
