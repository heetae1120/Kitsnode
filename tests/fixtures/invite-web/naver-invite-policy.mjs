// Snapshot observed in the Naver invitation modal on 2026-11-21. Any provider
// change requires a new snapshot, consent version and extension comparison.
export const NAVER_INVITE_POLICY_VERSION='nav-invite-2026-11-21-v1';
export const NAVER_INVITE_POLICY_ITEMS=Object.freeze([
 '새로운 회원 초대 시 해당 사용자에게 필요한 권한 레벨을 지정하여 계정에 접근 권한 수준을 제한할 수 있습니다.',
 '초대된 회원의 계정 활동 내용에 대한 관리 책임은 모두 초대를 보낸 사용자에게 있으므로 회원 초대 및 관리에 주의해야 합니다.',
 '계정이 유지되는 기간 동안 원활한 계정 운영을 위하여 일부 권한 레벨에게 회원 ID, 광고 계정 ID, 이름, 휴대전화번호, 이메일, 입금 계좌, 환불 계좌가 제공될 수 있으며, 해당 정보는 마스킹 된 상태로 표시됩니다. 본인 인증을 완료한 경우에 한하여 마스킹이 해제됩니다. 본 동의를 거부하실 수 있으나 이 경우 계정 연동 및 회원 참여가 불가합니다. 회원 초대 시 부여하는 권한 레벨에 따라 광고 운영, 결제 권한, 회원 초대 등 모든 관리 및 운영 기능을 사용할 수 있으니 사용자에 맞는 권한 레벨을 지정해 주셔야 합니다.',
 '초대를 받은 사용자가 승인하는 즉시 부여한 권한 레벨로 접근 가능하며, 운영 중인 해당 계정에 대해서 권한 해제 및 권한 레벨을 변경할 수 있습니다.'
]);
export const NAVER_INVITE_POLICY_AGREEMENT='위 내용을 숙지하였으며, 개인정보 제공 및 회원 초대 정책에 동의합니다.';
export const NAVER_INVITE_POLICY_CANONICAL=[...NAVER_INVITE_POLICY_ITEMS,NAVER_INVITE_POLICY_AGREEMENT].join('\n');
export const NAVER_INVITE_POLICY_DIGEST='c22f67b6cea2f70da3ddc3cca9a5b9923ae1b8cb77adbe3a7292714df7ba5596';
