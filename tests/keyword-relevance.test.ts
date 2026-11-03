import test from "node:test";
import assert from "node:assert/strict";
import { classifyKeywords } from "../src/lib/keyword-relevance";
import type { KeywordRow } from "../src/lib/naver-keywords";

const rows = (...words: string[]): KeywordRow[] =>
  words.map((keyword) => ({
    keyword,
    pcSearches: 10,
    mobileSearches: 10,
    pcClicks: null,
    mobileClicks: null,
    competition: "낮음",
  }));
const unrelated = (map: Map<string, string>) =>
  [...map].filter(([, v]) => v === "unrelated").map(([k]) => k).sort();

test("noise from other categories is marked unrelated", () => {
  const result = classifyKeywords(
    rows(
      "보조배터리",
      "보조배터리추천",
      "고속충전보조배터리",
      "보조배터리 충전기",
      "휴대폰충전기",
      "배터리",
      "암막커튼",
      "롱패딩",
      "여성롱패딩추천",
    ),
    ["보조배터리"],
  );
  assert.deepEqual(unrelated(result), ["롱패딩", "암막커튼", "여성롱패딩추천"]);
});

test("generic syllable pairs alone do not make a keyword related", () => {
  const result = classifyKeywords(
    rows("미니가습기", "가습기필터", "미니선풍기", "가습기추천", "선물세트추천"),
    ["미니가습기"],
  );
  assert.deepEqual(unrelated(result), ["미니선풍기", "선물세트추천"]);
});

test("every seed counts and spacing is ignored", () => {
  const result = classifyKeywords(rows("무선 가습기", "텀블러세척", "등산화"), [
    "가습기",
    "텀블러",
  ]);
  assert.deepEqual(unrelated(result), ["등산화"]);
});
