"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Download,
  Search,
  Printer,
  RotateCcw,
} from "lucide-react";
import { ToolsHeader } from "@/components/tools-header";
import { FinanceBento } from "@/components/ui/finance-bento";
import { SeoChecklist } from "@/components/seo-checklist";
import {
  calculate,
  validateInput,
  won,
  num,
  type ProductInput,
} from "@/lib/calculator";
import {
  clickTargetText,
  diagnosisPath,
  type SellerAnswers,
} from "@/lib/business-diagnosis";
import {
  formatCount,
  formatRange,
  parseSeeds,
  rowVolume,
  validateEndpoint,
  validateKeywordResponse,
  type KeywordData,
} from "@/lib/naver-keywords";
import "@/app/tools/finance-bento.css";
import "@/app/tools/workspaces.css";
import "@/app/tools/start/start.css";

type ProductCandidate = {
  title: string;
  mallName: string;
  price: number | null;
  url: string | null;
};
type ShoppingData = {
  source: "naver-shopping";
  fetchedAt: string;
  products: { keyword: string; count: number; items?: ProductCandidate[] }[];
};
type BidData = {
  source: "naver-bid-estimate";
  fetchedAt: string;
  device: string;
  position: number;
  bids: { keyword: string; bid: number | null }[];
};
const fields = [
  ["price", "판매가", "원"],
  ["cost", "상품 원가", "원"],
  ["shipping", "판매자 배송비", "원"],
  ["other", "개당 기타 비용", "원"],
  ["feePercent", "판매 수수료", "%"],
  ["cpc", "평균 CPC 또는 CPC 가정", "원"],
  ["cvrPercent", "구매전환율 가정", "%"],
  ["budget", "분석할 광고 예산", "원"],
] as const;
type Draft = { name: string } & Record<(typeof fields)[number][0], string>;
const emptyDraft: Draft = {
  name: "",
  price: "",
  cost: "",
  shipping: "0",
  other: "0",
  feePercent: "0",
  cpc: "",
  cvrPercent: "",
  budget: "",
};
const pathNames = {
  starter: "시작 전 시장·손익 진단",
  profit: "광고 시작 전 수익성 요약",
  report: "스토어 운영 종합 리포트",
};
function safeLink(value: string | null) {
  try {
    const url = new URL(value || "");
    return ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}
export function BusinessIntake() {
  const [answers, setAnswers] = useState<SellerAnswers>({
    store: null,
    ads: null,
    agency: null,
  });
  const path = diagnosisPath(answers);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [report, setReport] = useState<ProductInput | null>(null);
  const [reportAt, setReportAt] = useState("");
  const [cpcKind, setCpcKind] = useState<"manual" | "actual" | "estimate">(
    "manual",
  );
  const [market, setMarket] = useState<KeywordData | null>(null);
  const [bid, setBid] = useState<BidData | null>(null);
  const [shopping, setShopping] = useState<ShoppingData | null>(null);
  const [marketErrors, setMarketErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [manualProducts, setManualProducts] = useState<
    { name: string; price: string; keyword: string }[]
  >([]);
  const [competitor, setCompetitor] = useState({ name: "", price: "" });
  const [seo, setSeo] = useState<Record<string, string>>({});
  const controller = useRef<AbortController | null>(null);
  const reportRef = useRef<HTMLElement>(null);
  useEffect(() => () => controller.current?.abort(), []);
  function answer(next: SellerAnswers) {
    setAnswers(next);
    setReport(null);
    setSeo({});
    setError("");
  }
  function changeQuery(value: string) {
    controller.current?.abort();
    controller.current = null;
    setLoading(false);
    setQuery(value);
    setMarket(null);
    setBid(null);
    setShopping(null);
    setMarketErrors([]);
    setReport(null);
    if (cpcKind === "estimate") {
      setDraft((d) => ({ ...d, cpc: "" }));
      setCpcKind("manual");
    }
  }
  async function lookup(event: FormEvent) {
    event.preventDefault();
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    let keyword: string;
    let endpoint: string;
    try {
      const seeds = parseSeeds(query);
      if (seeds.length !== 1)
        throw new Error("맞춤 진단에서는 키워드를 한 개씩 조회해 주세요.");
      keyword = seeds[0];
      let saved = "";
      try {
        saved = localStorage.getItem("kits.keyword-api-url") || "";
      } catch {}
      endpoint = validateEndpoint(
        saved || process.env.NEXT_PUBLIC_KEYWORD_API_URL || "",
      );
      if (!endpoint)
        throw new Error("키워드 도구에서 조회 서버 주소를 먼저 설정해 주세요.");
    } catch (e) {
      setMarketErrors([(e as Error).message]);
      return;
    }
    setLoading(true);
    if (cpcKind === "estimate") {
      setDraft((d) => ({ ...d, cpc: "" }));
      setCpcKind("manual");
    }
    setMarketErrors([]);
    setMarket(null);
    setBid(null);
    setShopping(null);
    setReport(null);
    const timeout = setTimeout(() => current.abort(), 16000);
    const call = async (mode: string) => {
      const url = new URL(endpoint);
      url.searchParams.set("keywords", keyword);
      url.searchParams.set("mode", mode);
      if (mode === "shopping") url.searchParams.set("details", "1");
      const response = await fetch(url, {
        signal: current.signal,
        credentials: "omit",
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          typeof data.error === "string"
            ? data.error.slice(0, 300)
            : "조회에 실패했습니다.",
        );
      return data;
    };
    try {
      const results = await Promise.allSettled([
        call("keywords"),
        call("bid-estimate"),
        call("shopping"),
      ]);
      if (controller.current !== current || current.signal.aborted) return;
      const errors: string[] = [];
      results.forEach((result, i) => {
        const label = ["검색량", "추정 입찰가", "경쟁 상품"][i];
        if (result.status === "rejected") {
          errors.push(
            `${label}: ${result.reason instanceof Error ? result.reason.message : "조회 실패"}`,
          );
          return;
        }
        try {
          const data = result.value;
          if (i === 0) setMarket(validateKeywordResponse(data));
          if (i === 1) {
            if (
              data.source !== "naver-bid-estimate" ||
              !Array.isArray(data.bids) ||
              data.bids.some(
                (r: { keyword: unknown; bid: unknown }) =>
                  !r ||
                  typeof r.keyword !== "string" ||
                  (r.bid !== null &&
                    (typeof r.bid !== "number" ||
                      !Number.isFinite(r.bid) ||
                      r.bid <= 0)),
              )
            )
              throw new Error("잘못된 추정 입찰가 응답");
            setBid(data);
          }
          if (i === 2) {
            if (
              data.source !== "naver-shopping" ||
              !Array.isArray(data.products) ||
              data.products.some(
                (r: { count: unknown; items?: ProductCandidate[] }) =>
                  !r ||
                  typeof r.count !== "number" ||
                  !Number.isSafeInteger(r.count) ||
                  r.count < 0 ||
                  (r.items !== undefined &&
                    (!Array.isArray(r.items) ||
                      r.items.some(
                        (item) =>
                          !item ||
                          typeof item.title !== "string" ||
                          typeof item.mallName !== "string" ||
                          (item.price !== null &&
                            (typeof item.price !== "number" ||
                              !Number.isFinite(item.price) ||
                              item.price < 0)) ||
                          (item.url !== null && typeof item.url !== "string"),
                      ))),
              )
            )
              throw new Error("잘못된 상품 응답");
            setShopping(data);
          }
        } catch (e) {
          errors.push(`${label}: ${(e as Error).message}`);
        }
      });
      setMarketErrors(errors);
      setDraft((d) => ({ ...d, name: d.name || keyword }));
    } finally {
      clearTimeout(timeout);
      if (controller.current === current) {
        setLoading(false);
        if (current.signal.aborted)
          setMarketErrors(["조회 시간이 초과되었습니다. 다시 조회해 주세요."]);
      }
    }
  }
  function buildReport(event: FormEvent) {
    event.preventDefault();
    if (!path) return;
    if (fields.some(([key]) => !draft[key].trim())) {
      setError(
        "모든 비용·광고 조건을 입력해 주세요. 비용이 없으면 0을 입력하세요.",
      );
      return;
    }
    const input = {
      name: draft.name,
      ...Object.fromEntries(fields.map(([key]) => [key, Number(draft[key])])),
    } as ProductInput;
    const invalid = validateInput(input);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError("");
    setReport(input);
    setSeo({});
    setReportAt(
      new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) + " KST",
    );
    requestAnimationFrame(() =>
      reportRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }
  const keywordRow = market?.keywords.find(
    (row) =>
      row.keyword.replaceAll(" ", "").toLowerCase() ===
      (market.queriedKeywords[0] || "").toLowerCase(),
  );
  const estimatedBid =
    bid?.bids.find(
      (row) =>
        row.keyword.toLowerCase() === query.replace(/\s/g, "").toLowerCase(),
    )?.bid ?? null;
  const cpcLabel =
    cpcKind === "actual"
      ? "사용자가 입력한 광고 실적 평균 CPC"
      : cpcKind === "estimate"
        ? "네이버 추정 입찰가를 CPC 가정으로 사용"
        : "사용자가 입력한 CPC 가정";
  function downloadReport() {
    if (!report || !path) return;
    const r = calculate(report);
    const text = [
      pathNames[path],
      `작성: ${reportAt}`,
      `운영: ${answers.agency === true ? "대행사 이용" : answers.ads ? "직접 광고 운영" : answers.store ? "광고 시작 전" : "스토어 시작 전"}`,
      `상품: ${report.name}`,
      `판매가 ${won(report.price)} / 원가 ${won(report.cost)}`,
      `CPC ${won(report.cpc)} · ${cpcLabel}`,
      `전환율 ${num(report.cvrPercent)}% · 입력 가정`,
      `예산 ${won(report.budget)} / 예상 광고비 ${won(r.adSpend)}`,
      `예상 총순이익 ${won(r.totalProfit)}`,
      `예상 ROAS ${r.roas === null ? "계산 불가" : num(r.roas) + "%"}`,
      clickTargetText(report),
      `검색량: ${keywordRow ? formatRange(rowVolume(keywordRow, "all")) + "회 · 최근 30일 · 네이버 API" : "미조회 또는 정확히 일치하는 키워드 없음"}`,
      `시장 전체 실제 평균 CPC: 제공되지 않음`,
      `추정 입찰가: ${estimatedBid === null ? "미조회/미제공" : won(estimatedBid) + " · 실제 평균 CPC와 다름"}`,
      ...Object.entries(seo).map(
        ([label, value]) =>
          `SEO 직접 점검 · ${label}: ${({ positive: "긍정", normal: "보통", improve: "개선 필요" } as Record<string, string>)[value] || "미평가"}`,
      ),
      `경쟁 상품: ${shopping ? "네이버 쇼핑 검색 결과 · 광고 순위 아님" : "자동 조회 미연결"}`,
      ...(shopping?.products[0]?.items || []).map(
        (row) => `${row.title} / ${won(row.price)} / ${row.mallName}`,
      ),
      ...manualProducts.map(
        (row) =>
          `직접 입력 경쟁 상품: ${row.name} / ${won(Number(row.price))} / 검색어: ${row.keyword || "미입력"}`,
      ),
      "유입 통계·실시간 순위·자동입찰·부정검색 판별: 미연결",
      "입력값에 따른 예측이며 실제 판매·수익을 보장하지 않습니다. 미입력 세금·환불·대행 수수료 등은 제외됩니다.",
    ].join("\n");
    const url = URL.createObjectURL(
      new Blob(["\uFEFF" + text], { type: "text/plain;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "KITS-맞춤진단-리포트.txt";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div className="finance-dashboard tools-workspace business-intake">
      <ToolsHeader active="start" />
      <main>
        <section className="intake-hero">
          <span>KITS BUSINESS DIAGNOSIS</span>
          <h1>
            지금 내 사업에 필요한 <em>다음 한 걸음.</em>
          </h1>
          <p>
            경험에 맞는 질문에 답하고, 검색 수요와 남는 이익을 한눈에
            확인하세요.
          </p>
        </section>
        <section
          className="intake-panel intake-questions"
          aria-label="사업 경험 질문"
        >
          <div className="intake-question">
            <span className="intake-step">01</span>
            <div>
              <h2>스마트스토어를 운영해 본 적이 있나요?</h2>
              <div className="intake-choices">
                {[true, false].map((value) => (
                  <button
                    key={String(value)}
                    aria-pressed={answers.store === value}
                    onClick={() =>
                      answer({ store: value, ads: null, agency: null })
                    }
                  >
                    {value ? "O · 운영해 봤어요" : "X · 처음 시작해요"}
                    {answers.store === value && <Check size={15} />}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {answers.store === true && (
            <div className="intake-question">
              <span className="intake-step">02</span>
              <div>
                <h2>광고를 집행해 본 적이 있나요?</h2>
                <div className="intake-choices">
                  {[true, false].map((value) => (
                    <button
                      key={String(value)}
                      aria-pressed={answers.ads === value}
                      onClick={() =>
                        answer({ store: true, ads: value, agency: null })
                      }
                    >
                      {value ? "O · 광고 경험이 있어요" : "X · 아직 없어요"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          {answers.store === true && answers.ads === true && (
            <div className="intake-question">
              <span className="intake-step">03</span>
              <div>
                <h2>광고는 어떤 방식으로 운영하나요?</h2>
                <div className="intake-choices">
                  {[true, false].map((value) => (
                    <button
                      key={String(value)}
                      aria-pressed={answers.agency === value}
                      onClick={() => answer({ ...answers, agency: value })}
                    >
                      {value ? "대행사를 이용해요" : "직접 운영해요"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          {path && (
            <p className="intake-path">
              <Check size={16} /> {pathNames[path]}로 안내합니다.
            </p>
          )}
        </section>
        {path && (
          <>
            <section
              className="intake-panel intake-market"
              aria-label="시장 데이터 조회"
            >
              <div className="intake-section-heading">
                <div>
                  <span>MARKET SIGNALS</span>
                  <h2>
                    {path === "starter"
                      ? "어떤 키워드로 시작하고 싶나요?"
                      : "운영 중인 키워드를 살펴보세요"}
                  </h2>
                </div>
                <Link href="/tools/keywords/">
                  키워드 도구 전체 보기 <ArrowRight size={14} />
                </Link>
              </div>
              <form className="intake-market-form" onSubmit={lookup}>
                <label>
                  <Search size={18} />
                  <input
                    aria-label="진단할 키워드"
                    placeholder="예: 미니가습기"
                    maxLength={50}
                    value={query}
                    onChange={(e) => changeQuery(e.target.value)}
                  />
                </label>
                <button disabled={loading}>
                  {loading ? "조회 중…" : "시장 데이터 조회"}
                </button>
              </form>
              <p className="intake-note">
                실제 검색량·추정 입찰가·쇼핑 검색 결과를 각각 조회합니다. 평균
                CPC는 시장 전체의 실결제 광고비로 제공되지 않습니다.
              </p>
              <div className="intake-market-stats" aria-live="polite">
                <article>
                  <span>PC 검색량 · 최근 30일</span>
                  <strong>
                    {keywordRow ? formatCount(keywordRow.pcSearches) : "—"}
                  </strong>
                  <small>
                    {market
                      ? "조회 키워드와 정확히 일치하는 결과 기준"
                      : "검색량 미조회"}
                  </small>
                </article>
                <article>
                  <span>모바일 검색량 · 최근 30일</span>
                  <strong>
                    {keywordRow ? formatCount(keywordRow.mobileSearches) : "—"}
                  </strong>
                  <small>
                    {keywordRow
                      ? `PC 광고 경쟁 정도: ${keywordRow.competition}`
                      : "일치하는 결과가 있어야 표시"}
                  </small>
                </article>
                <article>
                  <span>추정 입찰가 · PC 광고 3위 기준</span>
                  <strong>
                    {estimatedBid === null ? "—" : won(estimatedBid)}
                  </strong>
                  <small>평균 노출 위치 통계 기반 · 실제 평균 CPC 아님</small>
                  {estimatedBid !== null && (
                    <button
                      type="button"
                      onClick={() => {
                        setDraft({ ...draft, cpc: String(estimatedBid) });
                        setCpcKind("estimate");
                        setReport(null);
                      }}
                    >
                      CPC 가정으로 사용
                    </button>
                  )}
                </article>
              </div>
              {market && (
                <p className="intake-note">
                  검색량 출처: 네이버 검색광고 API ·{" "}
                  {new Date(market.fetchedAt).toLocaleString("ko-KR", {
                    timeZone: "Asia/Seoul",
                  }) + " KST"}{" "}
                  · 연관 키워드 합계가 아닌 입력 키워드의 검색량입니다.
                </p>
              )}
              {marketErrors.length > 0 && (
                <div className="intake-data-notice" role="status">
                  {marketErrors.map((message) => (
                    <p key={message}>{message}</p>
                  ))}
                </div>
              )}
              <details className="intake-competitors">
                <summary>
                  경쟁 상품 살펴보기{" "}
                  {shopping
                    ? `· 검색 결과 ${shopping.products[0]?.count.toLocaleString("ko-KR")}개`
                    : "· 자동 조회 미연결"}
                </summary>
                <p className="intake-note">
                  네이버 쇼핑 검색 API 결과는 실제 광고 1·2·3위나 전체 판매자
                  목록을 뜻하지 않습니다.
                </p>
                {shopping?.products[0]?.items?.length ? (
                  <div className="intake-product-grid">
                    {shopping.products[0].items.map((row, i) => (
                      <article key={i}>
                        <span>쇼핑 검색 결과 {i + 1}</span>
                        <h3>
                          {safeLink(row.url) ? (
                            <a
                              href={safeLink(row.url)}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {row.title} ↗
                            </a>
                          ) : (
                            row.title
                          )}
                        </h3>
                        <strong>
                          {row.price === null ? "가격 미제공" : won(row.price)}
                        </strong>
                        <p>{row.mallName || "쇼핑몰명 미제공"}</p>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p>
                    자동 목록이 없으면 직접 확인한 경쟁 상품을 기록할 수
                    있습니다.
                  </p>
                )}
                <div className="intake-manual-row">
                  <input
                    aria-label="직접 확인한 경쟁 상품명"
                    placeholder="직접 확인한 상품명"
                    maxLength={150}
                    value={competitor.name}
                    onChange={(e) =>
                      setCompetitor({ ...competitor, name: e.target.value })
                    }
                  />
                  <input
                    aria-label="직접 확인한 경쟁 상품 판매가"
                    maxLength={10}
                    placeholder="판매가(원)"
                    inputMode="numeric"
                    value={competitor.price}
                    onChange={(e) =>
                      setCompetitor({
                        ...competitor,
                        price: e.target.value.replace(/[^\d]/g, ""),
                      })
                    }
                  />
                  <button
                    type="button"
                    disabled={
                      !competitor.name.trim() ||
                      !competitor.price ||
                      Number(competitor.price) > 1_000_000_000 ||
                      manualProducts.length >= 10
                    }
                    onClick={() => {
                      setManualProducts([
                        ...manualProducts,
                        {
                          ...competitor,
                          name: competitor.name.trim(),
                          keyword: query.trim(),
                        },
                      ]);
                      setCompetitor({ name: "", price: "" });
                    }}
                  >
                    직접 기록
                  </button>
                </div>
                {manualProducts.map((row, i) => (
                  <p className="intake-manual-product" key={i}>
                    <span>
                      직접 확인 · {row.name} · {won(Number(row.price))} ·
                      검색어: {row.keyword || "미입력"}
                    </span>
                    <button
                      type="button"
                      aria-label={`${row.name} 경쟁 상품 기록 삭제`}
                      onClick={() =>
                        setManualProducts(
                          manualProducts.filter((_, index) => index !== i),
                        )
                      }
                    >
                      삭제
                    </button>
                  </p>
                ))}
              </details>
            </section>
            <section
              id="diagnosis-inputs"
              className="intake-panel intake-form-panel"
            >
              <div className="intake-section-heading">
                <div>
                  <span>YOUR NUMBERS</span>
                  <h2>
                    {path === "report"
                      ? "현재 운영 조건을 입력하세요"
                      : "얼마에 팔고, 얼마가 드나요?"}
                  </h2>
                </div>
                <Link href="/tools/">
                  상세 수익성 분석 <ArrowRight size={14} />
                </Link>
              </div>
              <form onSubmit={buildReport} className="intake-form" noValidate>
                <label className="intake-name">
                  상품명
                  <input
                    aria-label="진단 상품명"
                    value={draft.name}
                    maxLength={80}
                    onChange={(e) => {
                      setDraft({ ...draft, name: e.target.value });
                      setReport(null);
                    }}
                  />
                </label>
                {fields.map(([key, label, unit]) => (
                  <label key={key}>
                    {label}
                    <span className="intake-input-unit">
                      <input
                        aria-label={label}
                        type="number"
                        min="0"
                        step="any"
                        value={draft[key]}
                        onChange={(e) => {
                          setDraft({ ...draft, [key]: e.target.value });
                          setReport(null);
                          if (key === "cpc") setCpcKind("manual");
                        }}
                      />
                      <small>{unit}</small>
                    </span>
                  </label>
                ))}
                <label className="intake-name">
                  CPC 출처
                  <select
                    aria-label="CPC 출처"
                    value={cpcKind}
                    onChange={(e) => {
                      setCpcKind(e.target.value as typeof cpcKind);
                      if (
                        e.target.value === "estimate" &&
                        estimatedBid !== null
                      )
                        setDraft({ ...draft, cpc: String(estimatedBid) });
                      setReport(null);
                    }}
                  >
                    <option value="manual">직접 입력한 견적·가정값</option>
                    <option value="actual">
                      내 광고 실적의 평균 CPC 직접 입력
                    </option>
                    {estimatedBid !== null && (
                      <option value="estimate">
                        네이버 추정 입찰가를 가정값으로 사용
                      </option>
                    )}
                  </select>
                </label>
                <p className="intake-note intake-name">
                  배송·기타 비용·수수료의 기본값은 0입니다. 실제 비용이 있으면
                  변경해 주세요. 전환율은 입력한 가정입니다. 세금·환불·대행
                  수수료 등은 위 비용에 반영하지 않으면 제외됩니다. 이 입력은
                  서버에 전송하거나 영구 저장하지 않습니다.
                </p>
                {error && (
                  <p className="intake-error intake-name" role="alert">
                    {error}
                  </p>
                )}
                <button className="intake-build intake-name">
                  {pathNames[path]} 만들기 <ArrowRight size={17} />
                </button>
              </form>
            </section>
            {report && (
              <section
                ref={reportRef}
                className="intake-report"
                aria-label="맞춤 진단 결과"
              >
                <div className="intake-report-heading">
                  <div>
                    <span>YOUR BUSINESS REPORT</span>
                    <h2>{pathNames[path]}</h2>
                    <p>
                      {reportAt} ·{" "}
                      {answers.agency
                        ? "대행사 이용"
                        : answers.ads
                          ? "직접 광고 운영"
                          : answers.store
                            ? "광고 시작 전"
                            : "스토어 시작 전"}
                    </p>
                  </div>
                  <div className="intake-report-actions">
                    <button onClick={downloadReport}>
                      <Download size={15} /> 텍스트 리포트
                    </button>
                    <button onClick={() => window.print()}>
                      <Printer size={15} /> 인쇄·PDF 저장
                    </button>
                  </div>
                </div>
                <FinanceBento
                  input={report}
                  sourceLabel={cpcLabel}
                  inputHref="#diagnosis-inputs"
                />
                <div className="intake-report-inputs">
                  <span>판매가 {won(report.price)}</span>
                  <span>원가 {won(report.cost)}</span>
                  <span>CPC {won(report.cpc)}</span>
                  <span>전환율 {num(report.cvrPercent)}%</span>
                </div>
                <section className="intake-panel intake-next">
                  <h2>다음으로 확인할 것</h2>
                  <p>
                    {calculate(report).margin <= 0
                      ? "광고 집행보다 판매가와 비용 구조를 먼저 조정하세요."
                      : calculate(report).unitProfit === null
                        ? "CPC와 구매전환율을 다시 확인하세요."
                        : calculate(report).unitProfit! <= 0
                          ? "입력 조건에서는 순이익이 부족합니다. CPC·원가를 낮추거나 전환율 개선 조건을 비교하세요."
                          : "입력 조건에서는 예상 이익이 남습니다. 실제 광고는 소액으로 검증하고 실제 CPC·전환율로 다시 계산하세요."}
                  </p>
                  <p>
                    {path === "starter"
                      ? "검색량은 구매 수요나 매출을 보장하지 않습니다. 경쟁 상품의 가격·배송 조건·리뷰도 직접 확인하세요."
                      : answers.agency
                        ? "대행사에 집행 광고비, 실결제 평균 CPC, 전환 정의·판매량, 대행 수수료를 구분한 자료를 요청하세요."
                        : "직접 운영하는 광고의 지출·클릭·전환을 같은 기간으로 비교하세요."}
                  </p>
                </section>
                {path === "report" && (
                  <>
                    <SeoChecklist onValuesChange={setSeo} />
                    <section className="intake-panel">
                      <h2>운영 데이터 연결 상태</h2>
                      <div className="intake-connection-grid">
                        <article>
                          <b>키워드 검색량</b>
                          <span>{market ? "네이버 API 조회됨" : "미조회"}</span>
                        </article>
                        <article>
                          <b>경쟁 상품</b>
                          <span>
                            {shopping
                              ? "쇼핑 검색 API 조회됨"
                              : manualProducts.length
                                ? "직접 입력 기록"
                                : "미연결"}
                          </span>
                        </article>
                        <article>
                          <b>유입·실시간 순위</b>
                          <span>미연결 · 자료 필요</span>
                        </article>
                        <article>
                          <b>자동입찰·부정검색</b>
                          <span>미연결 · 실행·판별 안 함</span>
                        </article>
                      </div>
                      <p className="intake-note">
                        연결되지 않은 지표는 추정 점수나 가상 실적으로 채우지
                        않습니다.
                      </p>
                    </section>
                  </>
                )}
              </section>
            )}
          </>
        )}
        <footer className="intake-footer">
          <Link href="/">KITS 브랜드 홈</Link>
          <button
            onClick={() => {
              controller.current?.abort();
              controller.current = null;
              setLoading(false);
              setAnswers({ store: null, ads: null, agency: null });
              setReport(null);
              setSeo({});
            }}
          >
            <RotateCcw size={14} /> 질문부터 다시 시작
          </button>
        </footer>
      </main>
    </div>
  );
}
