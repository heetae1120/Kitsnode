export const toolLinks = [
  { id: "start", href: "/tools/start/", label: "맞춤 진단" },
  { id: "profit", href: "/tools/", label: "남는 돈 계산" },
  { id: "rankings", href: "/tools/rankings/", label: "상품 순위" },
  { id: "seo", href: "/tools/seo/", label: "상품 검색 점검" },
  { id: "traffic", href: "/tools/traffic/", label: "방문 검색어" },
  { id: "bidding", href: "/tools/bidding/", label: "자동입찰" },
  { id: "negative-search", href: "/tools/negative-search/", label: "의심 클릭 점검" },
  { id: "keywords", href: "/tools/keywords/", label: "검색어 찾기" },
  { id: "survey", href: "/tools/survey/", label: "설문" },
  { id: "about", href: "/tools/about/", label: "소개" },
] as const;

export type ToolId = (typeof toolLinks)[number]["id"];
