# KITS — Sensible Everyday Kits

시대의 유산부터 동시대의 트렌드, 내일의 감각까지. 삶과 브랜드의 순간을 완성하는 **오브제 큐레이션 & 크리에이티브 랩 KITS**의 반응형 브랜드 사이트입니다.

## 사이트 구성

- **Brand introduction**: 브랜드 슬로건, Kit의 정의, 고객과 파트너를 위한 관점
- **Our spectrum**: Heritage / Present / Next 전환형 콘텐츠, 방향별 오브제 스터디 연결
- **Object studies**: 카테고리 필터와 상세 모달. 일러스트는 오리지널 벡터 콘셉트이며 실제 판매 제품·클라이언트 작업으로 표시하지 않습니다.
- **The way we make**: Essential Kit, Trend & Futurity, Heritage Reinterpretation, Sensible Realization
- **For partners**: 본질의 발견 → 해답 설계 → 제품 실체화의 프로젝트 프로세스
- **Manifesto**: 과거·현재·미래를 잇는 브랜드 선언
- **Tools**: `/tools/`의 광고 수익성 분석과 `/tools/keywords/`의 네이버 키워드 도구. 두 도구는 공통 상단 메뉴에서 이동합니다.
- **Project brief**: 프로젝트 유형·연락 정보·아이디어를 작성하고 텍스트 복사 또는 파일로 저장

공식 연락처가 제공되지 않아 프로젝트 브리프는 **서버 전송 없이** 사용자가 복사·저장하도록 구성했습니다. 실제 문의가 전송됐다는 완료 메시지를 표시하지 않습니다. 입력 정보는 브라우저 저장소에 보관하지 않습니다. 공식 문의 주소나 처리 서버를 정한 후 실제 접수 기능을 연결할 수 있습니다.

브랜드 홈과 광고 진단 기능은 별도 경로로 나누었습니다. 상단과 하단의 **Tools / 광고 수익성 진단** 링크에서 도구로 이동하고, 도구의 **브랜드 홈** 링크로 돌아올 수 있습니다. 계산기 스타일은 전용 클래스와 래퍼로 격리해 브랜드 화면에 영향을 주지 않습니다. 수익성 계산과 데모 조회는 브라우저에서 동작합니다. 네이버 실제 검색량 조회는 별도 키워드 서버를 연결한 뒤 사용할 수 있으며, 현재 API 키와 외부 서버 연결은 완료하지 않았습니다.

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

- 테스트 30개: 프로젝트 제안서 4개, 광고 계산 13개, 키워드 처리·CSV 6개, 서버 서명·인증 누락·CORS·제한·캐시·응답 매핑 7개
- `build`: `out/`에 HTML/CSS/JS 정적 사이트 생성
- `start`: 생성된 `out/`을 3000번 포트에서 제공
- 폰트: 공식 Pretendard Variable 파일을 `next/font/local`로 포함하여 모든 화면·폼·SVG·차트·툴팁에 적용
- 브라우저 점검: Tools 왕복 이동, 계산 즉시 반영, 실제 폰트 로드, 스타일 격리, 스펙트럼 키보드 탐색, 콘셉트 필터, 상세 창, Esc 닫기, 브리프 복사·다운로드, 모바일 메뉴와 레이아웃

## GitHub Pages

사이트 주소: **https://heetae1120.github.io/Kitsnode/**

`.github/workflows/pages.yml`이 `main` 변경 시 테스트·정적 빌드·Pages 게시를 실행합니다. 저장소 설정에서 Pages의 Source가 **GitHub Actions**로 지정되어 있어야 합니다. 저장소 공개 범위와 요금제에 따라 Pages 사용 가능 여부가 달라집니다.

빌드 시 `PAGES_BASE_PATH`가 저장소 이름(`/Kitsnode`)으로 자동 설정됩니다. 로컬 루트 미리보기는 환경변수 없이 빌드합니다. Pages 경로를 직접 검증하려면 다음처럼 빌드한 `out/`을 `/Kitsnode/`에 마운트해 정적 서버로 제공합니다.

```sh
PAGES_BASE_PATH=/Kitsnode npm run build
```

프리텐다드를 자체 호스팅하므로 외부 폰트 서버나 이미지 호스트 없이 정적 사이트가 동작합니다. 키워드 실제 조회를 선택하는 경우에만 별도 조회 서버를 호출합니다. 공식 폰트 출처는 `orioncactus/pretendard` v1.3.9이며 SIL Open Font License는 `public/licenses/Pretendard-OFL.txt`에 포함되어 있습니다. 그래픽이 SVG로 포함되어 Pages 하위 경로에서도 이미지 주소 설정이 필요하지 않습니다.

## 주요 파일

