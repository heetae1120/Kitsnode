# 어드민 ↔ 프론트 통합 계약

## 범위와 근거

이 문서는 저장소 소스에서 확인한 동작을 설명한다. 실제 운영 서버 상태나 권한을 검증했다는 의미가 아니다. 계약 변경 시 양쪽 문서를 함께 검토한다.

- 어드민: `kitsnode_edit`, 설정 작성·미리보기·공동 초안·발행 UI.
- 프론트: `Kitsnode`, 방문자 화면과 발행 설정 소비. 저장 서비스 구현도 프론트 저장소의 `supabase/functions/kitsnode-layout/`와 `supabase/migrations/`에 있다.
- 공통 모델: 양쪽 `src/lib/layout-edits.ts`, `src/lib/fast-layout.ts`.
- 소비 경로: 프론트 `src/components/published-layout.tsx`.
- 작성 경로: 어드민 `src/app/editor/page.tsx`, `src/lib/fast-layout-client.ts`.

## 데이터 형태와 경계

`LayoutChanges`는 페이지 경로 → CSS selector → `LayoutPatch`의 중첩 객체다. patch는 `text`, `color`, `backgroundColor`, `fontSize`, `padding`, `width`, `left`, `top`, `order` 문자열과 `hidden` boolean을 지원한다. 텍스트는 안전한 HTML 요소의 직접 Text 노드가 정확히 하나인 경우에만 적용하며, 자식 태그와 이벤트는 유지한다. 비어 있는 leaf에는 Text 노드를 생성한다. 여러 직접 Text 노드가 섞인 요소와 SVG·입력·스크립트 요소는 제외한다. 위치 변경은 relative positioning을 동반한다. 새 필드를 추가하려면 양쪽 타입·검증·적용기와 서버 검증을 함께 바꿔야 한다.

클라이언트 `isLayoutChanges`는 `/tools/` 접두 경로와 `body` 접두 selector를 검사한다. 서버 `validateLayout`는 더 엄격하다. 현재 허용 페이지는 `/tools/`, `/tools/start/`, `/tools/rankings/`, `/tools/seo/`, `/tools/traffic/`, `/tools/bidding/`, `/tools/negative-search/`, `/tools/keywords/`, `/tools/survey/`, `/tools/about/`, `/tools/market/`, `/tools/consultation/`이다. 페이지당 selector 1,000개 이하, selector 길이 2,000 이하, 문자열 값 길이 4,000 이하를 검사한다. 새 페이지는 서버 allowlist까지 검토한다.

## 초안과 운영 반영

1. 어드민의 로컬 편집은 브라우저 `kitsnode-editor-v1`과 기준 설정 `kitsnode-editor-baseline-v1`에 보관한다. 프론트 방문자에게 공개되지 않는다.
2. `GET ?resource=draft`는 `changes`, `draftRevision`, `baseRevision`, `publishedRevision`을 반환한다. `POST ?resource=save`는 `changes`, `draftRevision`, `publishedRevision`으로 공동 초안만 저장한다.
3. 어드민 발행 UI는 먼저 공동 초안을 저장하고 `POST ?resource=publish`에 두 revision을 전달한다. 서버는 초안을 published로 승격하고 revision과 버전 이력을 갱신한다. 이 작업은 코드 빌드/배포와 별개다.
4. 저장은 기대 draft/published revision을 검사한다. 발행은 여기에 draft base revision 일치까지 요구한다. 충돌은 409로 반환한다. 최신 내용을 확인하지 않고 덮어쓰기나 자동 재발행하지 않는다.
5. `versions` 및 `version&revision=...`으로 이력을 조회한다. 이전 버전을 불러오는 것은 로컬 초안 변경이며 운영 복구는 검토 후 재발행해야 한다.

공개 `GET ?resource=published`는 `changes`, `revision`, `updatedAt`을 반환한다. 다른 동작은 허용 origin과 GitHub 저장소 쓰기 권한을 검사한다. 서버는 GitHub에서 발행 계정 이름을 확인하며 클라이언트가 보낸 actor를 신뢰하지 않는다. 토큰과 서비스 자격 증명은 문서/fixture/로그에 복사하지 않는다. 로컬 개발 origin이 자동 허용된다고 가정하지 말고 mock으로 저장·발행 흐름을 검사한다. 로컬 테스트를 위해 운영 CORS를 임의 완화하지 않는다.

