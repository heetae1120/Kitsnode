# Cloud Functions 인증 시험 준비

상태: 로컬 준비 중. 이 문서는 배포 지시나 운영 승인 문서가 아니다. 실제 Cloud Functions, Supabase, 네이버, SENS 연동은 검증하지 않았다. 운영 서버 및 프론트 활성화는 금지 상태다.

## 구성

`cloud-functions-runtime.mjs`는 외부에서 전달한 설정을 검사하고 `supabase-pool.mjs`의 TLS 검증 및 최대 1개 연결 풀을 인증 코어와 `cloud-functions-adapter.mjs`에 연결한다. 기본 비활성화된 클라우드 진입점을 제공한다. 풀은 프로세스별 제한이며 전체 함수 인스턴스 수를 제한하지 않는다. 서버리스 동시 실행량, 전체 DB 연결 한도, Supavisor 세션/트랜잭션 모드와 Better Auth/Kysely 호환성을 별도로 검증한다. URL 쿼리 옵션은 TLS 우회 방지를 위해 거부한다. 운영 DB role과 CA 신뢰를 실제 환경에서 검증해야 한다.

필수 비밀 설정은 `MEMBER_DATABASE_URL`, `MEMBER_DATABASE_CA`, `MEMBER_AUTH_SECRET`, `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`, `SENS_ACCESS_KEY`, `SENS_SECRET_KEY`다. 서비스 설정은 `MEMBER_AUTH_ORIGIN`, `MEMBER_FRONTEND_ORIGINS`, `MEMBER_CALLBACK_URLS`, `MEMBER_TERMS_VERSION`, `MEMBER_TERMS_TEXT`, `SENS_SERVICE_ID`, `SENS_FROM`이다. origin 목록과 콜백 목록은 쉼표로 구분한다. 실제 값은 채팅·코드·로그에 남기지 않고 서버 전용 비밀 관리에 넣는다. 함수 event나 요청 본문의 값을 서버 설정으로 사용하지 않는다. 실제 약관 미완성 상태에서는 합성 약관을 격리 시험에서만 사용하고 일반 가입자를 받지 않는다.

메일을 명시적으로 보류하는 격리 시험에서는 `MEMBER_EMAIL_ENABLED=0`을 설정하면 SENS 설정 없이 네이버 인증만 구성된다. 이때 이메일 가입·로그인·인증·비밀번호 재설정 경로는 차단된다. 값이 없거나 `1`이면 기존대로 SENS 설정이 모두 필요하다. 이는 공개 배포 승인이 아니며 실제 약관과 쿠키 검증 등 다른 차단 조건은 유지된다.

한국 VPC Cloud Functions에서 외부 Supabase와 네이버 인증 API에 인터넷으로 접근하려면 Private Subnet의 NAT Gateway가 필요하다. 2026-11-10 확인 요금은 NAT Gateway당 시간당 56원(부가세 별도)이며 추가 처리량 정책을 확인해야 한다. 사설 VPC와 서브넷을 이용한 단독 쿠키 시험에서는 외부 접속이 필요하지 않아 NAT를 만들지 않았다. 운영 방식 결정 시 상시 비용을 포함해 다시 비교한다.

## 시험 전에 필요한 작업

1. 격리된 시험용 DB와 전용 역할을 준비하고 Better Auth의 user/session/account/verification 스키마와 별도 `member_auth_support` 마이그레이션을 검토한다. 기존 운영 DB에 적용하지 않는다. 역할 권한·RLS·비노출·백업·복구를 검증한다.
2. 검증된 인증서와 전용 DB 연결 정보를 안전하게 제공한다. 동일 이메일 자동 병합 금지, 제공자 토큰 미보관, 다중 인스턴스 state 재사용 차단과 공유 rate limiting을 검증한다.
3. 실제 HTTPS 인증 도메인과 격리된 프론트 origin을 확정하고 네이버 개발 앱에 정확한 `/api/auth/callback/naver` 주소를 등록한다. 운영 도메인이 바뀌면 콜백·쿠키 설정을 재검증한다.
4. SENS 발신자·도메인 인증과 메일 프로젝트, 최소 권한 키를 준비한다. 202는 접수이며 실제 배달을 뜻하지 않는다. 본인 소유 테스트 주소로 수신과 링크 만료를 검사한다.
5. Node.js 22 HTTP Web Action에서 raw body 형식(base64/text), gateway 경로 매핑과 헤더 옵션을 실제 호출로 확인한다. CORS 자동 처리를 끄고 애플리케이션의 origin 정책을 적용한다. 실제 한국 VPC 시험에서 두 Set-Cookie가 별도 헤더로 수신되어 어댑터가 배열로 반환한다. 실제 인증 배포와 브라우저에서 로그인·콜백·로그아웃의 쿠키 동작을 검증해야 한다.
6. 실제 네이버 동의·첫 로그인·재로그인·취소·위조 및 중복 콜백과 같은 이메일 충돌을 검증한다. 네이버 이메일 확인 흐름이 미구현이므로 보호 회원 API는 차단된다. 인증·동의·로그아웃·복구 및 브라우저 쿠키 정책을 별도 검증한다.

