import { createHmac } from "node:crypto";
import {
  demoKeywords,
  type Keyword,
  type KeywordResult,
} from "../lib/keyword-data";
export { demoKeywords } from "../lib/keyword-data";
export async function getKeywords(name: string): Promise<KeywordResult> {
  const key = process.env.NAVER_SEARCHAD_API_KEY,
    secret = process.env.NAVER_SEARCHAD_SECRET_KEY,
    customer = process.env.NAVER_SEARCHAD_CUSTOMER_ID;
  if (!key || !secret || !customer) return demoKeywords(name);
  try {
    const timestamp = Date.now().toString();
    const signature = createHmac("sha256", secret)
      .update(`${timestamp}.GET./keywordstool`)
      .digest("base64");
    const params = new URLSearchParams({
      hintKeywords: name.replace(/\s+/g, ""),
      showDetail: "1",
    });
    const res = await fetch(
      `https://api.searchad.naver.com/keywordstool?${params}`,
      {
        headers: {
          "X-Timestamp": timestamp,
          "X-API-KEY": key,
          "X-Customer": customer,
          "X-Signature": signature,
        },
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      },
    );
    if (!res.ok)
      return demoKeywords(
        name,
        "네이버 API 요청에 실패하여 데모 데이터를 표시합니다.",
      );
    const data = await res.json();
    if (!Array.isArray(data.keywordList) || !data.keywordList.length)
      return demoKeywords(
        name,
        "조회된 키워드가 없어 데모 데이터를 표시합니다.",
      );
    const keywords: Keyword[] = data.keywordList
      .slice(0, 8)
      .map((row: Record<string, unknown>) => {
        const count = (v: unknown) =>
          typeof v === "number" && Number.isFinite(v)
            ? v
            : typeof v === "string" && /^<\s*\d+$/.test(v)
              ? v
              : "—";
        const clicks = (v: unknown) =>
          typeof v === "number" && Number.isFinite(v) ? v : null;
        return {
          keyword: String(row.relKeyword ?? ""),
          pcSearches: count(row.monthlyPcQcCnt),
          mobileSearches: count(row.monthlyMobileQcCnt),
          pcClicks: clicks(row.monthlyAvePcClkCnt),
          mobileClicks: clicks(row.monthlyAveMobileClkCnt),
          competition: String(row.compIdx ?? "—"),
        };
      });
    return {
      source: "실제 데이터",
      message:
        "네이버 검색광고 키워드 도구 조회 결과입니다. CPC·전환율은 포함되지 않습니다.",
      keywords,
    };
  } catch {
    return demoKeywords(
      name,
      "네이버 API에 연결할 수 없어 데모 데이터를 표시합니다.",
    );
  }
}
