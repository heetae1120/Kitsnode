# 쇼핑광고 상품 표시

수익성 보고서의 입찰가 아래에 PC 네이버 가격비교 광고 1·2·3위 상품을 표시합니다. 광고 표시를 확인한 상품만 사용하며 일반 상품 검색 결과를 광고 순위로 바꾸지 않습니다.

- `src/data/shopping-ad-observations.json`: 브라우저에서 직접 확인한 기록. 검색어·노출 조건·확인 시각을 보존하고 화면에 **저장된 확인 기록**이라고 표시합니다. 새로 검색해도 이 기록의 시각은 바뀌지 않습니다.
- `src/components/shopping-ad-podium.tsx`: 새 수집 결과를 요청합니다. 실패하면 같은 검색어의 저장 기록만 표시하며 다른 검색어의 상품으로 대체하지 않습니다.
- `keyword-api/api/shopping-ads.js`: 브라우저 수집 서버 연결 지점. 현재 수집 서버가 연결되어 있지 않아 실시간 자동 수집은 미완료입니다. 네이버 공개 페이지에 대한 서버 직접 요청은 2026-11-04 HTTP 418로 차단되었습니다.

## 수집 서버 연결

Vercel 서버 환경변수 `SHOPPING_ADS_COLLECTOR_URL`(HTTPS)과 필요한 경우 `SHOPPING_ADS_COLLECTOR_TOKEN`을 설정합니다. 토큰은 서버에서만 사용합니다. 수집 서버에는 `POST`로 `{keyword, device:"PC", limit:3}`를 전송합니다. 자동 수집 서비스의 비용·접근 권한은 별도 설정이 필요합니다.

응답 형식:

```json
{
  "keyword": "가습기",
  "device": "PC",
  "sourceUrl": "https://search.shopping.naver.com/search/all?query=가습기",
  "observedAt": "2026-11-04T06:13:21.248Z",
  "context": "비로그인 · 네이버 랭킹순 · 첫 페이지 · 리스트 보기",
  "complete": true,
  "items": [
    {"rank":1,"ad":true,"title":"실제 확인한 상품명","mall":"판매처","price":179000,"image":null}
  ]
}
```

`observedAt`은 실제 페이지를 확인한 시각이어야 합니다. 수집 실패는 HTTP 오류로 반환하며 `items:[]`로 감추지 않습니다. 일부 순위만 확인되면 `complete:false`로 두고 원래 순위를 유지합니다. 이미지 주소는 HTTPS `*.pstatic.net`만 표시합니다. 가격은 페이지의 판매가이며 쿠폰가·배송비 포함 가격을 뜻하지 않습니다.

네이버 공식 [쇼핑 검색 API 문서](https://developers.naver.com/docs/serviceapi/search/shopping/shopping.md)의 결과는 광고 순위를 제공하지 않습니다. 해당 API의 [서비스 종료 공지](https://developers.naver.com/notice/article/32564)도 확인했습니다. 이 연결은 그 API를 사용하지 않습니다.
