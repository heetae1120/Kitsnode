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

test("co-occurring usage, printing and vehicle categories cannot expand relevance", () => {
  const result = classifyKeywords(rows(
    "보조배터리", "캠핑보조배터리", "캠핑용품", "인쇄보조배터리",
    "보조배터리인쇄", "인쇄", "인쇄업체", "블랙박스보조배터리",
    "차량용보조배터리", "아이나비블랙박스", "파인뷰블랙박스",
    "맥세이프보조배터리", "외장배터리", "휴대용배터리",
  ), ["보조배터리"]);
  assert.deepEqual(unrelated(result), ["아이나비블랙박스", "인쇄", "인쇄업체", "캠핑용품", "파인뷰블랙박스"]);
});

test("short shared syllables and generic modifiers do not match another product", () => {
  const result = classifyKeywords(rows("미니가습기", "가습기필터", "가습기", "미니선풍기", "가습기추천", "추천상품"), ["미니가습기"]);
  assert.deepEqual(unrelated(result), ["미니선풍기", "추천상품"]);
  assert.deepEqual(unrelated(classifyKeywords(rows("무선충전기", "유선충전기", "맥세이프충전기"), ["무선충전기"])), ["유선충전기"]);
});
