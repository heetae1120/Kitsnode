# 네이버 API로 제공할 수 있는 진단 범위

확인일: 2026-10-29. 공식 문서의 기능 범위와 이 저장소의 구현 상태를 구분한다.

| 목적 | 쇼핑 검색 API | 필요한 API·데이터와 구현 |
| --- | --- | --- |
| 검색 결과 상품·가격·쇼핑몰·상품 수 | 지원 | 네이버 개발자센터 검색 API의 `/v1/search/shop.json`. 검색 결과 순서는 광고 순위·전체 판매자 순위와 다르다. 별도 Client ID/Secret 필요. |
| 키워드 최근 30일 PC·모바일 검색량 | 미지원 | 검색광고 API `/keywordstool`. 검색 횟수이며 방문자·구매자 수가 아니다. |
| 시장 전체의 실제 평균 CPC | 미지원 | 키워드 도구 응답에는 없다. 내 광고 계정의 기간별 실제 CPC는 검색광고 통계의 `cpc` 등으로 조회하는 별도 연동이 필요하다. |
| 위치별 추정 입찰가 | 미지원 | 검색광고 `/estimate/average-position-bid/keyword`. 평균 노출 위치 통계를 이용한 추정 입찰가이며 실결제 평균 CPC가 아니다. 이번 작업에서 조회 전용으로 구현한다. |
| 자동입찰 | 미지원 | 검색광고 API는 키워드·광고그룹의 입찰가 변경 등을 제공한다. 주기 실행 서버, 예산·상한·변경 이력과 운영 규칙은 별도 개발이 필요하다. 이번 작업에서는 실제 입찰가를 변경하지 않는다. |
| 연령·성별·지역 타깃 | 미지원 | 검색광고 Target 문서에 `AGE_TARGET`, `GENDER_TARGET`, `REGIONAL_TARGET` 등의 조회·변경 정의가 있다. 모든 광고 유형에서 동일한 입찰 가중치 조정이 가능하다는 뜻은 아니므로 해당 캠페인·상품의 지원 범위를 확인해야 한다. |
| 부정검색·부정클릭 판별 | 미지원 | 쇼핑 검색 API는 개별 검색·클릭 로그나 부정 행위 판정 결과를 제공하지 않는다. 검토한 검색광고 API 문서에서도 모든 클릭의 IP와 부정 여부를 확정하는 API는 확인되지 않았다. 접근 가능한 로그·통계와 판별 규칙, 수동 검토가 필요하며 반복만으로 부정을 단정하지 않는다. |
| 자동 SEO·유입 분석 | 미지원 | 상품 원본·스토어 통계 등 추가 데이터와 분석 로직이 필요하다. 현재 종합 리포트의 SEO는 사용자가 직접 확인한 체크리스트이며 공식 네이버 점수나 자동 크롤링 결과가 아니다. |

## 공식 출처

- [네이버 쇼핑 검색 API](https://developers.naver.com/docs/serviceapi/search/shopping/shopping.md): 요청·응답 필드, 정렬, 상품 수와 상품 목록.
- [네이버 검색광고 API](https://naver.github.io/searchad-apidoc/)
- [검색광고 Estimate 정의](https://github.com/naver/searchad-apidoc/blob/gh-pages/assets/json/estimate.json): `RequestWithPosition`, `EstimateBidByPosition`.
- [검색광고 광고·타깃 정의](https://github.com/naver/searchad-apidoc/blob/gh-pages/assets/json/ncc-heroes-ncc.json): 키워드·광고그룹 수정, Target 조회·수정과 광고 유형별 제한.
- [검색광고 통계 정의](https://github.com/naver/searchad-apidoc/blob/gh-pages/assets/json/ncc-report.json): 계정 소유 광고 객체의 통계 필드.

## 진단 화면의 계산 원칙

- 공헌이익 = 판매가 − 원가 − 배송·기타 비용 − 판매 수수료.
- 100회 클릭 광고비 = 입력한 CPC × 100. 이를 **초과**하는 공헌이익을 내려면 `floor(광고비 / 개당 공헌이익) + 1`개의 판매가 필요하다. 단순 손익분기와 양의 이익을 구분한다.
- 비용과 CPC가 같거나 비용 구조가 불리하면 100회 클릭이 모두 구매로 이어져도 양의 순이익이 남지 않을 수 있다.
- 비용·CVR·CPC 가정은 사용자가 입력한다. 추정 입찰가를 CPC로 쓰는 경우 명시적으로 선택한다. 입력하지 않은 비용·실제 성과·SEO 점수·시장 평균을 임의 생성하지 않는다.
- 리포트는 현재 화면에서 계산하며 텍스트 다운로드와 인쇄/PDF 저장을 제공한다. 개인정보·재무 입력을 네이버 조회 서버에 전송하지 않는다. 서버에는 조회 키워드만 전달한다.

## 신규 신청 경로 확인에 따른 제한

공식 검색 API 소개의 이용신청 링크는 현재 [NAVER API HUB](https://www.ncloud.com/product/applicationService/naverApiHub)로 연결됩니다. 기존 NAVER Developers의 신규 앱 API 선택 화면에는 검색이 표시되지 않는 사례를 확인했습니다. [이관 가이드](https://guide.ncloud-docs.com/docs/apihub-migration)는 새 Client ID/Secret과 `X-NCP-APIGW-API-KEY-ID`, `X-NCP-APIGW-API-KEY`, `naverapihub.apigw.ntruss.com`으로의 변경을 설명합니다. 기존 `X-Naver-Client-Id/Secret` 및 `openapi.naver.com`과 호환되지 않습니다.

[API HUB 공식 제공 목록](https://api.ncloud-docs.com/docs/naver-api-hub-overview)에서 뉴스·백과사전·블로그·이미지·지식iN·지역·카페글 등의 검색, 검색어 트렌드와 쇼핑 인사이트는 확인했으나, 상품·가격 목록을 반환하는 쇼핑 상품 검색은 확인하지 못했습니다. 이것만으로 기존 쇼핑 검색 API의 종료를 단정할 수는 없습니다. 현재 자동 경쟁 상품 목록 어댑터는 **기존 쇼핑 검색 권한이 있는 앱**을 대상으로 하며, 신규 가입자에게 발급·연동이 가능하다고 보장하지 않습니다. 쇼핑 인사이트의 상대 클릭 지수는 상품 목록·전체 방문자 수나 부정검색 판정을 대체하지 않습니다.
