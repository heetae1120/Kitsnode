import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createKeywordHandler } from "../keyword-api/src/handler.mjs";
const env = {
  NAVER_SEARCHAD_API_KEY: "test-key",
  NAVER_SEARCHAD_SECRET_KEY: "test-secret",
  NAVER_SEARCHAD_CUSTOMER_ID: "test-customer",
  ALLOWED_ORIGINS: "https://heetae1120.github.io",
};
const request = (
  keywords = "가습기",
  origin = "https://heetae1120.github.io",
  method = "GET",
) =>
  new Request(
    `https://api.example.com/api/keywords?keywords=${encodeURIComponent(keywords)}`,
    { method, headers: { Origin: origin } },
  );
const payload = {
  keywordList: [
    {
      relKeyword: "가습기",
      monthlyPcQcCnt: "3200",
      monthlyMobileQcCnt: "<10",
      monthlyAvePcClkCnt: "12.3",
      monthlyAveMobileClkCnt: "2.1",
      monthlyAvePcCtr: "1.25",
      monthlyAveMobileCtr: "2.4",
      plAvgDepth: "6.2",
      compIdx: "high",
    },
  ],
};
test("missing server credentials returns 503 without contacting Naver", async () => {
  let called = false;
  const handler = createKeywordHandler({
    fetcher: async () => {
      called = true;
      return Response.json(payload);
    },
  });
  const res = await handler(request(), {});
  assert.equal(res.status, 503);
  assert.equal(called, false);
  assert.equal((await res.json()).code, "NOT_CONFIGURED");
});
test("CORS, HTTP method and keyword validation reject invalid requests before querying", async () => {
  const handler = createKeywordHandler({
    fetcher: async () => {
      throw new Error("must not query");
    },
  });
  assert.equal(
    (await handler(request("키워드", "https://not-allowed.example"), env))
      .status,
    403,
  );
  const options = await handler(request("가습기", undefined, "OPTIONS"), env);
  assert.equal(options.status, 204);
  assert.equal(
    options.headers.get("Access-Control-Allow-Origin"),
    "https://heetae1120.github.io",
  );
  assert.equal(
    (await handler(request("가습기", undefined, "POST"), env)).status,
    405,
  );
  for (const q of ["", "1,2,3,4,5,6", "가".repeat(51)])
    assert.equal((await handler(request(q), env)).status, 400);
});
test("signs the official endpoint and maps only actual provided fields", async () => {
  const now = 1793145600000;
  const handler = createKeywordHandler({
    now: () => now,
    fetcher: async (input, init) => {
      const url = new URL(String(input));
      assert.equal(url.origin, "https://api.searchad.naver.com");
      assert.equal(url.pathname, "/keywordstool");
      assert.equal(url.searchParams.get("hintKeywords"), "미니가습기,텀블러");
      assert.equal(url.searchParams.get("showDetail"), "1");
      const headers = init!.headers as Record<string, string>;
      assert.equal(
        headers["X-Signature"],
        createHmac("sha256", "test-secret")
          .update(`${now}.GET./keywordstool`)
          .digest("base64"),
      );
      return Response.json({
        keywordList: [
          ...payload.keywordList,
          ...payload.keywordList,
          { relKeyword: "추가키워드", compIdx: "low" },
        ],
      });
    },
  });
  const res = await handler(request("미니 가습기,텀블러"), env);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.source, "naver");
  assert.equal(data.keywords.length, 2);
  assert.equal(data.keywords[0].pcSearches, "3200");
  assert.equal(data.keywords[0].mobileSearches, "<10");
  assert.equal(data.keywords[0].pcClicks, 12.3);
  assert.equal(data.keywords[0].pcCtr, 1.25);
  assert.equal(data.keywords[0].adDepth, 6.2);
  assert.equal(data.keywords[0].competition, "높음");
  assert.equal(data.keywords[1].pcSearches, null);
  assert.equal(data.keywords[1].pcClicks, null);
  assert.equal("cpc" in data.keywords[0], false);
});
test("cache reuses original fetchedAt, expires, and caps upstream calls", async () => {
  let time = 1793145600000,
    calls = 0;
  const handler = createKeywordHandler({
    now: () => time,
    fetcher: async () => {
      calls++;
      return Response.json(payload);
    },
  });
  const first = await (await handler(request(), env, "one")).json();
  time += 1000;
  const second = await (await handler(request(), env, "two")).json();
  assert.equal(calls, 1);
  assert.equal(second.cached, true);
  assert.equal(first.fetchedAt, second.fetchedAt);
  time += 600000;
  const third = await (await handler(request(), env, "three")).json();
  assert.equal(calls, 2);
  assert.equal(third.cached, false);
  assert.notEqual(first.fetchedAt, third.fetchedAt);
});
test("limits requests and returns controlled Naver errors without secret leakage", async () => {
  const limited = createKeywordHandler({
    maxRequests: 1,
    fetcher: async () => Response.json(payload),
  });
  await limited(request(), env, "client");
  const rate = await limited(request("다른키워드"), env, "client");
  assert.equal(rate.status, 429);
  assert.equal(rate.headers.get("Retry-After"), "60");
  const auth = createKeywordHandler({
    fetcher: async () =>
      new Response("upstream private diagnostic", { status: 403 }),
  });
  const res = await auth(request(), env);
  assert.equal(res.status, 502);
  const text = await res.text();
  assert.match(text, /NAVER_AUTH_ERROR/);
  assert.ok(!text.includes("test-secret"));
  assert.ok(!text.includes("upstream private diagnostic"));
  const global = createKeywordHandler({
    globalLimit: 1,
    fetcher: async () => Response.json(payload),
  });
  await global(request(), env, "one");
  assert.equal((await global(request("텀블러"), env, "two")).status, 429);
});
test("empty results remain real empty data, malformed results never turn into demo", async () => {
  const empty = createKeywordHandler({
    fetcher: async () => Response.json({ keywordList: [] }),
  });
  const data = await (await empty(request(), env)).json();
  assert.equal(data.source, "naver");
  assert.deepEqual(data.keywords, []);
  for (const fetcher of [
    async () => Response.json({ wrong: [] }),
    async () => new Response("invalid-json"),
  ])
    assert.equal(
      (await createKeywordHandler({ fetcher })(request(), env)).status,
      502,
    );
  const timeout = createKeywordHandler({
    fetcher: async () => {
      const error = new Error();
      error.name = "TimeoutError";
      throw error;
    },
  });
  assert.equal((await timeout(request(), env)).status, 504);
});
test("caps result size and tells the client when a response was truncated", async () => {
  const handler = createKeywordHandler({
    fetcher: async () =>
      Response.json({
        keywordList: Array.from({ length: 1002 }, (_, i) => ({
          ...payload.keywordList[0],
          relKeyword: `키워드${i}`,
        })),
      }),
  });
  const data = await (await handler(request(), env)).json();
  assert.equal(data.keywords.length, 1000);
  assert.equal(data.truncated, true);
});

