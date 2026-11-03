import type { KeywordRow } from "./naver-keywords";

export type Relevance = "related" | "unrelated";
const normalize = (word: string) => word.toLocaleLowerCase().replace(/[^a-z0-9가-힣]/g, "");
// Remove presentation modifiers, never product-defining features such as 무선.
const modifiers = /^(?:미니|초소형|소형|대형|휴대용|가정용|사무실용|업소용|고급|저렴한|추천)/;
function core(word: string) {
  let value = word;
  while (modifiers.test(value)) {
    const next = value.replace(modifiers, "");
    if (next.length < 2) break;
    value = next;
  }
  return value;
}
function matches(keyword: string, seed: string) {
  if (keyword.includes(seed) || keyword.includes(core(seed))) return true;
  // Bounded synonyms, never expand through co-occurrence in API results.
  if (seed.includes("보조배터리")) {
    return keyword === "배터리" || keyword === "휴대폰충전기" ||
      ["휴대용배터리", "외장배터리", "휴대폰보조배터리"].some(term => keyword.includes(term));
  }
  if (seed.includes("무선충전기")) {
    return ["무선충전", "맥세이프충전"].some(term => keyword.includes(term));
  }
  return false;
}
/** Conservative lexical relevance. Ambiguous co-occurrence alone is excluded. */
export function classifyKeywords(rows: KeywordRow[], seeds: string[]): Map<string, Relevance> {
  const normalizedSeeds = seeds.map(normalize).filter(Boolean);
  return new Map(rows.map(row => [row.keyword,
    normalizedSeeds.some(seed => matches(normalize(row.keyword), seed)) ? "related" : "unrelated",
  ]));
}