```text
src/app/page.tsx                브랜드 화면과 상호작용
src/app/globals.css             브랜드 디자인·반응형·모션
src/app/tools/                  광고 진단 화면·전용 스타일·메타데이터
src/app/fonts/                  자체 호스팅 Pretendard Variable
src/lib/calculator.ts           광고 수익성 공통 계산 엔진
src/lib/naver-keywords.ts       기기별 검색량·범위값·정렬·CSV
src/app/tools/keywords/         네이버 키워드 도구 화면
src/components/tools-header.tsx 두 도구의 공통 내비게이션
keyword-api/                   별도 배포할 네이버 조회 서버
src/app/layout.tsx              한국어 문서·SEO·공유 메타데이터
src/components/kit-scene.tsx    오리지널 오브제 벡터 그래픽
src/lib/brand.ts                브랜드 콘텐츠·제안서 검증과 텍스트 생성
src/components/ui/             확장 가능한 UI 컴포넌트 기반
 tests/brand.test.ts             제안서 기능 테스트
.github/workflows/pages.yml    GitHub Pages 자동 배포
```

Next.js App Router, TypeScript, Tailwind CSS 4, Lucide 아이콘을 사용합니다. 스크롤 등장 모션은 `prefers-reduced-motion`을 존중하며, 탭은 방향키·Home·End, 네이티브 모달은 Esc와 키보드 포커스 탐색을 지원합니다.

디자인 참고로 제공된 bklit.com과 21st.dev는 작업 환경의 네트워크 제한으로 직접 열지 못했습니다. 전달받은 브랜드 정의를 기준으로 차콜·아이보리·세이지, 큰 타이포그래피, 오브제 중심의 독자적인 비주얼을 구성했습니다.

## Tools 계산 기준

공헌이익 M은 판매가에서 원가·배송비·기타 비용·판매 수수료를 뺀 값입니다.

- 예상 CPA = CPC / CVR(소수), 개당 예상 순이익 = M − CPA
- 예상 ROAS = 판매가 / CPA × 100, 손익분기 ROAS = 판매가 / M × 100
- 개당 손익분기 클릭 수 = floor(M / CPC). 광고 예산과 무관합니다.
- 예산 내 클릭 = floor(예산 / CPC), 실제 광고비 = 클릭 × CPC, 미사용 예산은 따로 표시합니다.
- 예상 주문 = 클릭 × CVR(소수), 최소 판매량 = ceil(실제 광고비 / M)
- 총순이익 = 예상 주문 × M − 실제 광고비

CPC 0원, CVR 0%, 공헌이익 0 이하, 예산 0원 등은 별도 처리합니다. 세금·반품·환불·할인·미입력 비용과 광고 외 판매는 포함하지 않습니다.

## 네이버 키워드 도구

주소: **https://heetae1120.github.io/Kitsnode/tools/keywords/**

- 키워드를 쉼표로 구분해 최대 5개 입력합니다. **데모 조회**는 가상 예시로 표시합니다.
- PC / 모바일 / 전체 검색량 기준을 전환하고 결과 검색·경쟁 정도 필터·CSV·페이지 이동을 사용할 수 있습니다.
- 검색량은 공식 키워드 도구의 **최근 30일 검색 횟수**, 광고 월평균 클릭 수는 **최근 4주 기준**입니다.
- 순위는 전체 네이버의 실시간 인기 검색어가 아니라 **조회·필터 결과 안의 검색량 순위**입니다.
- `<10`은 0~9 범위를 유지합니다. 범위값은 하한으로 정렬하고 누락값은 `—`로 표시합니다. 월평균 클릭 수로 CPC나 구매전환율을 계산하지 않습니다.
- 실제 조회 실패 시 가상 결과로 몰래 바꾸지 않습니다. 기존 결과를 유지하며 이전 데이터임을 명시합니다.

실제 API 키는 GitHub Pages의 브라우저 코드에 넣을 수 없습니다. `keyword-api/`를 별도 Node.js 호스팅(또는 Vercel의 Other 프로젝트)에 배포하고 인증 정보를 **그 서버의 비밀 환경변수**로 등록하세요. 상세 단계는 [keyword-api/README.md](keyword-api/README.md)에 있습니다.

화면의 **조회 서버 연결**에서 발급된 `/api/keywords` 주소만 저장하면 됩니다. 이 주소는 비밀 값이 아니며 브라우저에 저장됩니다. 서버 주소가 없는 상태에서 **검색량 조회**는 연결 안내를 표시합니다. 기본 서버를 빌드에 고정하려면 비밀 값이 아닌 `NEXT_PUBLIC_KEYWORD_API_URL`을 지정할 수 있습니다.

현재 사용자가 키를 가져올 수 없어 인증 정보·외부 서버 등록은 보류한 상태입니다. 서버 코드는 준비했으나 **실제 네이버 계정 호출은 미검증**입니다. API 키·비밀 키·고객 ID를 채팅이나 클라이언트 코드에 넣지 마세요.