참고: [API Gateway HTTP 이벤트](https://guide.ncloud-docs.com/docs/en/cloudfunctions-apigateway-vpc), [Supabase PostgreSQL 연결](https://supabase.com/docs/guides/database/connecting-to-postgres), [SENS 메일 요청](https://api.ncloud-docs.com/docs/sens-mail-request-create).

## 추가 로컬 준비

- `index.js`는 Node.js 액션 진입점이다. 서버 환경 변수 `MEMBER_AUTH_STAGING_ENABLED=1`이 없으면 항상 503을 반환하며 event에 같은 이름을 넣어도 활성화되지 않는다. 실제 자원에 배포하지 않았다. 기능 활성화는 이 문서의 모든 차단 항목을 해결한 격리 환경에서만 검토한다.
- `member_auth_shared_rate_limit`은 DB 기반 전역 고정 윈도 카운터다. 동시 요청에서 원자적으로 작동하며 저장소 장애 시 차단한다. 클라이언트 IP를 신뢰하지 않으므로 특정 사용자가 전체 한도를 소진시킬 수 있다. 실운영에는 신뢰 가능한 프록시 식별, 사용자별·계정별 제한과 부하·장애 검증이 추가로 필요하다. OPTIONS는 통과한다.
- `member_auth_staging_privileges`는 비로그인·비슈퍼유저 역할에 지원 테이블별 최소 권한과 정책을 주는 미적용 후보이다. 역할 생성 권한, 로그인 연결, 운영자 역할 분리 및 Supabase pooler 호환성은 실제 격리 DB에서 확인해야 한다. Better Auth 핵심 테이블과 이들의 권한은 포함하지 않는다. 만료된 state 정리는 별도 유지보수 역할이 필요하다.
- 각 마이그레이션은 위에서 정한 지원 스키마 → 공유 제한 → 역할 순서로 검토한다. 실제 DB 변경은 별도 승인 대상이다. PGlite 권한 및 동시성 시험은 실제 Supabase 보안 검증을 대신하지 못한다.

## Better Auth 테이블 및 쿠키 시험 추가

`20261109143906_member_auth_core_staging.sql`은 설치된 Better Auth 1.7.18의 기본 필드를 기준으로 작성한 스키마 후보이며, 앞의 지원 역할 마이그레이션 이후에만 적용할 수 있다. 별도 `member_auth` 스키마, RLS 및 백엔드 역할만 접근하는 정책을 적용하고 계정 provider+account ID에 유일성을 둔다. 로컬 격리 Supabase PostgreSQL에 적용하여 제한된 역할의 가입·가상 메일 인증·세션 및 실제 네이버 로그인, provider 토큰 미보관을 확인했다. 별도의 로컬 PostgreSQL 시험에서 6개 DB 연결의 state 동시 요청 24개 중 하나만 성공했고, 합성 네이버 계정의 동일 이메일 자동 연결이 거부됐다. 실제 호스팅 Supabase 권한과 pooler, SENS 발송은 미검증이다. 보안 검토 및 실제 Better Auth 마이그레이션 도구 비교 후 격리 환경에 적용한다. 풀의 고정 search_path가 실제 Supabase pooler에 반영되는지 직접 검증해야 하며, 트랜잭션 풀러가 세션 설정을 보존한다고 가정하지 않는다.

`cookie-probe.mjs`는 격리된 HTTPS 시험 엔드포인트에서 `kits_probe_a=1`, `kits_probe_b=2`를 각각 별도의 Set-Cookie 헤더로 반환하도록 구성된 경우만 통과한다. `node cookie-probe.mjs <격리_HTTPS_시험_URL>`로 실행하고 인증 쿠키·실제 사용자 데이터는 사용하지 않는다. 2026-11-10 실제 한국 KR-2 VPC Node.js 22 Web Action 및 API Gateway 시험에서 배열로 반환한 쿠키 두 개가 HTTP 응답의 독립된 Set-Cookie 헤더로 수신됐다. 공식 문서의 명시적 다중 헤더 보장은 확인되지 않아 런타임·게이트웨이 설정 변경 시 재검증한다. 이는 실제 인증 쿠키의 브라우저 로그인 흐름 검증을 대체하지 않는다.
