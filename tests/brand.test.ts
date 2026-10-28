import test from "node:test";
import assert from "node:assert/strict";
import {
  validateBrief,
  formatBrief,
  type ProjectBrief,
} from "../src/lib/brand";
const valid: ProjectBrief = {
  name: "김기획",
  email: "planner@example.com",
  company: "테스트 브랜드",
  type: "브랜드 시그니처 제품",
  description: "브랜드의 공간을 담은 시그니처 오브제를 함께 만들고 싶습니다.",
};
test("accepts a complete project brief and preserves Korean content", () => {
  assert.deepEqual(validateBrief(valid), {});
  const text = formatBrief(valid);
  assert.match(text, /김기획/);
  assert.match(text, /planner@example.com/);
  assert.match(text, /브랜드 시그니처 제품/);
  assert.match(text, /브랜드의 공간/);
});
test("requires a usable contact and meaningful project description", () => {
  const errors = validateBrief({
    ...valid,
    name: "  ",
    email: "invalid@",
    type: "",
    description: "짧음",
  });
  assert.deepEqual(Object.keys(errors).sort(), [
    "description",
    "email",
    "name",
    "type",
  ]);
  assert.throws(() => formatBrief({ ...valid, email: "" }));
});
test("rejects oversized and unknown input before exporting a brief", () => {
  const errors = validateBrief({
    ...valid,
    name: "가".repeat(61),
    email: "a".repeat(255) + "@x.com",
    company: "x".repeat(101),
    type: "unknown",
    description: "x".repeat(2001),
  });
  assert.equal(Object.keys(errors).length, 5);
});
test("trims pasted whitespace and treats company as optional", () => {
  const text = formatBrief({
    ...valid,
    name: " 김기획 ",
    email: " planner@example.com ",
    company: "   ",
    description: "  " + valid.description + "  ",
  });
  assert.match(text, /담당자: 김기획\n/);
  assert.match(text, /브랜드 \/ 회사: 미기재/);
  assert.ok(text.endsWith(valid.description));
});
