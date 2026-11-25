# 격리된 광고 초대 사전 동의 후보

`invite-*`, `operator-campaign-service.mjs` 모듈은 운영 Edge 함수에 마운트되어 있지 않다. 별도 `kitsnode-ad-consent-api` 함수와 마이그레이션은 격리 시험용 후보이며 아직 배포·적용되지 않았다. 운영 DB에는 같은 후보 테이블과 함수가 존재하지 않는다.

사전 동의 HTTP 경계는 신뢰된 활성 세션 검증, 현재 회원 동의, 제한, 서버 측 동일 회원의 연결 요청을 요구하며 문서 버전과 해시는 서비스 구성의 고정값과 비교한다. 응답 `{consentId,status:'recorded'}`는 동의 기록만 뜻하며 네이버 소유권, 초대 발송, 관리자 수락이나 데이터 연결을 증명하지 않는다. 후보 URL은 `POST /functions/v1/kitsnode-ad-consent-api/invite-consents`, 본문은 `{accountId,accepted:true,version,policyDigest}`이다. 운영에는 없는 경로이다.

활성 세션 확인기는 Supabase `getUser(token)` 검증 후에만 JWT `session_id`를 읽으며 신뢰된 서버의 `auth.sessions` 조회가 필수다. 제공하는 `isActive`는 실서비스 어댑터가 아니라 주입 인터페이스다. 단일 예약과 발송 시작 기록은 Postgres 함수에서 원자적으로 처리한다. 발송 시작 후 타임아웃은 재시도하면 안 된다.

운영 전에는 정식 문서 버전·본문·해시, Supabase Auth·Edge 실환경 세션과 service-role 전용 RPC 검증, DB 스키마 변경 검토·마이그레이션, 탈퇴/동의 철회, 멤버 소유권 검증, 동의 전달과 실제 발송 상태 대사, 관리자 승인 증빙 조회 어댑터 및 HTTP 라우트가 필요하다. 관리자 캠페인 조회 후보 역시 운영자·승인된 연결·유효한 회원 동의를 모두 요구하며, 실제 승인 바인딩 어댑터가 없으므로 실서비스에서 동작하지 않는다.

격리 통합 검사는 `KITS_CONSENT_PG_MODULE`에 `pg` 패키지를 포함한 node_modules 경로를 지정해 `tests/sql/run-invite-http-postgres.sh`로 실행한다. 이 검사는 모의 Supabase Auth와 임시 Postgres를 쓰며 실제 Supabase Auth/Edge는 검증하지 않는다.

`tests/sql/run-invite-rpc-postgres.sh`는 제안한 마이그레이션과 실제 Postgres의 service-role RPC를 거쳐 HTTP 동의 기록, 세션 철회, 일반 회원 직접 접근 거부, 회원 삭제 시 기록 연쇄 삭제, 롤백을 격리 검증한다. Edge의 getUser는 합성이므로 실제 인증 테스트가 아니다. `tests/invite-consent-edge-runtime.test.mjs`는 Deno에서 번들 부팅과 익명·비허용 출처 차단을 확인한다. 현재 연결 신청은 광고주 소유권 증빙이 아니며 관리자 승인·네이버 초대·성과 조회와 연결하지 않았다.

후보의 별도 Edge 함수는 서버 환경변수 `KITS_INVITE_CONSENT_VERSION`(영문자·숫자·`.`·`_`·`-`, 1~64자)과 `KITS_INVITE_POLICY_DIGEST`(SHA-256 소문자 64자)를 요구한다. 아직 확정된 값은 없다. 화면에서 사용자가 실제 확인하는 고정된 동일 문서의 정확한 UTF-8 원문을 기준으로 버전과 해시를 생성해 프론트와 서버가 같은 값을 사용해야 한다. 단순 체크 문구만으로 네이버 정책 전체의 내용을 증명할 수 없다. 별도의 서비스 연결 방식, 네이버 정책 전문 및 실제 초대 처리 결속은 여전히 검증되지 않았다.

기존 운영 `kitsnode-ad-api` v16과 기존 서비스 설정은 별도 함수 배포로 건드리지 않는다. 후보 마이그레이션에는 제한된 service_role RPC, Auth 세션·연결 행의 트랜잭션 내 재검증과 회원 삭제 시 동의 연쇄 삭제가 있다. 롤백 SQL은 동의 기록을 삭제하므로 자동 실행하지 않는다. 브라우저/확장에 관리자 키를 넣어서는 안 된다.

격리된 실제 Supabase Auth·PostgREST 검증은 `tests/sql/run-invite-real-stack.sh`를 사용한다. 캐시된 GoTrue/Postgres/PostgREST 컨테이너와 합성 계정 두 개를 이용해 실제 Supabase JS, `getUser`에 해당하는 GoTrue `/user`, 회원 동의 확인, 사용자별 연결 RPC, 회원 동의 저장, 재사용 금지, 다른 회원 및 서비스 전용 RPC 차단, 동의 철회 및 로그아웃을 검증한다. 컨테이너는 테스트 종료 시 제거되며 SMTP와 실제 계정/서비스를 사용하지 않는다. 실제 운영 Supabase나 네이버 OAuth 검사는 아니다. 테스트 전용 컨테이너는 로컬 루프백에 포트를 노출하고 별도 네트워크를 사용한다.

고정 문서 초안은 `public/policies/advertiser-consent-2026-11-21-v1.txt`, 원문은 `docs/advertiser-consent-2026-11-21-v1.md`이다. 이 문서는 키츠노드 사전 동의이며 네이버 정책 전문이 아니다. 현재 프론트 정책 링크는 네이버 도메인만 허용하므로, 두 문서의 링크·서버 증거를 구분하기 전에는 플래그를 활성화하면 안 된다.
