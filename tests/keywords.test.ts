import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { getKeywords } from "../src/services/keywords";
const vars = [
  "NAVER_SEARCHAD_API_KEY",
  "NAVER_SEARCHAD_SECRET_KEY",
  "NAVER_SEARCHAD_CUSTOMER_ID",
];
async function withEnv(fn: () => Promise<void>, configured = false) {
  const previous = vars.map((k) => process.env[k]);
  const fetch = global.fetch;
  try {
    vars.forEach((k) => {
      if (configured) process.env[k] = "test-only";
      else delete process.env[k];
    });
    await fn();
  } finally {
    vars.forEach((k, i) => {
      if (previous[i] === undefined) delete process.env[k];
      else process.env[k] = previous[i];
    });
    global.fetch = fetch;
  }
}
test("no credentials returns labeled demo data without a network request", () =>
  withEnv(async () => {
    global.fetch = async () => {
      throw new Error("network must not be used");
    };
    const r = await getKeywords("가습기");
    assert.equal(r.source, "데모 데이터");
    assert.equal(r.keywords[0].keyword, "가습기");
    assert.equal("cpc" in r.keywords[0], false);
  }));
test("signs server request and maps actual keyword fields without inventing CPC", () =>
  withEnv(async () => {
    global.fetch = async (url, init) => {
      assert.match(String(url), /hintKeywords=%EA%B0%80%EC%8A%B5%EA%B8%B0/);
      const h = init!.headers as Record<string, string>;
      assert.equal(
        h["X-Signature"],
        createHmac("sha256", "test-only")
          .update(`${h["X-Timestamp"]}.GET./keywordstool`)
          .digest("base64"),
      );
      return Response.json({
        keywordList: [
          {
            relKeyword: "가습기",
            monthlyPcQcCnt: "< 10",
            monthlyMobileQcCnt: 100,
            monthlyAvePcClkCnt: 1.2,
            monthlyAveMobileClkCnt: 5.1,
            compIdx: "높음",
          },
        ],
      });
    };
    const r = await getKeywords("가 습기");
    assert.equal(r.source, "실제 데이터");
    assert.equal(r.keywords[0].pcSearches, "< 10");
    assert.equal(r.keywords[0].mobileSearches, 100);
    assert.equal("cpc" in r.keywords[0], false);
  }, true));
test("HTTP, empty response and connection failures return explicit demo data", () =>
  withEnv(async () => {
    for (const mock of [
      async () => new Response(null, { status: 403 }),
      async () => Response.json({ keywordList: [] }),
      async () => {
        throw new Error("offline");
      },
    ]) {
      global.fetch = mock;
      const r = await getKeywords("테스트");
      assert.equal(r.source, "데모 데이터");
      assert.match(r.message, /데모/);
    }
  }, true));
