import type { KeywordRow } from "./naver-keywords";

/**
 * Naver's related-keyword tool mixes in popular keywords from unrelated
 * categories (a search for 보조배터리 can return 암막커튼 or 롱패딩).
 * A keyword is kept as related when it shares the seed's own letters, or —
 * one hop further — a distinctive syllable pair with keywords already related
 * to the seed (휴대용충전기 joins through 고속충전보조배터리).
 */

// Syllable pairs that say nothing about the product itself.
const GENERIC = new Set([
  "추천", "가격", "후기", "리뷰", "할인", "세일", "최저", "최저가", "인기",
  "순위", "정품", "무료", "배송", "세트", "선물", "브랜드", "여성", "남성",
  "여자", "남자", "아동", "키즈", "성인", "사이", "이즈", "용품", "제품",
  "구매", "판매", "직구", "쿠폰", "중고", "대용", "용량", "디자", "자인",
  "블랙", "화이", "이트", "그레", "레이", "미니", "대형", "소형", "휴대",
  "가정", "정용", "사무", "무실", "업소", "소용", "고급", "저렴", "렌탈",
]);

const normalize = (s: string) => s.toLocaleLowerCase().replace(/\s+/g, "");

function pairs(word: string): string[] {
  const w = normalize(word);
  if (w.length < 2) return w ? [w] : [];
  const out: string[] = [];
  for (let i = 0; i < w.length - 1; i++) out.push(w.slice(i, i + 2));
  return out;
}

const distinctive = (word: string) => pairs(word).filter((p) => !GENERIC.has(p));

export type Relevance = "related" | "unrelated";

export function classifyKeywords(
  rows: KeywordRow[],
  seeds: string[],
): Map<string, Relevance> {
  const result = new Map<string, Relevance>();
  const seedWords = seeds.map(normalize).filter(Boolean);
  const seedPairs = new Set(seedWords.flatMap(pairs));

  // Step 1: direct match with a seed.
  const related: string[] = [];
  for (const row of rows) {
    const k = normalize(row.keyword);
    const direct =
      seedWords.some((s) => k.includes(s) || s.includes(k)) ||
      pairs(k).some((p) => seedPairs.has(p) && !GENERIC.has(p));
    if (direct) related.push(k);
    result.set(row.keyword, direct ? "related" : "unrelated");
  }
  if (!seedWords.length) return result;

  // Step 2: one hop through pairs that recur among directly related keywords
  // and are not part of the seed (e.g. 충전 from 고속충전보조배터리).
  const counts = new Map<string, number>();
  for (const k of related)
    for (const p of new Set(distinctive(k)))
      if (!seedPairs.has(p)) counts.set(p, (counts.get(p) ?? 0) + 1);
  const bridges = new Set(
    [...counts].filter(([, n]) => n >= 2).map(([p]) => p),
  );
  if (!bridges.size) return result;
  for (const row of rows) {
    if (result.get(row.keyword) === "related") continue;
    if (distinctive(row.keyword).some((p) => bridges.has(p)))
      result.set(row.keyword, "related");
  }
  return result;
}
