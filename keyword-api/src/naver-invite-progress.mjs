// Read-only partial state detection for observed Naver invitation UI.
// It does not verify the selected role, send invitations or accept policies.
const id = s => typeof s === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(s);
const account = s => typeof s === 'string' && /^[1-9][0-9]{0,15}$/.test(s);
export async function inspectNaverInviteProgress({page, accountId, viewerId, recipientId} = {}) {
 if (!page || typeof page.evaluate !== 'function' || !account(accountId) || !id(viewerId) || !id(recipientId)) return {status:'unverified'};
 try {
  const state = await page.evaluate(({accountId,viewerId,recipientId}) => {
   const url = new URL(location.href);
   if(url.origin !== 'https://ads.naver.com' || url.pathname !== `/manage/ad-accounts/${accountId}/settings/authorities/members/invited` || url.search || url.hash) return null;
   const visible=e=>e.getClientRects().length>0;
   const links=[...document.querySelectorAll('a')].filter(e=>visible(e)&&e.textContent.trim()===viewerId&&e.href==='https://ads.naver.com/settings/profile-info');
   if(links.length!==1)return null;
   const body=document.body.innerText.replace(/\s+/g,' ');
   const countButton=label=>[...document.querySelectorAll('button')].filter(e=>visible(e)&&!e.disabled&&e.textContent.trim()===label).length;
   const matchMessage=`ID ${recipientId} 의 권한 레벨을 선택해 주세요.`;
   if(body.includes(matchMessage)&&body.includes('운영 관리')&&body.includes('운영 조회')&&countButton('초대')===1)return 'role_choice';
   const matchingInputs=[...document.querySelectorAll('input')].filter(e=>visible(e)&&e.value===recipientId);
   if(matchingInputs.length===1&&body.includes('초대 가능한 회원 ID입니다.')&&countButton('가입 여부 조회')===1&&countButton('다음')===1)return 'recipient_lookup';
   return null;
  },{accountId,viewerId,recipientId});
  return state ? {status:state, requiresUserAction:true} : {status:'unverified'};
 } catch { return {status:'unverified'}; }
}
