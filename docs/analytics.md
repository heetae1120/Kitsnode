# 방문 분석 운영 준비 (2026-11-08)

현재 상태: 운영 수집은 **비활성**이다. 방문 분석 코드를 기존 main 기준으로 분리 준비했으며 다른 develop 기능을 포함하지 않았다.

- 저장 대상은 Supabase `kits` (`bjpguxwqxlsteektkhwf`)뿐이다. v1 이력에 이어 작성 시간 migration `20261108174904_kitsnode_survey_duration.sql`을 적용했고 v1/v2 호환 Edge Function v3를 배포했다. 파일 버전은 실제 원격 이력에 맞췄다. 원본 SQL 본문과 기존 RLS/service-role 권한은 유지했다.
- Edge 수집은 `ingestEnabled: false`로 고정했다. 허용 프론트 origin은 `https://heetae1120.github.io`, 관리자 origin은 `https://kitsnode-studio-owner.junho960809.chatgpt.site`다. 기존 런타임 service-role 환경변수만 사용하며 새 키/권한을 생성하지 않았다.
- 실제 endpoint 검증: 허용 origin 수집은 503 `collection_disabled`, 인증 없는 보고서는 401, 미허용 origin은 403, 허용 preflight는 204. 테이블 0행, 빈 v2 집계, anon/authenticated 직접 접근 차단을 확인했다. 합성 운영 이벤트를 쓰지 않았다.
- 프론트 수집/동의 UI도 `NEXT_PUBLIC_ANALYTICS_ENABLED=true`와 endpoint가 함께 설정되어야 나타난다. 이번 준비 배포에서는 설정하지 않는다. 프론트 빌드에 서비스 키를 넣지 않는다.
- 동의 UI는 허용 전 전송하지 않으며 거부가 도구 사용을 막지 않는다. 선택값만 브라우저에 저장하고 방문 UUID/이벤트는 저장하지 않는다. 설정 재열기·거부 즉시 정지·다른 탭 철회를 처리한다. 브라우저 저장 실패는 표시하고 거부 시 과거 허용값 제거를 시도한다. DNT/GPC·편집 미리보기 제외는 그대로다.
- 동의 문구의 최대 90일 보관은 아직 운영 가능한 약속이 아니다. 삭제 작업을 설정/실행하지 않았으므로 보관 정책이 실제로 이행되기 전 동의 UI/수집을 켜지 않는다. Supabase 자체 네트워크 로그 정책은 별도이며 앱의 데이터 최소화와 같지 않다.
- 관리자 조회 UI는 별도 비공개 Sites 운영 소스 확인이 필요하다. GitHub main을 그대로 배포하면 최신 편집기를 덮어쓸 수 있어 보류했다. 기존 custom audience를 변경하지 않는다.
- 단위/계약 테스트 201개, SQL 합성 assertion 59개, 정적 빌드/타입 검사/diff 검사를 수행했다. 실제 방문자 수집·인증된 관리자 보고서·브라우저 동의 상호작용은 아직 검증하지 않았다. 현재 실행 환경의 tsx CLI IPC 제한은 `node --import tsx --test tests/*.test.ts`로 동일 테스트를 실행했다.

## 활성화 전 남은 일

1. 실제 보관 정책·고지·삭제 이행과 인프라 로그/비용 보호를 확인한다.
2. 관리자 최신 운영 소스 위에 분석 UI만 적용하고 기존 공유 범위로 배포한다.
3. 수집을 켜기 전 실제 동의/거부·철회·모바일·preview/DNT/GPC를 브라우저에서 검증한다.
4. 승인된 수집 설정과 endpoint를 프론트 빌드에 주입하고 서버 off를 해제한 뒤 실제 저장/집계를 확인한다.

롤백: 프론트 분석 커밋만 되돌려 기존 main 화면으로 돌아갈 수 있다. 서버는 이미 off이며 기능 중단 시 이를 유지한다. nullable 열을 제거하거나 데이터를 삭제할 필요는 없다. 필요하면 v1/v2 호환 서버를 off 상태로 유지한 채 UI만 복구한다.

