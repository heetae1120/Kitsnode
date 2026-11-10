# Cloudflare 회원 인증 운영 준비 — 검토 초안

**2026-11-10 최신 확인:** 운영 DB 인증 스키마와 전용 역할이 생성됐고, Hyperdrive의 `verify-full`·캐시 비활성 설정과 Workers 원격 미리보기의 읽기 쿼리를 확인했다. 아래 과거의 스키마 부재·연결 미검증 설명은 당시 기록이다. 실제 운영 약관, 운영 네이버 로그인, 크로스 사이트 브라우저 세션, per-IP/계정 제한, state 정리 스케줄러와 메일 발송은 미완료다. 운영 인증 서비스와 프론트 회원 기능은 배포하지 않았다.

상태: 로컬 후보. 운영 DB 변경, Cloudflare 배포, 네이버 개발자 설정 변경, 프론트 발행은 실행하지 않았다. 기존 운영 약관 문안과 인증 메일 발송은 준비되지 않았으므로 일반 회원 가입을 활성화할 수 없다.

## 연결과 권한

- Cloudflare Workers → Hyperdrive → `kits` Supabase Postgres 직접 연결. Hyperdrive 원본에 Supabase CA와 `verify-full`, 쿼리 캐시 끔을 설정한다. 기존 관리자 `postgres` 비밀번호가 아니라 전용 로그인 역할의 별도 비밀번호를 사용한다.
- 기존 격리 시험용 `member_auth_runtime`은 NOLOGIN 그룹이다. `role-provision-candidate.sql`은 LOGIN 역할 `member_auth_service`가 그룹 권한을 상속하고 DB 기본 검색 경로를 `member_auth, pg_catalog`로 지정하는 검토 후보이다. 생성 직후 암호가 없어 연결이 불가능하다. 비밀번호는 별도의 안전한 서버 전용 수단으로 주입하고 소스, 명령 이력, 로그, 채팅에 넣지 않는다.
- 선행 후보 SQL: `20261109142215_kitsnode_member_auth_support.sql` → `20261109143636_member_auth_shared_rate_limit.sql` → `20261109143737_member_auth_staging_privileges.sql` → `20261109143906_member_auth_core_staging.sql` → 역할 후보 순서다. 해당 SQL은 격리 시험용 후보이며 운영 적용 전 마이그레이션 이력, 잠금·충돌, 롤백 및 권한 검토가 필요하다.
- 2026-11-10 현재 운영 DB에 두 회원 스키마와 역할은 없다. RLS, 비공개 스키마, 최소 권한, 기본 PUBLIC 권한 및 다른 스키마 접근 거부를 실제 전용 역할로 검증한다. 로컬 역할 시험은 운영 환경 검증이 아니다.
- Hyperdrive가 연결을 재사용하는 조건에서 역할 기본 search_path와 스키마 분리, 트랜잭션 경계, 동시 로그인 및 쿠키 전달을 검증하기 전 활성화 금지. 요청별 pool과 전역 rate limit만으로 전체 DB 연결 제한 및 계정/IP별 요청 제한을 보장하지 않는다.

## 격리된 실연동 시험

실제 네이버 로그인은 시험용 HTTPS origin 및 네이버 개발자센터에 일치하는 `/api/auth/callback/naver` 등록이 필요하다. 실제 약관을 임의로 만들어 운영에 기록하지 않는다. 합성 약관과 네이버 시험 계정은 별도 격리 DB에서만 사용한다. 로컬 Supabase는 Cloudflare에서 직접 접근할 수 없으므로 비용과 보안이 확인된 격리 DB 또는 적합한 별도 격리 수단이 필요하다.

검증: 첫 로그인과 재로그인, 취소·위조·재사용 state, 같은 이메일 기존 계정의 자동 병합 방지, provider 토큰 미보관, 세션 발급/만료/로그아웃, 동일·교차 사이트 쿠키와 제3자 쿠키 차단, CORS/허용 origin, 승인된 프론트 경로, rate limit 및 장애 대응, 요청당 연결 반환과 동시 부하. 네이버 이메일의 소유권을 검증하지 않으므로 보호 API 차단을 유지한다. `MEMBER_EMAIL_ENABLED=0`에서는 이메일 관련 모든 인증 경로가 비활성이다.

## 운영 반영 선행 조건

실제 이용약관과 개인정보 안내의 버전 확정, 이메일 도메인·발신 인증 및 실제 전달 검증, 전용 계정 안전한 비밀 관리, Cloudflare 실제 런타임 호환 검증 및 신뢰 가능한 클라이언트별 요청 제한, 프론트 `NEXT_PUBLIC_MEMBER_AUTH_URL`과 네이버 정확한 콜백 origin 확정, 사이트 간 쿠키 정책 검증, 장애 복구 및 삭제 정책. 현재 어느 것도 운영 활성화 승인이나 배포 완료를 의미하지 않는다.

로컬 Workers 통합 시험의 네이버 시작 응답에서 state 쿠키는 `SameSite=Lax; Secure`로 관찰됐다. 이 관찰은 상태 쿠키에 한정되며 세션 쿠키를 증명하지 않는다. 현재 프론트와 인증 origin이 교차 사이트라면 로그인 후 세션 쿠키가 요청에 포함되는지 별도 브라우저 시험 및 적절한 쿠키 설계가 필요하다.

### 무료 격리 접근 후보 조사 (2026-11-10)

별도 Supabase 프로젝트 `heetaejunho_first`에는 기존 테이블과 활성 함수가 있어 빈 시험 프로젝트로 간주하지 않는다. Cloudflare 공식 문서의 다른 후보는 Mac의 로컬 Supabase를 Cloudflare Tunnel → Workers VPC 서비스 → Hyperdrive로 연결하는 방법이다. Workers VPC는 공개 베타 동안 무료이며 일반 Workers/Hyperdrive 한도는 별도 적용된다. 외부에서 Mac DB에 도달하는 민감한 네트워크 경로이므로 별도의 접근 통제, 임시 전용 DB 계정, DB TLS·인증서 호환성, 시험 후 Tunnel/VPC/Hyperdrive 정리와 베타 변경 위험을 확인해야 한다. 구성과 실제 비용, 네이버 OAuth 브라우저 동작은 아직 검증되지 않았다.
