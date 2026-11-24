import {createMemberConsent, MEMBER_TERMS_VERSION, MEMBER_PRIVACY_VERSION} from './member-consent.mjs';

// This client must use an isolated, non-persistent auth session. The normal
// application client receives the session only after profile completion.
export function createMemberSignupFlow({client, applicationAuth}) {
  let verified = null;
  const fail = code => ({ok:false,code});
  const validEmail = value => typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  return {
    async requestCode(email) {
      if (!validEmail(email)) return fail('invalid_input');
      verified = null;
      try {
        await client.auth.signOut({scope:'local'});
        const {error} = await client.auth.signInWithOtp({email:email.trim(),options:{shouldCreateUser:true}});
        if (error) return fail(['over_email_send_rate_limit','over_request_rate_limit'].includes(error.code) ? 'email_rate_limited' : 'unavailable');
        return {ok:true,code:'signup_code_resent'};
      } catch { return fail('unavailable'); }
    },
    async verifyCode(email, token) {
      verified = null;
      if (!validEmail(email) || !/^[0-9]{6,10}$/.test(token)) return fail('invalid_code');
      try {
        const {data,error} = await client.auth.verifyOtp({email:email.trim(),token,type:'email'});
        const user=data?.user;
        if (error || !data?.session || !user?.id || !user.email_confirmed_at || user.email?.toLowerCase() !== email.trim().toLowerCase()) { await client.auth.signOut({scope:'local'}); return fail('invalid_code'); }
        // The server-side gate distinguishes incomplete email accounts from
        // existing members. Fail closed when the gate is unavailable or off.
        const pending=await client.rpc('kitsnode_my_email_profile_pending');
        if (pending.error || pending.data !== true) { await client.auth.signOut({scope:'local'}); return fail('signup_unavailable'); }
        verified={id:user.id,email:email.trim().toLowerCase()};
        return {ok:true,code:'email_verified'};
      } catch { await client.auth.signOut({scope:'local'}).catch(()=>{}); return fail('unavailable'); }
    },
    async complete(email,password,evidence,draft) {
      if (!verified || verified.email !== email.trim().toLowerCase()) return fail('verification_required');
      if (typeof password!=='string' || password.length<8 || password.length>72 || evidence?.termsAccepted!==true || evidence?.privacyAcknowledged!==true || evidence.termsVersion!==MEMBER_TERMS_VERSION || evidence.privacyVersion!==MEMBER_PRIVACY_VERSION || !draft || !/^[a-z0-9][a-z0-9_-]{3,19}$/.test(draft.username) || typeof draft.name!=='string' || !draft.name.trim() || draft.name.length>100 || typeof draft.phone!=='string' || !/^01[016789][0-9]{7,8}$/.test(draft.phone.replace(/[ -]/g,'')) || !/^[0-9 -]+$/.test(draft.phone) || typeof draft.company!=='string' || draft.company.length>100 || draft.ageConfirmed!==true) return fail('invalid_input');
      try {
        const identity=await client.auth.getUser();
        if (identity.error || identity.data?.user?.id!==verified.id || identity.data.user.email?.toLowerCase()!==verified.email || !identity.data.user.email_confirmed_at) return fail('verification_required');
        const pending=await client.rpc('kitsnode_my_email_profile_pending');
        if (pending.error || pending.data!==true) return fail('signup_unavailable');
        const consent=await createMemberConsent(client).accept(evidence);
        if (!consent.ok) return fail('unavailable');
        const passwordResult=await client.auth.updateUser({password});
        if (passwordResult.error) return fail('unavailable');
        const result=await client.rpc('kitsnode_complete_email_profile_with_company',{p_expected_user:verified.id,p_username:draft.username,p_name:draft.name.trim(),p_phone:draft.phone,p_company:draft.company.trim(),p_age_confirmed:true});
        if (result.error || !['created','already_registered'].includes(result.data)) return fail(result.data==='username_taken' ? 'username_taken' : 'unavailable');
        const session=await client.auth.getSession();
        if (session.error || !session.data.session || session.data.session.user.id!==verified.id) return fail('unavailable');
        const installed=await applicationAuth.setSession({access_token:session.data.session.access_token,refresh_token:session.data.session.refresh_token});
        if (installed.error || !installed.data.session) return fail('unavailable');
        verified=null;
        return {ok:true,code:'signup_completed'};
      } catch { return fail('unavailable'); }
    },
    async reset() { verified=null; try { await client.auth.signOut({scope:'local'}); } catch {} },
  };
}
