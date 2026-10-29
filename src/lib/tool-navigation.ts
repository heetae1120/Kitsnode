export const toolLinks = [
  { id: "start", href: "/tools/start/", label: "맞춤 진단" },
  { id: "profit", href: "/tools/", label: "수익성 분석" },
  { id: "rankings", href: "/tools/rankings/", label: "상품 순위 조회" },
  { id: "seo", href: "/tools/seo/", label: "SEO 분석" },
  { id: "traffic", href: "/tools/traffic/", label: "방문자 유입(키워드)" },
  { id: "bidding", href: "/tools/bidding/", label: "자동입찰" },
  { id: "negative-search", href: "/tools/negative-search/", label: "부정검색 체크" },
  { id: "keywords", href: "/tools/keywords/", label: "네이버 키워드 도구" },
] as const;

export type ToolId = (typeof toolLinks)[number]["id"];