test("shopping mode needs separate developer credentials rather than Search Ad keys", async () => {
  const handler = createKeywordHandler({
    fetcher: async () => {
      throw new Error("must not query");
    },
  });
  const r = await handler(
    new Request(
      "https://api.example.com/api/keywords?mode=shopping&keywords=test",
    ),
    env,
  );
  assert.equal(r.status, 503);
  assert.equal((await r.json()).code, "SHOPPING_NOT_CONFIGURED");
});
test("shopping mode sends developer headers and keeps product total separate from search volume", async () => {
  let calls = 0;
  const handler = createKeywordHandler({
    fetcher: async (input, init) => {
      calls++;
      const url = new URL(String(input));
      assert.equal(url.origin, "https://openapi.naver.com");
      assert.equal(url.pathname, "/v1/search/shop.json");
      assert.equal(url.searchParams.get("display"), "1");
      assert.equal(
        (init!.headers as Record<string, string>)["X-Naver-Client-Id"],
        "test-developer",
      );
      assert.equal(
        (init!.headers as Record<string, string>)["X-API-KEY"],
        undefined,
      );
      return Response.json({ total: 12345, items: [] });
    },
  });
  const shoppingEnv = {
    NAVER_OPENAPI_CLIENT_ID: "test-developer",
    NAVER_OPENAPI_CLIENT_SECRET: "test-developer-secret",
  };
  const req = new Request(
    "https://api.example.com/api/keywords?mode=shopping&keywords=keyword",
  );
  const first = await handler(req, shoppingEnv);
  const data = await first.json();
  assert.equal(first.status, 200);
  assert.equal(data.source, "naver-shopping");
  assert.deepEqual(data.products, [{ keyword: "keyword", count: 12345 }]);
  assert.equal(data.keywords, undefined);
  assert.equal((await (await handler(req, shoppingEnv)).json()).cached, true);
  assert.equal(calls, 1);
});
test("shopping mode validates totals, protects quotas and returns controlled upstream errors", async () => {
  const shoppingEnv = {
    NAVER_OPENAPI_CLIENT_ID: "test",
    NAVER_OPENAPI_CLIENT_SECRET: "test-secret",
  };
  const req = new Request(
    "https://api.example.com/api/keywords?mode=shopping&keywords=one",
  );
  for (const fetcher of [
    async () => Response.json({ total: -1 }),
    async () => new Response("private", { status: 403 }),
  ])
    assert.equal(
      (await createKeywordHandler({ fetcher })(req, shoppingEnv)).status,
      502,
    );
  const handler = createKeywordHandler({
    globalLimit: 1,
    fetcher: async () => {
      throw new Error("must not query");
    },
  });
  const response = await handler(
    new Request(
      "https://api.example.com/api/keywords?mode=shopping&keywords=one,two",
    ),
    shoppingEnv,
  );
  assert.equal(response.status, 429);
});