아래는 이전 구현 당시의 기록으로, 그 시점의 로컬/미적용 상태를 설명한다. 최신 운영 상태는 위 내용을 기준으로 한다.

# 방문 분석 v1: 페이지 체류시간과 설문 중단 지점

## 운영 활성화 (2026-11-10)

- 운영 main 4882886을 기준으로 프론트 빌드의 분석 endpoint와 활성화 값, 수집 함수의 활성화 값 및 일일 삭제 스케줄 migration을 준비했다. 기존 방문자별 허용·거부와 철회 흐름을 보존한다. 삭제는 매일 실행하므로 고지 문구를 90일 경과 후 일일 삭제로 수정했다.
- 운영 DB에는 분석 v1/v2와 보고서 함수가 존재하나 수집은 꺼져 있고 pg_cron은 설치되지 않았다. 관리자 화면은 분석 endpoint를 사용한다. 인증된 보고서 표시와 실제 수집은 아직 검증하지 않았다.
- 순서: 개인정보 고지와 보관·로그 정책을 확정하고 별도 승인 후 스케줄 migration을 적용하여 실행 권한과 성공을 확인한다. 이어 수집 함수를 배포하고, 프론트 main 변경을 배포한 뒤 동의·거부·철회와 합성 방문의 전송 및 인증된 관리자 집계를 검증한다. 실패 시 수집 함수를 즉시 비활성화한다.
- 사용자 승인 후 운영 DB에 일일 삭제 스케줄을 설치하고 동일 함수의 임시 스케줄 실행 성공을 확인한 뒤 임시 작업을 제거했다. 수집 서버 v4를 활성화해 배포했다. 프론트 배포와 실제 방문·인증 보고서 표시 결과는 배포 완료 후 별도 확인한다.

상태: 2026-11-07 사용자 승인으로 Supabase kits 프로젝트에 분석 DB migration과 `kitsnode-analytics` v1을 설치했다. **수집 활성화, origin 설정, 인증정보 생성, 프론트/어드민 배포 및 push는 하지 않았다.**

## 구조와 담당 경계

- 프론트 `Kitsnode`: 화면을 렌더링하지 않는 `VisitorAnalytics`, 순수 시간 모델 `src/lib/analytics.ts`, 설문 고정 `data-analytics-*` 속성.
- 수집 서비스: 프론트 저장소의 `supabase/functions/kitsnode-analytics/`. 기존 Supabase 구조를 사용하며 제3자 분석 SDK를 추가하지 않는다. 정적 Next export 안에 API route를 만들지 않는다.
- DB: `20261107145249_kitsnode_private_analytics.sql`은 승인 후 적용한 migration이다. 로컬 파일명은 원격 이력 버전과 맞췄고 SQL 본문은 변경하지 않았다. 페이지 방문별 최신 누적 snapshot 한 행만 저장한다.
- 어드민 `kitsnode_edit`: 독립 `/analytics/`, 1/7/30일 집계 조회. 기존 admin 토큰·Card/Input/Button/PageHeading을 사용한다. 기존 편집기, 프론트 복사본과 `/tools/admin/`은 바꾸지 않는다.
- 양쪽 기획·디자인·개발 담당이 event/report 필드와 허용 식별자를 함께 확인했다. 기존 `LayoutChanges`, selector 구조, 문구와 발행 계약은 유지한다. 설문 DOM에는 wrapper 없이 고정 속성만 추가한다.

## 무엇을 기록하는가

각 페이지 방문마다 메모리에서 새 UUID를 만든다. 쿠키·localStorage·sessionStorage로 보존하거나 다른 페이지/방문에 연결하지 않는다. 임시 식별자이므로 완전 익명이라는 보장은 하지 않는다.

- 허용된 canonical 페이지 경로, 임시 viewId, sequence.
- 화면 표시 시간 `visibleMs`: visible 상태의 누적 시간. 숨긴 탭의 시간은 제외한다.
- 활동 시간 `engagedMs`: 표시 시간 중 입력·스크롤·포인터 등 활동 신호 후 30초 이내의 시간. 처음 읽기만 한 시간은 활동 시간에 포함되지 않을 수 있다. 실제 주의 집중을 확인하는 지표가 아니다.
- 설문 고정 단계 ID, 마지막 input 신호가 난 고정 필드 ID, 그 후 경과 시간, 서버 접수 성공 확인 후 완료 여부.
- 전송 사유와 서버 수신 시각. 입력 한 번마다 보내지 않고 15초 간격과 숨김·페이지 전환·종료·완료 때 누적 snapshot을 전송한다.

