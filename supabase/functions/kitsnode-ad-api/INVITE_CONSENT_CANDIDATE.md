# 격리된 광고 초대 사전 동의 후보

이 파일과 `invite-*`, `operator-campaign-service.mjs` 모듈은 실제 Edge 함수에 마운트되어 있지 않다. `tests/fixtures/invite-consent/schema-candidate.sql`은 테스트 전용이며 운영 마이그레이션이 아니다. 운영 DB에는 같은 후보 테이블과 함수가 존재하지 않는다.

사전 동의 HTTP 경계는 신뢰된 활성 세션 검증, 현재 회원 동의, 제한, 서버 측 동일 회원의 연결 요청을 요구하며 문서 버전과 해시는 서비스 구성의 고정값과 비교한다. 응답 `{consentId,status:'recorded'}`는 동의 기록만 뜻하며 네이버 소유권, 초대 발송, 관리자 수락이나 데이터 연결을 증명하지 않는다. 후보 URL은 `POST /functions/v1/kitsnode-ad-api/invite-consents`, 본문은 `{accountId,accepted:true,version,policyDigest}`이다. 운영에는 없는 경로이다.

활성 세션 확인기는 Supabase `getUser(token)` 검증 후에만 JWT `session_id`를 읽으며 신뢰된 서버의 `auth.sessions` 조회가 필수다. 제공하는 `isActive`는 실서비스 어댑터가 아니라 주입 인터페이스다. 단일 예약과 발송 시작 기록은 Postgres 함수에서 원자적으로 처리한다. 발송 시작 후 타임아웃은 재시도하면 안 된다.

운영 전에는 정식 문서 버전·본문·해시, Supabase 세션 상태 조회를 위한 최소 권한 DB 연결, DB 스키마 변경 검토·마이그레이션, 탈퇴/동의 철회, 멤버 소유권 검증, 동의 전달과 실제 발송 상태 대사, 관리자 승인 증빙 조회 어댑터 및 HTTP 라우트가 필요하다. 관리자 캠페인 조회 후보 역시 운영자·승인된 연결·유효한 회원 동의를 모두 요구하며, 실제 승인 바인딩 어댑터가 없으므로 실서비스에서 동작하지 않는다.

격리 통합 검사는 `KITS_CONSENT_PG_MODULE`에 `pg` 패키지를 포함한 node_modules 경로를 지정해 `tests/sql/run-invite-http-postgres.sh`로 실행한다. 이 검사는 모의 Supabase Auth와 임시 Postgres를 쓰며 실제 Supabase Auth/Edge는 검증하지 않는다.
