/** Presentation only: the server makes all authorization decisions. */
export function memberAccessStatus({consented, memberAccess, emailVerified}: {consented:boolean; memberAccess:boolean; emailVerified:boolean}) {
  return {
    message: consented ? (memberAccess ? '로그인과 필수 약관 동의가 완료되었습니다.' : '필수 약관 동의를 확인했습니다. 회원 기능 사용 상태를 확인해 주세요.') : null,
    showRequiredEmail: !memberAccess && !emailVerified,
    showEmailSensitiveNote: consented && memberAccess && !emailVerified,
  };
}
