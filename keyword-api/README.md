# KITS 네이버 키워드 조회 서버

GitHub Pages는 정적 호스팅이므로 네이버 비밀 키로 서명하는 서버를 실행할 수 없습니다. 이 디렉터리는 Pages와 분리해 배포하는 작은 Node.js API입니다. **실제 키는 프런트엔드·GitHub 저장소·채팅에 넣지 마세요.**

## 공식 제공 항목

네이버 공식 `naver/searchad-apidoc` 저장소의 `gh-pages:assets/json/ncc-keywordstool.json`과 Python 서명 예제를 확인해 구현했습니다.

- `GET https://api.searchad.naver.com/keywordstool`
- `hintKeywords`: 쉼표로 구분, 최대 5개. `showDetail=1`.
- `relKeyword`: 입력/연관 키워드
- `monthlyPcQcCnt`, `monthlyMobileQcCnt`: 최근 30일 검색 횟수. `<10`은 정확한 0이 아닌 0~9 범위입니다.
- `monthlyAvePcClkCnt`, `monthlyAveMobileClkCnt`: 최근 4주의 키워드 광고별 월평균 클릭 지표
- `compIdx`: PC 광고 경쟁 정도. high/mid/low를 높음/중간/낮음으로 표시합니다.

전체 네이버 검색어의 실시간 인기 순위, 실제 평균 CPC, 구매전환율을 이 API에서 얻었다고 표시하지 않습니다. 화면의 순위는 조회·필터 결과 안에서 기기별 검색량을 정렬한 값입니다.

## 환경변수

`.env.example`을 `.env.local`로 복사하고 **자신의 PC 또는 배포 서비스의 비밀 환경변수 설정에서** 입력합니다. `.env.local`은 Git에서 제외됩니다.

| 이름                         | 내용                                                                                                      |
| ---------------------------- | --------------------------------------------------------------------------------------------------------- |
| `NAVER_SEARCHAD_API_KEY`     | API 라이선스 키                                                                                           |
| `NAVER_SEARCHAD_SECRET_KEY`  | HMAC 서명용 원문 비밀 키                                                                                  |
| `NAVER_SEARCHAD_CUSTOMER_ID` | 고객 ID                                                                                                   |
| `ALLOWED_ORIGINS`            | 허용할 프런트엔드 origin. 기본 `https://heetae1120.github.io`. 여러 개는 쉼표로 구분하며 경로는 넣지 않음 |
| `KEYWORD_API_PORT`           | 로컬 서버 포트, 기본 8787                                                                                 |
| `KEYWORD_API_HOST`           | 로컬 바인딩, 기본 127.0.0.1                                                                               |

프록시에서만 치환되는 placeholder 비밀 키로는 HMAC을 만들 수 없습니다. 실제 서명 가능한 원문 값을 서버의 안전한 비밀 환경변수에 등록해야 합니다.

## 로컬 실행

외부 의존성이 없는 Node.js 22 이상 서버입니다. 저장소 루트에서:

```sh
npm run keywords:server
```

프런트엔드는 별도 터미널에서 `npm run dev`로 실행합니다. 서버 `.env.local`의 `ALLOWED_ORIGINS`에 개발 페이지의 origin(`http://localhost:3000`)을 넣습니다.

키워드 도구의 **조회 서버 연결**에서 `http://localhost:8787/api/keywords`를 저장하고 검색합니다. 키가 없으면 503과 설정 필요 메시지를 반환하며 가짜 실데이터를 반환하지 않습니다.

## 별도 서버 배포 예: Vercel

1. 동일 GitHub 저장소를 새 Vercel 프로젝트에 연결합니다.
2. **Root Directory를 `keyword-api`**, Framework Preset을 **Other**로 선택합니다. 루트 Next.js 프로젝트를 다시 배포하는 방식이 아닙니다.
3. 위의 네이버 인증 정보 세 가지를 서버 환경변수로 등록합니다. `ALLOWED_ORIGINS=https://heetae1120.github.io`도 설정합니다.
4. 배포합니다. `vercel.json`에 API 함수와 정적 안내 페이지가 정의되어 있습니다.
5. 발급된 주소의 `/api/keywords`를 사이트의 **조회 서버 연결**에 입력·저장합니다. 주소는 비밀 값이 아니며 현재 브라우저에만 저장됩니다.