**보내거나 저장하지 않는 것:** 입력 글자·답변·선택값·길이·키 내용, 이름·연락처 값, 상담 접수 ID, 전체 URL·query·hash·referrer, 사용자/세션 ID, IP·user agent·쿠키를 애플리케이션 데이터로 저장하지 않는다. input 값 getter조차 읽지 않는 합성 테스트를 포함한다. `phone` 같은 필드 ID는 입력 값이 아니라 미리 정의된 항목 이름이다.

허용 페이지는 `/tools/`, `start/`, `rankings/`, `seo/`, `traffic/`, `bidding/`, `negative-search/`, `keywords/`, `survey/`, `about/`, `market/`, `consultation/`이다. 단계는 brandVision/audience/category/stage/budget/support/brandGoal/contact, 마지막 필드는 brandVision/audience/categoryOther/brandGoal/store/company/nameRole/phone 또는 null이다.

## 정확도와 종료 해석

- SPA 이동은 이전 페이지를 마감하고 새 viewId를 만든다. bfcache 복귀는 같은 view를 재개하며 숨긴 시간은 제외한다. basePath와 trailing slash를 정규화한다.
- 모든 전송은 `fetch`의 `keepalive`, `credentials: omit`, `referrerPolicy: no-referrer`, `redirect: error`를 사용한다. sendBeacon은 쿠키를 제외할 수 없어 사용하지 않는다. 프론트 HTML에도 no-referrer 정책을 넣는다.
- 종료 요청의 전송/저장은 보장되지 않는다. 강제 종료, 네트워크 단절, 추적 차단으로 짧은 방문 전체 또는 마지막 구간/완료 신호가 누락될 수 있다. 성공으로 추정하거나 자동으로 무한 재시도하지 않는다.
- 같은 view의 sequence가 같거나 작으면 무시하고, 시간은 감소할 수 없다. 중복/순서가 뒤집힌 전송으로 방문수·시간을 합산하지 않는다. 확인된 완료는 후속 신호가 되돌리지 않는다.
- 미완료 설문 중 **서버가 30분 이상 추가 신호를 받지 못한 것**을 미완료 집계에 넣는다. 창 닫힘을 확인한 기록이 아니다. 재개 신호가 도착하면 상태가 바뀔 수 있다. 마지막 입력 필드는 마지막 확인 단계보다 앞 단계일 수 있다.
- view는 최초 수신 후 24시간까지만 갱신된다. 하루 이상 열린/복원된 설문의 늦은 완료는 반영되지 않을 수 있다. duration도 최대 24시간이다.
- 보고서는 최초 수신 시각 기준 최근 N×24시간의 방문별 평균과 설문 집계다. 고유 사람 수, 세션 수, 확정 이탈률이 아니다. 입력하지 않은 항목은 `입력 신호 없음`으로 표시한다.

## 보호 조치와 권한

- 클라이언트는 기본 off. localhost, editor/preview query, iframe, opener, DNT/GPC 신호는 제외한다. 전송 직전에도 다시 확인한다. 별도 staging/테스트 배포 역시 enable flag를 false로 유지해야 한다.
- 수집은 `POST`만, exact HTTPS origin allowlist, 2KiB stream body 제한, 정확한 키/타입/식별자/범위 검증. 임의 문자열 필드를 추가할 수 없다.
- 공개 수집 endpoint의 Origin은 브라우저 경계일 뿐 인증/위조 방지가 아니다. DB에서 origin당 분당 6,000건, view당 분당 120건을 원자적으로 제한한다. 인프라 수준의 요청 제한/비용 알림도 배포 전에 정한다. 잘못된 payload의 Edge 실행 비용까지 DB 제한이 막지는 못한다.
- 통계는 admin origin의 GET만 허용하고 기존 운영 GitHub 저장소 `heetae1120/Kitsnode` 쓰기 권한을 GitHub API에서 확인한다. 메모리 전용 토큰은 URL/저장소/로그에 넣지 않는다. 어드민은 명시적 조회 전에는 API를 호출하지 않는다. 인증 요청은 isolate 내 admin origin당 분당 30회 제한한다.
- DB 테이블은 RLS를 켜고 public/anon/authenticated의 테이블·RPC 권한을 철회한다. service_role만 접근하며 함수는 security invoker다. 브라우저에 service-role key를 제공하지 않는다. API는 원시 방문 행을 반환하지 않는다.
- 앱 코드에는 요청 body/token 로그가 없다. 네트워크 제공자는 요청 과정에서 IP 등을 볼 수 있으므로, 실제 Supabase/gateway/access log의 수집·보관·접근 정책을 별도로 확인해야 한다.

