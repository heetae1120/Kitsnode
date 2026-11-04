export const workspaces = {
  rankings: {
    title: "상품 순위", eyebrow: "검색 순위",
    description: "검색했을 때 내 상품이 몇 번째인지 보는 곳이에요.",
    empty: "아직 순위를 불러오지 않았어요.",
    connection: "상품·검색어를 등록하고 조회 서비스를 연결해야 해요.",
    cards: [
      { title: "상품별 순위", text: "검색어별 내 상품 위치를 봐요." },
      { title: "조회 조건", text: "같은 검색어·기기·시간 기준으로 비교해요." },
      { title: "변화 추이", text: "기록이 쌓이면 순위 변화를 볼 수 있어요." },
    ],
  },
  seo: {
    title: "상품 검색 점검", eyebrow: "검색 노출 점검",
    description: "상품명·설명·이미지를 직접 확인하세요.",
    empty: "자동 상품 검색 점검은 아직 연결되지 않았습니다.",
    connection: "아래 표는 직접 체크하는 기능이에요. 자동 수집·순위 예측은 하지 않아요.",
    cards: [],
  },
  traffic: {
    title: "방문 검색어", eyebrow: "방문 검색어",
    description: "고객이 어떤 검색어로 들어왔는지 보는 곳이에요.",
    empty: "방문 기록이 아직 없어요.",
    connection: "스토어 방문 기록을 연결해야 해요. 검색량은 방문자 수와 달라요.",
    cards: [
      { title: "유입 키워드", text: "방문으로 이어진 검색어를 봐요." },
      { title: "유입 경로", text: "광고로 왔는지, 검색해서 왔는지 나눠 봐요." },
      { title: "기간별 비교", text: "기간별 방문 변화를 비교해요." },
    ],
  },
  bidding: {
    title: "자동입찰", eyebrow: "광고 가격 조절",
    description: "광고 가격을 자동으로 조절하는 기능이에요.",
    empty: "자동입찰은 아직 연결 전이에요.",
    connection: "광고 계정과 실행 서버 연결이 필요해요. 현재 광고 가격을 바꾸거나 돈을 쓰지 않아요.",
    cards: [
      { title: "연령별 입찰", text: "연령별 결과를 보고 조절해요." },
      { title: "성별 입찰", text: "성별 결과를 보고 조절해요." },
      { title: "지역별 입찰", text: "지역별 결과를 보고 조절해요." },
    ],
  },
  "negative-search": {
    title: "의심 클릭 점검", eyebrow: "클릭 점검",
    description: "이상한 검색·클릭이 있는지 살펴봐요.",
    empty: "검색·클릭 기록이 아직 없어요.",
    connection: "검색·클릭 기록과 점검 기준 연결이 필요해요. 반복 검색만으로 부정 클릭이라 판단하거나 차단하지 않아요.",
    cards: [
      { title: "의심 검색어", text: "더 확인할 검색어를 모아 봐요." },
      { title: "반복 유입 점검", text: "언제, 얼마나 반복됐는지 봐요." },
      { title: "확인 기록", text: "정상인지 의심되는지 이유를 적어요." },
    ],
  },
} as const;
export type WorkspaceId = keyof typeof workspaces;