필요하면 프런트엔드 빌드에 비밀 값이 아닌 `NEXT_PUBLIC_KEYWORD_API_URL=https://your-api.vercel.app/api/keywords`를 지정해 기본 주소를 고정할 수도 있습니다. 그 외 네이버 키에는 절대 `NEXT_PUBLIC_`을 붙이지 마세요.

조회 서버는 **https://kitsnode.vercel.app/api/keywords**에 배포되어 있습니다. GitHub Pages 빌드는 이 주소를 기본 조회 서버로 사용하며, 브라우저에서 별도로 저장한 서버 주소가 있으면 해당 설정을 우선합니다. CORS와 배포 응답을 확인했으며, **2026-10-29 실제 검색광고 계정으로 검색량 조회에 성공**했습니다. `미니가습기` 요청이 HTTP 200과 `source: "naver"`인 연관 키워드 716개를 반환했습니다. 이 개수와 검색량은 조회 시점에 따라 달라집니다. 쇼핑 API는 별도 인증이 필요하며 아직 미검증입니다. Production에 등록된 검색광고 인증 정보는 네이버에서 유효한 조합이어야 합니다. 서버 서명·매핑·CORS·캐시·오류 처리는 모의 응답 테스트로 검증합니다.

## 동작과 제한

### 인증 오류 진단

`NOT_CONFIGURED`(누락 또는 공백뿐인 값), `INVALID_AUTH_CONFIG`(앞뒤 공백·실제/문자열 줄바꿈·따옴표·헤더에 사용할 수 없는 문자)는 네이버에 요청하지 않고 503을 반환합니다. 값을 자동으로 잘라내거나 디코딩하지 않습니다. Vercel 환경변수에는 `.env` 문법의 따옴표나 `이름=` 부분을 붙이지 말고 값만 입력하세요.

상류 오류 응답과 검색광고 설정 오류에는 `diagnosticId`가 포함됩니다. Vercel Runtime Logs에서 이 ID 또는 `naver_searchad_error`를 검색하세요. 서버 로그에는 변수 이름별 이상 유형, 상류 HTTP 상태, 고정 서명 방식과 경로, 밀리초 타임스탬프, `clockSkewMs`가 남습니다. `clockSkewMs`는 로컬 시각에서 네이버 응답의 `Date`를 뺀 대략적인 값이며 네트워크 지연과 초 단위 반올림을 포함합니다. `Date`가 없거나 유효하지 않으면 `null`입니다.

네이버 오류 JSON의 `code`와 `message`를 `upstreamError`에 추출해 **서버 로그에만** 기록합니다. RFC 7807 오류는 `type`과 `title`·`detail`을 각각 같은 두 진단 필드로 매핑하며, 동일한 마스킹·길이 제한을 적용합니다. 인증 키·비밀 키·고객 ID·서명과 그 URL 인코딩/Base64 표현, 입력 키워드·요청 URL을 `[REDACTED]`로 마스킹하고 인증 헤더 표현도 제거합니다. 마스킹 후 제어문자를 제거하고 code는 80자, message는 500자로 제한합니다. 전체 응답이나 다른 JSON 필드, 헤더 원문은 기록하지 않으며 클라이언트에는 네이버 code/message를 전달하지 않습니다. 본문은 최대 16KB까지만 읽습니다. `parseStatus`가 `parsed`면 추출 성공이며, 비문자열·비숫자 필드는 `null`입니다. `empty`, `invalid_json`, `too_large`, `unavailable`이면 두 필드는 `null`로 남고 기존 오류 응답은 유지됩니다.

