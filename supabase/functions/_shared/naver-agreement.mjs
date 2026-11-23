// Server-only adapter. expectedSubject must come from a verified Supabase
// user's custom:naver identity; never accept it from the browser. A caller
// must separately authenticate the Supabase session and associate the
// configured required term codes with the currently published versions.
const PROFILE_URL = 'https://openapi.naver.com/v1/nid/me';
const AGREEMENT_URL = 'https://openapi.naver.com/v1/nid/agreement';
// NAVER documents this format without a timezone. Keep the original value;
// callers must not infer a UTC consent time from it.
function validAgreeDate(value){
  if(typeof value!=='string')return false;
  const m=/^(\d{1,2}):(\d{2}):(\d{2})\.(\d{3}) (AM|PM) (\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if(!m)return false;
  const [,h,mi,s,, ,month,day,year]=m;
  const date=new Date(Date.UTC(Number(year),Number(month)-1,Number(day)));
  return Number(h)>=1&&Number(h)<=12&&Number(mi)<60&&Number(s)<60&&date.getUTCFullYear()===Number(year)&&date.getUTCMonth()===Number(month)-1&&date.getUTCDate()===Number(day);
}

export async function verifyNaverAgreements({providerToken, expectedSubject, expectedClientId, requiredTermCodes, fetchImpl=fetch}) {
  if(typeof providerToken!=='string'||!providerToken||providerToken.length>8192||/[\r\n]/.test(providerToken)||
     typeof expectedSubject!=='string'||!expectedSubject||typeof expectedClientId!=='string'||!expectedClientId||
     !Array.isArray(requiredTermCodes)||requiredTermCodes.length===0||requiredTermCodes.some(x=>typeof x!=='string'||!x)||
     new Set(requiredTermCodes).size!==requiredTermCodes.length) return {ok:false,code:'invalid_input'};
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),5000);
  const get=async url=>{
    const response=await fetchImpl(url,{method:'GET',headers:{authorization:`Bearer ${providerToken}`,accept:'application/json'},redirect:'error',signal:controller.signal});
    if(!response.ok) throw Error('upstream');
    return response.json();
  };
  try {
    // Identity binding is fail-closed: the deployed provider must first prove
    // that profile.id and the verified OIDC subject use the same identifier.
    const profile=await get(PROFILE_URL);
    if(profile?.resultcode!=='00'||typeof profile?.response?.id!=='string'||profile.response.id!==expectedSubject) return {ok:false,code:'identity_mismatch'};
    const result=await get(AGREEMENT_URL);
    if(result?.result!=='success'||!Array.isArray(result.agreementInfos))return {ok:false,code:'unavailable'};
    const agreements=[];
    for(const code of requiredTermCodes){
      const matches=result.agreementInfos.filter(x=>x?.termCode===code&&x?.clientId===expectedClientId);
      if(matches.length!==1||!validAgreeDate(matches[0].agreeDate))return {ok:false,code:'missing_agreement'};
      agreements.push({termCode:code,agreeDate:matches[0].agreeDate});
    }
    return {ok:true,agreements};
  } catch {return {ok:false,code:'unavailable'}} finally {clearTimeout(timer)}
}