## 운영 활성화 전 체크리스트

1. 분석 목적·최소 수집항목·90일 보관·수탁 서비스와 고지/동의/거부 방식을 확정한다. 기존 설문 연락 동의는 분석 동의가 아니다. **방문자별 동의 UI와 consent 저장 연동은 이번 구현에 없다.** 필요한 동의 처리를 먼저 구현하지 않고 enable flag를 켜지 않는다.
2. 정확한 프론트와 어드민 origin, 전용 cookie-free HTTPS endpoint, 로그 정책과 인프라 요청 제한을 검토한다. localhost나 wildcard를 운영 CORS에 추가하지 않는다.
3. 승인된 비운영 Supabase에서 migration, RLS/RPC, 실제 Edge runtime, CORS, 배포 권한을 검증한다. 아래 로컬 테스트만으로 hosted Supabase 검증을 대체하지 않는다.
4. 별도 승인 후 migration과 `kitsnode-analytics`를 배포한다. 공개 수집을 위해 이 함수에만 `verify_jwt=false`가 필요하며, 보고서는 함수 내 GitHub 인증을 유지한다. 기존 layout 함수의 보안 설정은 변경하지 않는다.
5. 서버 환경: `ANALYTICS_INGEST_ENABLED=false`로 준비하고 `ANALYTICS_FRONTEND_ORIGINS`, `ANALYTICS_ADMIN_ORIGINS`에 쉼표로 분리한 정확한 HTTPS origin을 지정한다. 기본은 모두 비활성/빈 allowlist다. 서비스 키는 기존 서버 secret만 사용한다.
6. 보관 정책 승인 후 `select public.kitsnode_purge_analytics()`를 매일 실행하는 내부 작업을 설정·검증한다. 90일 초과 view와 하루 지난 rate bucket을 삭제한다. migration은 스케줄을 생성하지 않는다. 수집이 없더라도 삭제되어야 한다.
7. 어드민 빌드의 `NEXT_PUBLIC_ANALYTICS_ENDPOINT`를 설정하고 합성 자료로 조회를 검증한다. 프론트는 같은 endpoint와 `NEXT_PUBLIC_ANALYTICS_ENABLED=true`, 서버는 `ANALYTICS_INGEST_ENABLED=true`가 모두 필요하다. 동의와 배포 승인이 완료되기 전에는 켜지 않는다.
8. 수집을 중지할 때는 서버 flag를 false로 바꾸고 프론트도 비활성 빌드한다. 과거 데이터 삭제는 승인된 보관 정책과 작업으로 처리한다.

## 로컬 검증

