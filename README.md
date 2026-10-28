# KITS — Sensible Everyday Kits

시대의 유산부터 동시대의 트렌드, 내일의 감각까지. 삶과 브랜드의 순간을 완성하는 **오브제 큐레이션 & 크리에이티브 랩 KITS**의 반응형 브랜드 사이트입니다.

## 사이트 구성

- **Brand introduction**: 브랜드 슬로건, Kit의 정의, 고객과 파트너를 위한 관점
- **Our spectrum**: Heritage / Present / Next 전환형 콘텐츠, 방향별 오브제 스터디 연결
- **Object studies**: 카테고리 필터와 상세 모달. 일러스트는 오리지널 벡터 콘셉트이며 실제 판매 제품·클라이언트 작업으로 표시하지 않습니다.
- **The way we make**: Essential Kit, Trend & Futurity, Heritage Reinterpretation, Sensible Realization
- **For partners**: 본질의 발견 → 해답 설계 → 제품 실체화의 프로젝트 프로세스
- **Manifesto**: 과거·현재·미래를 잇는 브랜드 선언
- **Project brief**: 프로젝트 유형·연락 정보·아이디어를 작성하고 텍스트 복사 또는 파일로 저장

공식 연락처가 제공되지 않아 프로젝트 브리프는 **서버 전송 없이** 사용자가 복사·저장하도록 구성했습니다. 실제 문의가 전송됐다는 완료 메시지를 표시하지 않습니다. 입력 정보는 브라우저 저장소에 보관하지 않습니다. 공식 문의 주소나 처리 서버를 정한 후 실제 접수 기능을 연결할 수 있습니다.

기존 광고 수익성 계산기 화면·계산 모듈·API 예시·차트 의존성은 브랜드 사이트로 교체했습니다. 이전 구현은 Git 이력에 남아 있습니다.

## 개발과 검증

Node.js 24 / npm 11에서 검증합니다. 저장소 루트에서 실행합니다.

```sh
npm ci
npm run dev
```

개발 서버는 3000번 포트를 사용합니다. 다른 포트는 `npm run dev -- --port 3001`로 지정합니다.

```sh
npm test
npm run build
npm run typecheck
npm start
```

- 테스트: 제안서 검증, 길이 제한, 연락처 형식, 브리프 생성
- `build`: `out/`에 HTML/CSS/JS 정적 사이트 생성
- `start`: 생성된 `out/`을 3000번 포트에서 제공
- 브라우저 점검: 스펙트럼 키보드 탐색, 콘셉트 필터, 상세 창, Esc 닫기, 브리프 복사·다운로드, 모바일 메뉴와 레이아웃

## GitHub Pages

사이트 주소: **https://heetae1120.github.io/Kitsnode/**

`.github/workflows/pages.yml`이 `main` 변경 시 테스트·정적 빌드·Pages 게시를 실행합니다. 저장소 설정에서 Pages의 Source가 **GitHub Actions**로 지정되어 있어야 합니다. 저장소 공개 범위와 요금제에 따라 Pages 사용 가능 여부가 달라집니다.

빌드 시 `PAGES_BASE_PATH`가 저장소 이름(`/Kitsnode`)으로 자동 설정됩니다. 로컬 루트 미리보기는 환경변수 없이 빌드합니다. Pages 경로를 직접 검증하려면 다음처럼 빌드한 `out/`을 `/Kitsnode/`에 마운트해 정적 서버로 제공합니다.

```sh
PAGES_BASE_PATH=/Kitsnode npm run build
```

외부 폰트, 외부 이미지, 서버 API 없이 사이트가 동작합니다. 그래픽이 SVG로 포함되어 Pages 하위 경로에서도 이미지 주소 설정이 필요하지 않습니다.

## 주요 파일

```text
src/app/page.tsx                브랜드 화면과 상호작용
src/app/globals.css             디자인 시스템·반응형·모션
src/app/layout.tsx              한국어 문서·SEO·공유 메타데이터
src/components/kit-scene.tsx    오리지널 오브제 벡터 그래픽
src/lib/brand.ts                브랜드 콘텐츠·제안서 검증과 텍스트 생성
src/components/ui/             확장 가능한 UI 컴포넌트 기반
 tests/brand.test.ts             제안서 기능 테스트
.github/workflows/pages.yml    GitHub Pages 자동 배포
```

Next.js App Router, TypeScript, Tailwind CSS 4, Lucide 아이콘을 사용합니다. 스크롤 등장 모션은 `prefers-reduced-motion`을 존중하며, 탭은 방향키·Home·End, 네이티브 모달은 Esc와 키보드 포커스 탐색을 지원합니다.

디자인 참고로 제공된 bklit.com과 21st.dev는 작업 환경의 네트워크 제한으로 직접 열지 못했습니다. 전달받은 브랜드 정의를 기준으로 차콜·아이보리·세이지, 큰 타이포그래피, 오브제 중심의 독자적인 비주얼을 구성했습니다.
