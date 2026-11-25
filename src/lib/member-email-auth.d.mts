import type {AuthClient} from '@supabase/supabase-js';
export function createEmailAuthClient(options:{auth:AuthClient;trustedOrigin:string;confirmationRedirectTo:string;recoveryRedirectTo:string;signupAllowed?:boolean}): {
  signUp(email:string,password:string,evidence:{termsVersion:string;privacyVersion:string;termsAccepted:true;privacyAcknowledged:true},draft?:{username:string;name:string;phone:string;company:string;ageConfirmed:true}):Promise<{ok:boolean;code:string}>;
  verifySignupCode(email:string,token:string):Promise<{ok:boolean;code:string}>;
  resendSignupCode(email:string):Promise<{ok:boolean;code:string}>;
  signIn(email:string,password:string):Promise<{ok:boolean;code:string}>;
  signOut():Promise<{ok:boolean;code:string}>;
  requestPasswordReset(email:string):Promise<{ok:boolean;code:string}>;
  updatePassword(password:string):Promise<{ok:boolean;code:string}>;
  dispose():void;
};