## 프론트 적용과 fallback

프론트 `PublishedLayout`은 `/tools/` 화면에서 번들 `src/data/published-layout.json`을 기본값으로 사용한다. 유효한 `kitsnode-published-layout-v1` 캐시가 있으면 먼저 적용하고, 원격 published를 `no-store`로 조회한다(5초 제한). 유효한 응답을 캐시하고 기존 적용값을 복원한 뒤 새 설정을 적용한다. 실패하면 마지막 유효 설정/번들 기본값을 유지한다. 이미 열린 화면을 실시간 polling하는 구조가 아니므로 새로고침이나 경로 재진입 조건을 함께 확인한다.

`kits_editor` 쿼리가 있는 화면은 PublishedLayout 적용을 건너뛴다. 어드민의 동일 이름 컴포넌트는 번들 JSON 적용용으로 프론트 구현과 다르다. 양쪽 파일을 무조건 동일하게 만들지 않는다. JSON 파일 수정만으로 서버의 published가 바뀌지 않으며, 런타임 publish도 소스 JSON을 자동 갱신하지 않는다.

## DOM 및 소스 복사본 호환성

어드민 `selectorFor`는 `body > ...:nth-of-type(...)` 구조와 `body:has(...)` 상태 범위를 사용한다. `#mp-available`, `#mp-feePercent`, `#report-next`, `.mp-preparation`, 설문의 `.sv-options[aria-label]`, textarea placeholder, `.sv-contact` 등은 호환성에 영향을 준다. 중간 wrapper 추가, 형제 순서 변경, 단계 marker나 접근성 문구 변경도 저장된 selector를 깨뜨릴 수 있다. 존재하지 않는/잘못된 selector는 무시되므로 화면이 오류 없이 열려도 성공으로 판단하지 않는다.

- 현재 양쪽의 `layout-edits.ts`, `fast-layout.ts`, `tool-navigation.ts`는 동일하다. `published-layout.tsx`와 `published-layout.json`은 다르다. 이 비교는 문서 작성 시점 기준이며 작업마다 다시 확인한다.
- 프론트 개발자는 실제 방문자 DOM 변경과 영향 selector를 정리한다. 어드민 개발자는 대응 화면 복사본을 선택적으로 반영하고 미리보기 단계 진입을 보존한다.
- 어드민 개발자는 `editor-preview.ts`, `editor-preview-pages.ts`와 합성 예시·실제 제출 방지 흐름을 보존한다. 테스트용 진입 로직을 프론트에 통째로 복사하지 않는다.
- PM은 양쪽 변경 목록, 이전 published fixture의 적용 결과, 릴리스 순서를 검토한다. 자동 소스 동기화가 있다고 가정하지 않는다. 복사본 동기화와 설정 발행을 서로 대체하지 않는다.

## 공동 검증 기준

- 각 저장소에서 `npm test`, `npm run build`, `npm run typecheck`를 실행한다. CI는 Node 24와 `npm ci`를 사용한다. 의존성 설치/빌드가 불가능하면 사유와 미실행 범위를 보고한다.
- 프론트 `tests/fast-layout-api.test.ts`: 공개 읽기, 인증/권한, 저장·발행, 충돌, 이력, validation을 변경 내용에 맞춰 확인한다. 어드민 `tests/editor-preview.test.ts`: 편집 전용 단계 진입과 일반 방문자 분리를 확인한다.
- synthetic layout fixture로 양쪽 같은 페이지·같은 단계·같은 selector가 의도한 요소 하나를 가리키는지 비교한다. 텍스트/스타일/숨김, 패치 제거, 원격 실패, 캐시 없는 첫 방문, 경로 이동, 오래된 selector를 검사한다.
- 초안 저장만 한 상태에서 프론트가 바뀌지 않고, mock 발행 성공 후 새 published만 소비하는지 검사한다. 두 편집자의 revision 충돌 시 로컬 초안이 보존되는지 확인한다.
- 어드민 UI 토큰 변경 시 편집기 shell, 모달, 버튼 상태, 키보드 focus, 좁은 화면을 확인한다. iframe의 기존 도구 화면과 계산 결과가 달라지지 않아야 한다.
- 실제 서비스 발행·코드 배포·DB migration 적용은 승인된 별도 작업이다. 테스트를 이유로 운영 데이터를 쓰지 않는다.