`NAVER_AUTH_ERROR`(상류 401/403)이고 설정 이상이 없다면, 같은 검색광고 계정에서 발급한 API 라이선스 키·원문 비밀 키·고객 ID 조합인지, API 사용 권한이 있는지 확인하세요. 개발자센터 Client Secret이나 네이버 클라우드 인증 방식과 혼용하면 안 됩니다. 비밀 키가 Base64처럼 보여도 디코딩하지 않습니다. 서명은 [공식 예제](https://github.com/naver/searchad-apidoc/blob/master/python-sample/examples/signaturehelper.py)와 같이 원문 UTF-8 키로 `timestamp.GET./keywordstool`을 HMAC-SHA256 처리하고 결과를 Base64로 인코딩합니다. 쿼리 문자열은 서명에서 제외합니다.

Vercel에서 실제 호출 중인 배포의 Production/Preview 환경에 세 변수가 모두 등록되어 있는지 확인하고, 값을 수정한 뒤 새로 배포하세요. 설정이 정상이어도 로그만으로 키 일치 여부나 권한을 확정할 수는 없습니다. 실제 키를 채팅이나 이슈에 붙여 넣지 마세요.

- 서버가 HMAC-SHA256(`timestamp.GET./keywordstool`) 서명을 생성하며 브라우저에는 키를 전달하지 않습니다.
- 서버 origin 허용 목록, 클라이언트별 분당 20회 제한, 인스턴스별 분당 60회 상류 호출 제한, 10분 캐시를 둡니다. 캐시 재사용 시 실제 최초 조회 시각을 유지합니다.
- 제한과 캐시는 인스턴스 메모리 기준입니다. 여러 인스턴스로 공개 운영한다면 호스팅 방화벽·공유 제한 저장소 등에서 통합 한도를 적용하세요.
- 네이버 요청은 최대 8초, 반환 목록은 최대 1,000개입니다. 잘린 응답은 표시합니다.
- 인증 실패·할당량·타임아웃·응답 오류는 명시적인 오류를 반환합니다. 자동으로 데모 결과로 바꾸거나 인증 값·상류 오류 원문을 응답에 노출하지 않습니다.
- CORS는 허용 origin만 응답합니다. CORS 자체가 API 이용 인증을 대신하지는 않습니다.

## 쇼핑 검색 결과 상품 수 (기존 API 권한 보유자용, 선택 연결)

`GET /api/keywords?mode=shopping&keywords=키워드`는 네이버 개발자센터의 쇼핑 검색 API(`https://openapi.naver.com/v1/search/shop.json`)를 호출합니다. `total`을 검색 결과 상품 수로 표시하며 고유 판매자 수나 스마트스토어 전용 상품 수로 표현하지 않습니다.

이 절은 기존 쇼핑 검색 API 권한을 보유한 앱 기준입니다. 신규 신청 경로와 호환성 제한은 문서 아래의 **쇼핑 API 신규 신청 안내 정정**을 먼저 확인하세요. 기존 앱의 별도 서버 환경변수 **NAVER_OPENAPI_CLIENT_ID**, **NAVER_OPENAPI_CLIENT_SECRET**을 등록해야 합니다. 검색광고 API 키·비밀 키와 다르며 개발자센터 앱에 쇼핑 검색 API 사용 권한이 필요합니다. 브라우저에는 등록하지 마세요.

응답은 `{source: "naver-shopping", products: [{keyword, count}], fetchedAt}`입니다. 미등록 시 `503 SHOPPING_NOT_CONFIGURED`를 반환합니다. 한 요청의 힌트가 여러 개이면 쇼핑 API를 키워드별로 호출하므로 그 수만큼 상류 호출 한도를 차감합니다. 캐시와 CORS 정책은 키워드 조회와 같습니다. 실제 키 인증은 미검증이며 모의 응답으로 헤더·상품 수·한도·캐시를 검사했습니다.

키워드 통계 응답에는 제공된 경우 `pcCtr`, `mobileCtr`, `adDepth`를 추가로 매핑합니다. 각각 `monthlyAvePcCtr`, `monthlyAveMobileCtr`, `plAvgDepth`에서 읽으며 월간 검색량이나 클릭 수로 임의 역산하지 않습니다.

## 조회 전용 추정 입찰가와 경쟁 상품 후보

- `GET /api/keywords?mode=bid-estimate&keywords=키워드&device=PC&position=3`: **파워링크** Estimate API를 서명한 POST로 조회합니다. 외부 클라이언트에는 GET만 허용하며 실제 입찰 변경 API는 호출하지 않습니다. PC 위치는 1~10, MOBILE은 1~5입니다. 결과는 `source: "naver-bid-estimate"`, `bids: [{keyword, bid}]`이며 미제공 입찰가는 null입니다. 이 값은 시장 전체의 실제 평균 CPC가 아닙니다.
- 기존 `mode=shopping`에 `details=1`을 더하면 상품 수와 함께 최대 10개 상품의 `title`, `price`, `mallName`, `url`을 반환합니다. 제목 태그와 안전하지 않은 URL을 제거하며, 누락 가격은 null로 둡니다. 기존 상품 수 응답은 유지하고 별도 캐시로 구분합니다. 검색 결과 순서는 광고 순위·전체 판매자 순위가 아닙니다.

### 쇼핑 API 신규 신청 안내 정정 (2026-10-29)

위 Client ID/Secret과 `openapi.naver.com/v1/search/shop.json` 연동은 기존 쇼핑 검색 API 권한을 가진 앱을 위한 방식입니다. 네이버 공식 검색 소개의 신규 이용 신청은 현재 [NAVER API HUB](https://www.ncloud.com/product/applicationService/naverApiHub)로 연결됩니다. API HUB는 호출 주소와 인증 헤더가 다르므로 신규 API HUB 키를 현재 어댑터에 그대로 넣으면 안 됩니다. 확인한 공식 제공 목록에는 상품 검색이 없으며, 쇼핑 인사이트는 상대 클릭 추이 API여서 경쟁 상품 목록을 대체하지 않습니다. 신규 상품 검색의 제공·신청 가능 여부를 확인하기 전에는 자동 목록을 사용할 수 있다고 안내하지 않습니다.

[공식 이관 가이드](https://guide.ncloud-docs.com/docs/apihub-migration), [API HUB 제공 API](https://api.ncloud-docs.com/docs/naver-api-hub-overview) 및 [기능 검토](../docs/naver-api-capabilities.md)를 참조하세요.

### 쇼핑검색광고 추정 입찰가

`GET /api/keywords?mode=shopping-bid-estimate&targetType=id&targetId=광고소재ID&device=PC&position=3`

`targetType=id`는 `nad-`로 시작하는 광고 소재 ID, `targetType=product`는 네이버 쇼핑 상품 ID를 받습니다. 스마트스토어 상품번호와 다를 수 있습니다. 기존 검색광고 인증으로 공식 `POST /npla-estimate/average-position-bid/{type}`를 조회하며 쇼핑 검색 OpenAPI 인증은 필요하지 않습니다. 기기·목표 위치 범위는 파워링크와 같습니다. 응답은 `source: "naver-shopping-bid-estimate"`, `adType: "shopping-search"`, `targetType`, `targetId`, `device`, `position`, `bid`, `fetchedAt`입니다. 미제공·다른 ID·다른 위치의 결과는 `bid: null`이며 파워링크 추정가로 대체하지 않습니다. 광고 유형·ID 유형·기기·목표 위치별 캐시를 분리합니다.

2026-10-29 운영 인증으로 소재 ID의 PC 목표 3위 추정값 조회(HTTP 200)를 검증했습니다. 개인 소재 ID는 문서·공개 화면의 기본값에 저장하지 않았습니다. 추정가는 실시간 낙찰가나 실제 평균 CPC가 아니며, 이 API는 입찰을 변경하지 않습니다. 조회 모드 추가로 자동입찰 기능이 활성화되는 것은 아닙니다.
