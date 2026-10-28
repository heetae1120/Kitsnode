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

키 등록과 외부 서버 배포는 아직 하지 않았습니다. 현재 인스턴스의 네이버 인증 변수도 없으므로 **실제 계정의 조회 성공은 미검증**입니다. 서버 서명·매핑·CORS·캐시·오류 처리는 모의 응답 테스트로 검증합니다.

## 동작과 제한

- 서버가 HMAC-SHA256(`timestamp.GET./keywordstool`) 서명을 생성하며 브라우저에는 키를 전달하지 않습니다.
- 서버 origin 허용 목록, 클라이언트별 분당 20회 제한, 인스턴스별 분당 60회 상류 호출 제한, 10분 캐시를 둡니다. 캐시 재사용 시 실제 최초 조회 시각을 유지합니다.
- 제한과 캐시는 인스턴스 메모리 기준입니다. 여러 인스턴스로 공개 운영한다면 호스팅 방화벽·공유 제한 저장소 등에서 통합 한도를 적용하세요.
- 네이버 요청은 최대 8초, 반환 목록은 최대 1,000개입니다. 잘린 응답은 표시합니다.
- 인증 실패·할당량·타임아웃·응답 오류는 명시적인 오류를 반환합니다. 자동으로 데모 결과로 바꾸거나 인증 값·상류 오류 원문을 응답에 노출하지 않습니다.
- CORS는 허용 origin만 응답합니다. CORS 자체가 API 이용 인증을 대신하지는 않습니다.