## 배포 책임

프론트 `.github/workflows/pages.yml`은 main push와 수동 실행에서 GitHub Pages 빌드·배포를 수행한다. `PAGES_BASE_PATH` 하위 경로를 포함해 점검한다. 어드민에는 CI workflow가 있으나 동일한 Pages 배포 workflow는 없다. 두 저장소의 push가 동일하게 배포된다고 가정하지 않는다. 승인 없이 push, merge, workflow_dispatch, 운영 publish를 수행하지 않는다.


## 페이지 저장과 저장 전 프론트 미리보기

- 편집 작업의 자동 복구(`kitsnode-editor-v1`)와 명시적 페이지 저장(`kitsnode-editor-saved-pages-v1`)은 별개다. 페이지 저장은 현재 경로만 저장 snapshot에 교체하며, 다른 경로의 미저장 수정은 포함하지 않는다. 저장 snapshot에는 기준 설정도 보관하며 운영 기준이 달라지면 그대로 발행 후보로 사용하지 않는다.
- 배포 확인창, 공동 저장 payload, 발행 성공 후 baseline은 확인창을 열 때 캡처한 같은 저장 snapshot을 사용한다. 미저장 변경과 비동기 처리 중 추가 수정은 발행에 섞지 않는다. 서버의 revision/409 검사는 유지한다. 페이지 저장은 이 브라우저에만 저장되고 운영 반영은 별도다.
- 사진의 제목/공동 초안/이력 행과 부가 도구 블록, 요소 선택 토글을 제거한다. 요소 선택은 항상 켜져 있다. 저장·미리보기·배포는 상단에 둔다. 실행 취소/다시 실행은 Cmd/Ctrl+Z 및 Shift+Cmd/Ctrl+Z로 이용한다. 공동 초안·이력은 배포 창의 접힌 관리 항목에서 연다.
- 텍스트는 두 번 클릭하거나 요소를 선택한 뒤 F2로 수정한다. 별도의 텍스트 입력 버튼과 속성 창의 텍스트 필드는 두지 않는다. Enter 완료, Shift+Enter 줄바꿈, Esc 취소, blur 완료이며 한글 조합 중 Enter는 확정 처리하지 않는다. HTML 붙여넣기는 plain text로 처리하고 임시 입력 span을 제거해 원래 Text 노드와 자식 구조를 보존한다.
- 실제 프론트 미리보기는 어드민 복사본이 아닌 별도 프론트 창을 연다. `NEXT_PUBLIC_FRONTEND_URL`은 어드민 빌드 시 프론트 기본 경로까지 지정한다(기본 `https://heetae1120.github.io/Kitsnode`). 프론트의 `NEXT_PUBLIC_PREVIEW_ADMIN_ORIGINS`는 쉼표로 구분한 정확한 origin만 추가 허용하며 wildcard는 허용하지 않는다. 운영 기본 허용 origin은 기존 어드민 origin이다.
- `kitsnode-draft-preview-v2`은 정확한 origin, opener/window 객체, 128-bit 임의 session을 모두 확인한다. URL에는 미리보기 표시와 session만 넣고, 현재 페이지 snapshot 및 허용된 단계값은 검증한 postMessage로 한 번 전달한다. 토큰·사용자 입력값·전체 사이트 초안은 전달하지 않는다. 초안은 storage/cache/API save/publish로 기록하지 않는다.
- 프론트는 미리보기에서 published loader를 건너뛰고 읽기 전용으로 표시한다. 폼·링크·입력 동작과 programmatic 쓰기 요청을 차단한다. 연결 timeout과 미배포/출처 설정 오류는 사용자에게 표시하며 어드민 복사본으로 몰래 대체하지 않는다.
- 계산기·설문·진단·키워드의 단계 미리보기는 허용된 단계 식별자만 사용한다. 결과 화면은 명시적으로 예시 데이터를 표시하며 실제 고객/상담/입력 데이터로 오인하게 만들지 않는다. 기존 요소에 단계 속성만 추가하여 selector용 wrapper 구조를 유지한다.
- 릴리스 순서: 프론트의 preview bridge·텍스트 적용기·허용 origin을 먼저 준비한 다음 어드민을 배포하고 실제 origin 조합을 검증한다. 이 문서/로컬 구현은 운영 배포를 수행하거나 승인했다는 의미가 아니다.

