export const MEMBER_TERMS_VERSION: string;
export const MEMBER_PRIVACY_VERSION: string;
export type ConsentEvidence = {termsVersion:string; privacyVersion:string; termsAccepted:boolean; privacyAcknowledged:boolean};
export function bindConsentToUser(consent:{accept:(evidence:ConsentEvidence)=>Promise<{ok:boolean;code:string}>},userId:string,currentUserId:()=>string|null): (evidence:ConsentEvidence)=>Promise<{ok:boolean;code:string}>;
export function createMemberConsent(client: {from:(table:string)=>any}): {
  hasCurrent():Promise<{ok:boolean;accepted?:boolean;code?:string}>;
  accept(evidence:ConsentEvidence):Promise<{ok:boolean;code:string}>;
  withdraw(userId:string):Promise<{ok:boolean;code:string}>;
};