- 프론트: `npm test` 178개, `npm run build`, `npm run typecheck`, diff check 통과.
- 어드민: 전체 테스트/build/typecheck 통과. 최종 수치는 overview의 검증 기록을 참고한다.
- 합성 테스트: clock/idle/hidden/bfcache/SPA/preview/PII 접근 금지/완료, CORS·인증·payload·size·rate 응답·실패, report allowlist·집계 일관성·UTC timestamp를 확인한다.
- 독립 PostgreSQL 검증: 임시 디렉터리에 `@electric-sql/pglite@0.5.15`만 설치하고 `node scripts/verify-analytics-sql.mjs /tmp/kitsnode-analytics-sql-qa/node_modules/@electric-sql/pglite/dist/index.js` 실행. migration·RLS 권한·집계·중복·순서 역전·rate cap·삭제 20개 assertion 통과. 운영 연결 없음. 프로젝트 의존성/lockfile은 바꾸지 않았다.
- 브라우저: `/analytics/` 기본 미설정 상태를 데스크톱과 390px에서 확인, 기간 선택 동작 및 문서 가로폭 390px 확인. 실제 인증된 보고서의 브라우저 표시/운영 네트워크 수집은 미검증이며 합성 함수 테스트로만 확인했다.
- 참조: [Supabase Edge auth](https://supabase.com/docs/guides/functions/auth-headers), [Supabase CLI v3 변경](https://supabase.com/changelog/supabase-cli-v3). CLI 3.0.0의 local-only `migration new`로 파일만 생성했다.

## 승인된 설치 검증 (2026-11-07)

- 대상: Supabase `kits` (`bjpguxwqxlsteektkhwf`). 분석 테이블 2개와 RPC 3개, `kitsnode-analytics` v1만 설치했다. 기존 layout migration과 함수는 적용하지 않았다.
- 함수 URL: `https://bjpguxwqxlsteektkhwf.supabase.co/functions/v1/kitsnode-analytics`. 배포된 두 소스 파일은 로컬과 동일하며 `verify_jwt=false`다. 보고서의 GitHub 권한 검증은 유지한다.
- 원격 migration 버전 `20261107145249`와 로컬 파일명을 일치시켰다. 새 migration을 추가로 적용하거나 SQL 본문을 바꾸지 않았다.
- 실제 endpoint에서 origin 없는 수집, 합성 미허용 origin 수집, 인증 없는 보고서 요청이 모두 403으로 차단됐다. 원격 테이블은 각각 0행이고 실제 방문자 데이터나 테스트 행을 쓰지 않았다.
- 원격 RLS와 anon/authenticated의 테이블·RPC 접근 차단, service_role의 빈 집계 응답을 확인했다. 보안 advisor는 의도적인 RLS/no-policy INFO 2건뿐이며 health advisor 경고는 없다.
- 설치 전 관련 Node 테스트 18개와 독립 PostgreSQL 검증 20개 assertion이 통과했다. 원격 수집 성공과 인증된 브라우저 조회는 미검증이며, origin 설정·동의·보관 스케줄 및 클라이언트 배포는 여전히 별도 준비가 필요하다.
- 로컬 migration 경로 정리 후 전체 검증: 프론트 `npm test` 178개, 어드민 `npm test` 209개 모두 통과했다. 양쪽 `npm run build`, `npm run typecheck`, `git diff --check`와 독립 PostgreSQL 검증 20개 assertion을 다시 통과했다.


## 설문 작성 시간 확장 (2026-11-08, 로컬 구현)

이번 변경은 로컬 코드와 **미적용 migration**만 추가한다. 이미 설치된 v1 migration 본문은 바꾸지 않았고 원격 DB·Edge Function·수집 활성화·배포·push를 실행하지 않았다.

### 측정 정의

- v2 snapshot의 `survey.timing`은 `null` 또는 `{elapsedMs, visibleMs, engagedMs}`다. 표시 상태인 탭에서 첫 유효 미완료 설문 카드가 렌더된 것을 관찰한 시점부터 시작한다. 카드가 화면 밖에 있는지, 사람이 실제 읽고 있는지는 판별하지 않는다. 초기 카드가 늦게 렌더되어도 안정된 body 관찰로 시작·완료를 확인한다.
- 기존 성공 응답 확인 뒤의 `data-analytics-completed="true"`에서 세 설문 시간을 고정한다. 연락처 단계 진입이나 제출 시도·실패는 완료가 아니다. 페이지 `visibleMs/engagedMs`는 계속 누적하므로 페이지 평균을 작성 시간으로 재사용하지 않는다.
- `elapsedMs`는 숨긴 탭·중단을 포함한 경과 시간이다. `visibleMs`는 탭 표시 시간만, `engagedMs`는 표시 중 최근 30초 안에 활동 신호가 있었던 시간만 누적한다. 실제 타이핑 시간이나 집중도를 뜻하지 않는다. 24시간 상한·best-effort 전송 제한은 기존과 같다.
- 첫 관찰부터 이미 완료인 복원 화면, 시작을 관찰하지 못한 기록과 v1 기록은 null이다. 과거 페이지 시간으로 역산하거나 0으로 채우지 않는다. 실제 측정 0ms는 유효한 표본이다. 새로고침·경로 재진입은 새 방문이며 같은 사람의 여러 시도를 연결하지 않는다. bfcache 복귀는 같은 방문에서 숨김 구간을 제외하고 계속한다.
- 완료 요청이 누락되어도 이후 heartbeat는 같은 고정 시간을 전달한다. 모든 전송이 누락되면 완료를 복구할 수 없다. 기존 답변·입력 값·연락처 수집 금지와 preview/DNT/GPC 제외를 유지한다.

### 서버와 보고서 계약

- `20261108174904_kitsnode_survey_duration.sql`은 CLI `migration new`로 생성한 신규 로컬 파일이다. nullable 시간 열 3개와 범위/일관성 제약을 추가하며 서비스 전용 invoker RPC를 교체한다. 테이블 RLS 및 anon/authenticated 차단을 유지한다. 보관 삭제 함수는 변경하지 않는다.
- 수집기는 엄격한 v1/v2 키 검증을 나누고 경과 ≥ 표시 ≥ 활동, 페이지 시간 상한을 검사한다. 서버는 진행 중 측정 감소/소실을 거부하고, 완료 후 값과 legacy null을 보존한다. 중복·역순 sequence는 기존처럼 무시한다.
- 신규 `survey.timing` 보고서는 `completed/incomplete/pending`별 `samples`, `avgElapsedMs`, `avgVisibleMs`, `avgEngagedMs`, `medianVisibleMs`를 반환한다. `samples=0`이면 평균/중앙값은 null이다. 원시 방문 행은 반환하지 않는다.
- 완료 표본의 평균 표시 시간·중앙값·평균 경과 시간을 어드민 상단에 보여 준다. 활동 시간 정의와 값은 측정 기준 설명에 둔다. 미완료와 대기는 마지막 수신까지의 표시 시간과 각각 표본/상태 건수를 별도로 보여 준다. 30분 미완료는 여전히 **서버가 추가 신호를 받지 못한 시간**이며 확정 이탈이 아니다.
- 어드민은 timing이 없는 구형 서버 보고서도 읽고 ‘시간 통계 미지원’으로 표시한다. 미설정·조회 전·실패·표본 없음은 `—`, 실제 측정 0은 `0초`다. 기간 변경·재조회·토큰 지우기로 이전 수치를 초기화한다. 기존 어드민 토큰/Card/Badge/Caption과 모바일 1열 패턴을 재사용한다.

### 승인 후 릴리스 순서와 검증 한계

1. 구·신 보고서를 모두 읽는 어드민을 먼저 준비한다.
2. 별도 승인 후 신규 migration, v1/v2 수집기를 수용하는 Edge Function 순으로 준비한다.
3. 마지막으로 v2 프론트 수집기를 배포한다. 구형 서버가 v2를 거부하므로 순서를 뒤집지 않는다. 현재 기본 수집 off와 origin·고지/동의·보관 작업의 선행 조건은 그대로다.

합성 PostgreSQL 검사는 `node scripts/verify-survey-duration-sql.mjs /tmp/kitsnode-analytics-sql-qa/node_modules/@electric-sql/pglite/dist/index.js`로 실행했다. 기존 v1 검사 20개와 신규 39개 assertion이 통과했다. 신규 검사는 legacy 업그레이드/null·0, 완료 고정, 중복·감소·역순, 표시/활동/경과 범위, 홀수·짝수 중앙값, 표본 분모, 1/7/30일 경계와 권한 차단을 포함한다.

Chrome에서 loopback 전용 합성 보고서로 평균 표시 2분·중앙값 1분30초·경과 3분, 미완료 표본, 구형 보고서·표본 없음·0초, 기간 변경·실패·로딩·재조회·토큰 초기화를 확인했다. 390px/320px 가로 넘침이 없으며 임시 viewport를 복원했다. mock/개발 서버는 종료하고 실제 기본 미설정 로컬 화면으로 되돌렸다. 실제 운영 인증·수집·DB 적용, Safari/스크린리더 검증은 하지 않았다.


최종 검증: 프론트 `npm test` 186/186, 어드민 233/233, 양쪽 `npm run build`, `npm run typecheck`, `git diff --check` 통과. 어드민 임시 mock endpoint를 제거한 기본 빌드를 다시 생성했고 빌드 산출물에 mock 주소가 없음을 확인했다. 별도 lint 스크립트는 없다. CLI 로컬 경로/telemetry 권한, 테스트 IPC, 출력 래퍼의 zsh 예약 변수 오류는 먼저 보고하고 해결 또는 로그로 실제 완료를 확인했다. 앱의 실패 검사를 통과한 것으로 바꾸거나 운영으로 우회하지 않았다.

## Acquisition categories (event version 3)

After fresh optional consent (preference v2), each page view carries an immutable `attribution` with `basis`, `source`, `medium`, and `campaign`. No full URL, arbitrary hostname, query, UTM value, search term, ad click ID, personal value, persistent visitor identifier, or campaign name is transmitted. Existing refusal remains effective; old opt-in requires a new choice. DNT, GPC and preview exclusions remain unchanged.

`basis` is `utm`, `referrer`, `internal`, or `unknown`. Only explicitly registered source and medium aliases in `analytics-attribution.ts` survive classification. Unknown tagged values become `other_tagged`. Campaign is only `none` or `other_tagged` (미등록 캠페인), indicating tag presence, not a campaign-name breakdown. There are no registered campaign names yet. A future campaign-name feature must register a public, non-identifying taxonomy and update server validation first.

An absent/invalid referrer is `direct_or_unknown`, not proof of direct traffic: apps, browser policies and stripped referrers can hide the source. Same-origin and SPA route transitions are `internal`; later SPA views do not reattribute a stale initial document referrer. Explicit supported UTM tags take precedence. Metrics count page views, not unique users or sessions. Legacy v1/v2 records remain unattributed; historical attribution is never inferred or backfilled. Heartbeats for one view retain its initial accepted categories.

## 메인 유입 세션 (v3 동의)

브랜드 메인 루트(`/`)만 최초 도착 페이지로 집계한다. 맞춤 진단(`/tools/start/`) 등 다른 페이지에서 시작한 방문은 제외한다. 루트에서 즉시 이동하지 않아 최초 외부 출처를 유지한다. 새 동의를 받은 방문만 현재 탭의 임의 UUID와 마지막 활동 시각을 `sessionStorage`에 보관한다. 첫 관측이 메인이며 내부 이동이 아닐 때만 세션 시작 이벤트를 한 번 전송한다. 30분 활동이 없으면 만료되며, 비메인 페이지에서 시작한 세션은 대상이 아니다. 탭 간 사용자 중복을 제거하지 않으며 고유 방문자 수가 아니다. 브라우저 저장 불가, 네트워크 오류, 출처 미전달, 거부 및 DNT/GPC로 누락될 수 있다.

DB는 허용된 유입 범주만 저장하며 세션 이벤트는 재전송되어도 UUID 기준 중복 집계되지 않는다. 관리자 API는 한국시간 날짜·플랫폼·매체·캠페인 분류별 집계만 제공한다. 기존 일일 보관 작업이 90일 초과 세션을 삭제한다. 이전 동의는 v3 새 동의가 필요하며, 기존 거부는 유지한다. 이전 페이지 조회 기록은 세션으로 소급 변환하지 않는다.

## 사이트 접속 세션 (v4 동의)

방문 분석 대상의 공개 페이지 어디로 들어와도 탭 단위 30분 비활동 기준으로 한 세션을 집계한다. 관리 페이지는 제외한다. v4 신규 동의를 받은 후에만 수집하며, 앞선 메인 전용 집계는 사이트 전체 수치가 아니므로 기준 변경 전의 수치로 구분해야 한다. 미동의 및 수집 실패로 일부 접속은 제외되며 탭별 세션은 중복 없는 사람 수가 아니다.