로컬 검증에서는 어드민 `NEXT_PUBLIC_FRONTEND_URL=http://127.0.0.1:4312`, 프론트 `NEXT_PUBLIC_PREVIEW_ADMIN_ORIGINS=http://127.0.0.1:4311`처럼 서로 다른 origin을 사용한다. 운영 CORS를 완화하지 않고 저장/발행 API는 합성 mock으로 검사한다.

## 공통 상단바 편집 영역

- 편집할 페이지의 `공통 상단바`는 가상 편집 대상이다. 기존 계산기 DOM의 사이트 메뉴와 계산 요약만 보여 주며 각 페이지 편집 미리보기에서는 두 영역을 숨긴다. 실제 방문자 DOM과 표시 여부는 변경하지 않는다.
- 신규 공통 selector는 `body .tool-topbar` 또는 `body .mp-live-bar` 및 그 자식 경로다. 메뉴 patch는 기존 허용 페이지 경로에 각각 기록하고 계산 요약 patch는 `/tools/`에만 기록하므로 서버 schema와 allowlist는 바뀌지 않는다. JSONB의 객체 순서에 의존하지 않고 양쪽 적용기가 공통 selector를 legacy selector 뒤에 merge한다.
- 공통 저장은 신규 공통 selector만 저장하고 일반 페이지 저장은 그 외 selector만 저장한다. 서로의 미저장 수정을 포함하지 않으며 legacy selector와 기존 초안은 보존한다. 공통 수정의 프론트 미리보기는 전체 계산기 화면을 사용해 실제 상단바 표시도 확인한다.
- 계산 요약의 라벨과 스타일은 수정할 수 있다. 실시간 금액과 상태 안내 문구는 자동 계산/상태를 덮어쓰지 않도록 텍스트 편집에서 제외한다. 공통 화면의 상위 영역 선택도 공통 영역 바깥으로 나가지 않는다.

## 방문 분석 v1

프론트 `VisitorAnalytics`가 허용된 페이지 경로·표시/활동 시간·설문 단계/마지막 입력 필드만 기존 Supabase 구조의 별도 `kitsnode-analytics` 함수로 전송한다. 어드민 `/analytics/`는 GitHub 권한 확인 후 집계만 조회한다. 입력 내용이나 연락처 값, 상담 ID는 전달하지 않으며 기존 DOM 구조·LayoutChanges·발행 계약은 바꾸지 않는다. 데이터는 기본 수집 off다. 2026-11-07 승인 후 분석 DB migration과 Edge Function만 설치했으며 origin 설정·동의 흐름·보관 스케줄 및 프론트/어드민 배포는 미적용이다. 필드 계약, 정확도 한계와 활성화 조건은 [방문 분석](analytics.md)을 양쪽에서 함께 유지한다.


## 설문 작성 시간 v2 연동 (로컬, 2026-11-08)

설문 전용 nullable 경과/표시/활동 시간을 첫 미완료 카드 관찰부터 완료 확인까지 누적·고정한다. 기존 페이지 시간, 설문 DOM·selector 및 LayoutChanges는 바꾸지 않는다. 수집 API는 v1/v2를 구분하고 어드민은 구형 timing 없는 보고서를 계속 표시한다. 기존 데이터의 작성 시간을 추정하지 않는다. 신규 미적용 migration `20261107153632_kitsnode_survey_duration.sql`은 프론트 저장소에 있으며, 릴리스는 어드민 호환 준비 → DB/Edge Function → v2 프론트 순서로 별도 승인 후 진행한다. 이번 로컬 구현은 원격 변경·수집 활성화·배포 승인이 아니다. 정의·한계·검증은 [방문 분석](analytics.md)의 작성 시간 확장을 참고한다.
