export const workspaces = {
  rankings: {
    title: "상품 순위 조회", eyebrow: "PRODUCT RANKINGS",
    description: "검색어별 상품 노출 위치를 확인하는 전용 공간입니다.",
    empty: "아직 조회한 상품 순위가 없습니다.",
    connection: "상품·검색어와 조회 서비스 연결 후 순위 기록을 확인할 수 있습니다.",
    cards: [
      { title: "상품별 순위", text: "내 상품과 검색어를 기준으로 노출 위치를 구분합니다." },
      { title: "조회 조건", text: "검색어·기기·조회 시점을 함께 기록해 같은 조건의 순위를 비교합니다." },
      { title: "변화 추이", text: "실제 조회 이력이 쌓인 뒤 시점별 순위 변화를 확인합니다." },
    ],
  },
  seo: {
    title: "SEO 분석", eyebrow: "SEO CHECKLIST",
    description: "상품 검색 노출에 필요한 항목을 직접 점검하고 상태를 구분하세요.",
    empty: "자동 SEO 분석은 아직 연결되지 않았습니다.",
    connection: "아래 점검표는 직접 평가하는 항목입니다. 상품 페이지를 자동 수집하거나 검색 순위를 예측하지 않습니다.",
    cards: [],
  },
  traffic: {
    title: "방문자 유입(키워드)", eyebrow: "KEYWORD TRAFFIC",
    description: "방문자가 어떤 검색어를 통해 들어왔는지 살펴보는 공간입니다.",
    empty: "아직 연결된 방문자 유입 데이터가 없습니다.",
    connection: "스토어 또는 분석 서비스의 유입 데이터 연결이 필요합니다. 검색량을 실제 방문자 수로 대신 표시하지 않습니다.",
    cards: [
      { title: "유입 키워드", text: "방문으로 이어진 검색어와 실제 유입 수를 확인합니다." },
      { title: "유입 경로", text: "광고와 자연 검색의 방문 경로를 나누어 살펴봅니다." },
      { title: "기간별 비교", text: "같은 집계 기준으로 기간에 따른 유입 변화를 비교합니다." },
    ],
  },
  bidding: {
    title: "자동입찰", eyebrow: "AUDIENCE BIDDING",
    description: "연령·성별·지역 기준의 입찰 관리를 위한 공간입니다.",
    empty: "자동입찰 실행 서비스가 연결되지 않았습니다.",
    connection: "광고 계정과 입찰 서비스 연결이 필요합니다. 현재 입찰 변경이나 광고비 집행은 이루어지지 않습니다.",
    cards: [
      { title: "연령별 입찰", text: "광고 플랫폼이 지원하는 연령 구간별 성과와 입찰 기준을 관리합니다." },
      { title: "성별 입찰", text: "확인 가능한 성별 성과를 기준으로 입찰 조정 항목을 관리합니다." },
      { title: "지역별 입찰", text: "광고 대상 지역별 성과와 입찰 조정 항목을 관리합니다." },
    ],
  },
  "negative-search": {
    title: "부정검색 체크", eyebrow: "SEARCH QUALITY",
    description: "부정검색이 의심되는 검색어와 유입 기록을 점검하는 공간입니다.",
    empty: "아직 점검할 검색·클릭 기록이 없습니다.",
    connection: "검색·클릭 로그와 점검 기준 연결이 필요합니다. 반복 검색만으로 부정 행위를 확정하거나 자동 차단하지 않습니다.",
    cards: [
      { title: "의심 검색어", text: "검색·유입 기록에서 추가 확인이 필요한 항목을 살펴봅니다." },
      { title: "반복 유입 점검", text: "조회 시간과 반복 패턴 등 근거를 함께 검토합니다." },
      { title: "확인 기록", text: "정상 유입과 점검 대상의 판단 근거를 구분해 관리합니다." },
    ],
  },
} as const;
export type WorkspaceId = keyof typeof workspaces;
