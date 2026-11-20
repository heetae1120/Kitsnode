// Isolated review candidate. Not imported by the application or enabled.
// `expectedApiOrigin` must be immutable, build/deployment configuration, never
// user input. All mutable session operations must go through sessionBridge.
const DRAFT_KEY='kitsnode.signup.draft.v1';
const PATHS={checkUsername:'/member/onboarding/check-username',register:'/member/onboarding/register',inspectDraft:'/member/onboarding/inspect-draft',complete:'/member/onboarding/complete',completeManual:'/member/onboarding/complete-manual',signIn:'/member/onboarding/sign-in'};
const error = code => ({ok:false,code});
const validDraft = value => typeof value==='string' && value.length>=40 && value.length<=4096 && /^[A-Za-z0-9_-]+$/.test(value);
const validToken = value => typeof value==='string' && value.length>0 && value.length<=8192 && !/\s/.test(value);

async function readJsonBounded(response,max=16384) {
  const len=response.headers.get('content-length');
  if (len && (!/^\d+$/.test(len) || Number(len)>max)) throw new Error('bad_response');
  if (!response.body) throw new Error('bad_response');
  const reader=response.body.getReader();let size=0;const chunks=[];
  try {while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>max)throw new Error('bad_response');chunks.push(value);}}
  finally {reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;for(const part of chunks){bytes.set(part,offset);offset+=part.byteLength;}
  const value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  if(!value || typeof value!=='object' || Array.isArray(value) || typeof value.ok!=='boolean' || typeof value.code!=='string')throw new Error('bad_response');
  return value;
}

/** sessionBridge must be a shared coordinator used by *all* Supabase session
 * mutations and auth callbacks, including sign-out and OAuth redirects:
 * snapshot() -> {generation,accessToken?}; isCurrent(snapshot) -> boolean;
 * installIfCurrent({access_token,refresh_token},snapshot) -> boolean (atomic
 * relative to all session changes); signOut() -> Promise; and
 * revokeIssuedSession(session) -> Promise (specific issued session only).
 * Supabase auth.setSession by itself does not provide this atomic contract.
 * Never enable until a real coordinator and scoped server revocation exist.
 */
