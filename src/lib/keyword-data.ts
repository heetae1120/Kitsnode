export type Keyword = {
  keyword: string;
  pcSearches: number | string;
  mobileSearches: number | string;
  pcClicks: number | null;
  mobileClicks: number | null;
  competition: string;
};
export type KeywordResult = {
  source: "실제 데이터" | "데모 데이터";
  message: string;
  keywords: Keyword[];
};
export function demoKeywords(
  name: string,
  message = "API 미연결 · 이해를 돕기 위한 가상 키워드 데이터입니다.",
): KeywordResult {
  return {
    source: "데모 데이터",
    message,
    keywords: [
      {
        keyword: name,
        pcSearches: 1240,
        mobileSearches: 8760,
        pcClicks: 18.2,
        mobileClicks: 142.5,
        competition: "높음",
      },
      {
        keyword: `${name} 추천`,
        pcSearches: 580,
        mobileSearches: 3420,
        pcClicks: 9.4,
        mobileClicks: 64.1,
        competition: "높음",
      },
      {
        keyword: `${name} 비교`,
        pcSearches: 210,
        mobileSearches: 1290,
        pcClicks: 3.2,
        mobileClicks: 22.8,
        competition: "중간",
      },
    ],
  };
}
