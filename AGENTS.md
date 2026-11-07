<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# KITSNODE 프론트 작업 지침

## 두 프로젝트의 협업 원칙

- 어드민 저장소: https://github.com/junho960809-spec/kitsnode_edit
- 프론트 저장소: https://github.com/heetae1120/Kitsnode
- 한쪽 변경이 다른 쪽의 데이터 계약, DOM selector, 화면 복사본, 사용자 흐름 또는 배포 순서에 영향을 주면 구현 전에 상대 프로젝트의 기획·디자인·개발 담당자와 협의한다. 영향 범위와 합의 내용을 PM에게 전달하고 양쪽 검증 항목을 정한다. 상대 저장소를 확인할 수 없으면 가정으로 진행하지 말고 차단 사항을 보고한다.
- `kitsnode_edit`는 어드민(설정 작성·검토·발행), `Kitsnode`는 프론트(발행 설정 소비·방문자 화면)다. 두 저장소는 하나의 제품 계약을 공유하므로 독립 제품처럼 변경하지 않는다.
- 시작할 때 `docs/project-integration.md`, `docs/agent-workflow.md`, 관련 소스와 하위 디렉터리의 AGENTS.md를 읽는다. README의 과거 기능 설명보다 현재 실행 경로를 확인한다.
- PM은 범위·우선순위·인수 기준을 정하고 기획/디자인/개발 에이전트에 담당 파일을 배정한다. `.codex/agents/`의 프로젝트별 역할을 사용한다. 에이전트마다 다른 파일을 소유하고 중복 편집은 PM에게 조정 요청한다.
- 로컬 초안, 공동 초안 저장, 운영 발행은 서로 다르다. UI 수정 요청은 운영 설정 발행 권한이 아니다. 별도 명시적 승인 없이 운영 publish, 배포, merge, push, DB 변경을 실행하지 않는다.
- `LayoutChanges`의 경로·selector·필드와 revision 충돌 검사를 보존한다. DOM 구조, 단계 식별자, 문구에 의존하는 selector를 바꾸면 양쪽 화면에서 기존 설정의 적용 대상을 검증한다.
- 어드민의 운영 화면 복사본과 프론트를 동기화하되 저장소 전체를 덮어쓰지 않는다. 편집 전용 미리보기와 프론트 전용 원격 설정 로더는 의도적으로 다르다.
- 현재 첫 작업은 어드민 디자인 시스템 구축까지만이다. 기존 어드민 화면 적용은 이번 범위에 포함하지 않으며 사용자 후속 승인 후 별도 진행한다. 디자인 시스템은 어드민 UI에 범위를 한정한다. 전역 CSS를 통한 프론트 복사본·계산 도구의 우발적 변경을 피한다. 폰트, 타이포그래피, 버튼, 입력, 간격, 모서리, 상태를 토큰으로 일관화한다.
- 자격 증명, 실제 상담·고객 데이터, 사적 운영 정보를 문서·코드·스크린샷에 넣지 않는다. 테스트는 합성 fixture와 mock을 기본으로 한다.
- 완료 보고에 변경 파일, 양쪽 영향, 실행한 테스트와 결과, 미검증 사항을 남긴다. 실행하지 않은 검사를 통과했다고 쓰지 않는다.