export function createMemberOnboardingClientCandidate({apiOrigin,expectedApiOrigin,fetchImpl,storage,sessionBridge}) {
  let url;
  try {url=new URL(apiOrigin);} catch {throw new TypeError('invalid_origin');}
  if (apiOrigin!==expectedApiOrigin || url.origin!==apiOrigin || url.username || url.password || (url.protocol!=='https:' && !(url.protocol==='http:' && ['localhost','127.0.0.1'].includes(url.hostname)))) throw new TypeError('invalid_origin');
  if(typeof fetchImpl!=='function' || !storage || !sessionBridge || ['snapshot','isCurrent','installIfCurrent','signOut','revokeIssuedSession'].some(key=>typeof sessionBridge[key]!=='function')) throw new TypeError('invalid_dependencies');
  let registrationSequence=0;
  let sessionEpoch=0;
  const getDraft=()=>{try{const draft=storage.getItem(DRAFT_KEY);return validDraft(draft)?draft:null;}catch{return null;}};
  const clearDraft=expected=>{try{if(expected===undefined || storage.getItem(DRAFT_KEY)===expected)storage.removeItem(DRAFT_KEY);}catch{}};
  const same=snapshot=>{try{return sessionBridge.isCurrent(snapshot)===true;}catch{return false;}};
  async function post(method,data,token) {
    const headers={'content-type':'application/json'};
    if(token){if(!validToken(token))throw new Error('invalid_session');headers.authorization=`Bearer ${token}`;}
    const reply=await fetchImpl(`${apiOrigin}${PATHS[method]}`,{method:'POST',mode:'cors',credentials:'omit',redirect:'error',headers,body:JSON.stringify(data)});
    const result=await readJsonBounded(reply);
    if(!reply.ok && result.ok) throw new Error('bad_response');
    return result;
  }
  async function capture() {
    try {const value=await sessionBridge.snapshot();return value && same(value) ? value:null;} catch {return null;}
  }
  return {
    async checkUsername(username){try{return await post('checkUsername',{username});}catch{return error('unavailable');}},
    async register(input){
      const seq=++registrationSequence; const before=await capture();if(!before)return error('unavailable');
      // A delayed snapshot must not erase or start after a newer registration.
      if(seq!==registrationSequence || !same(before))return error('session_changed');
      let result;try{result=await post('register',{input});}catch{return error('unavailable');}
      if(seq!==registrationSequence || !same(before))return error('session_changed');
      if(result.ok && result.code==='signup_requested') {
        if(!validDraft(result.draft)) {clearDraft();return {ok:true,code:'signup_requested_manual'};}
        try{storage.setItem(DRAFT_KEY,result.draft);return {ok:true,code:'signup_requested'};}
        catch{clearDraft();return {ok:true,code:'signup_requested_manual'};}
      }
      return {ok:false,code:result.code};
    },
    async inspectDraft(){
      const epoch=sessionEpoch;
      const before=await capture();if(!before || !validToken(before.accessToken))return error('verification_required');
      if(epoch!==sessionEpoch)return error('session_changed');
      const draft=getDraft();if(!draft)return error('manual_completion_required');
      let result;try{result=await post('inspectDraft',{draft},before.accessToken);}catch{return error('unavailable');}
      if(epoch!==sessionEpoch || !same(before))return error('session_changed');
      if(!result.ok && result.code==='verification_required'){clearDraft(draft);return error('manual_completion_required');}
      return result;
    },
    async complete(confirmation,replacementUsername){
      const epoch=sessionEpoch;
      const before=await capture();if(!before || !validToken(before.accessToken))return error('verification_required');
      if(epoch!==sessionEpoch)return error('session_changed');
      const draft=getDraft();if(!draft)return error('manual_completion_required');
      let result;try{result=await post('complete',{draft,confirmation,replacementUsername},before.accessToken);}catch{return error('unavailable');}
      if(epoch!==sessionEpoch || !same(before))return error('session_changed');
      if(result.ok && result.code==='profile_completed')clearDraft(draft);
      if(!result.ok && result.code==='verification_required'){clearDraft(draft);return error('manual_completion_required');}
      return result;
    },
    async completeManual(input){
      const epoch=sessionEpoch;
      const before=await capture();if(!before || !validToken(before.accessToken))return error('verification_required');
      if(epoch!==sessionEpoch)return error('session_changed');
      const draft=getDraft();
      let result;try{result=await post('completeManual',{input},before.accessToken);}catch{return error('unavailable');}
      if(epoch!==sessionEpoch || !same(before))return error('session_changed');
      if(draft && result.ok && result.code==='profile_completed')clearDraft(draft);
      return result;
    },
    async signIn(username,password){
      const epoch=sessionEpoch;
      const before=await capture();if(!before)return error('unavailable');
      if(epoch!==sessionEpoch)return error('session_changed');
      let result;try{result=await post('signIn',{username,password});}catch{return error('unavailable');}
      if(!result.ok || result.code!=='signed_in')return epoch===sessionEpoch && same(before)?{ok:false,code:result.code}:error('session_changed');
      const session=result.session;
      if(!session || !validToken(session.access_token) || !validToken(session.refresh_token)){
        if(session && typeof session==='object') {try{await sessionBridge.revokeIssuedSession(session);}catch{}}
        return error('unavailable');
      }
      let installed=false;
      try{if(epoch===sessionEpoch && same(before))installed=await sessionBridge.installIfCurrent({access_token:session.access_token,refresh_token:session.refresh_token},before)===true;}catch{}
      if(!installed){try{await sessionBridge.revokeIssuedSession(session);}catch{}return error('session_changed');}
      return {ok:true,code:'signed_in'};
    },
    async signOut(){
      ++registrationSequence;++sessionEpoch;clearDraft();
      try{await sessionBridge.signOut();return {ok:true,code:'signed_out'};}catch{return error('unavailable');}
    },
    // Called by the shared coordinator on an external SIGNED_OUT event.
    discardOnSessionEnd(){++registrationSequence;++sessionEpoch;clearDraft();},
  };
}
