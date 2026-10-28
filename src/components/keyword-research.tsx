"use client";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import {
  Bookmark,
  Check,
  Download,
  GitCompareArrows,
  Loader2,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  formatCount,
  formatRange,
  mobileShare,
  rowVolume,
  type Device,
  type KeywordData,
  type KeywordRow,
} from "@/lib/naver-keywords";
import {
  exactVolume,
  keywordSuggestions,
  parseMonthlyTrend,
  parseProductCount,
  productSearchRatio,
  restoreProducts,
  restoreSnapshots,
  researchKeywordsCsv,
  snapshotId,
  trendSummary,
  type KeywordSnapshot,
  type ProductRecord,
  type TrendPoint,
} from "@/lib/keyword-research";
const decimal = (n: number | null | undefined, digits = 1) =>
  n === null || n === undefined
    ? "—"
    : n.toLocaleString("ko-KR", { maximumFractionDigits: digits });
export function useKeywordResearch(data: KeywordData) {
  const [favorites, setFavorites] = useState<KeywordSnapshot[]>([]);
  const [selected, setSelected] = useState<KeywordSnapshot[]>([]);
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [focus, setFocus] = useState("");
  const [tab, setTab] = useState<"detail" | "compare" | "saved">("detail");
  const [notice, setNotice] = useState("");
  const [ready, setReady] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  useEffect(() => {
    try {
      setFavorites(
        restoreSnapshots(
          JSON.parse(localStorage.getItem("kits.keyword-favorites") || "[]"),
        ),
      );
      setProducts(
        restoreProducts(
          JSON.parse(localStorage.getItem("kits.keyword-products") || "[]"),
        ),
      );
    } catch {}
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready)
      try {
        localStorage.setItem(
          "kits.keyword-favorites",
          JSON.stringify(favorites),
        );
        localStorage.setItem("kits.keyword-products", JSON.stringify(products));
      } catch {
        setNotice(
          "이 브라우저에서 저장 공간을 사용할 수 없습니다. 현재 페이지에서만 유지됩니다.",
        );
      }
  }, [favorites, products, ready]);
  const snapshot = (row: KeywordRow): KeywordSnapshot => ({
    row,
    source: data.source,
    fetchedAt: data.fetchedAt,
    savedAt: new Date().toISOString(),
  });
  const isSaved = (row: KeywordRow) =>
    favorites.some(
      (s) => snapshotId(s) === snapshotId({ row, source: data.source }),
    );
  const isSelected = (row: KeywordRow) =>
    selected.some(
      (s) => snapshotId(s) === snapshotId({ row, source: data.source }),
    );
  function toggleSaved(row: KeywordRow) {
    const id = snapshotId({ row, source: data.source });
    if (favorites.some((s) => snapshotId(s) === id)) {
      setFavorites((old) => old.filter((s) => snapshotId(s) !== id));
      setNotice("관심 키워드에서 삭제했습니다.");
    } else if (favorites.length >= 100)
      setNotice("관심 키워드는 최대 100개까지 저장할 수 있습니다.");
    else {
      setFavorites((old) => [...old, snapshot(row)]);
      setNotice("관심 키워드를 이 브라우저에 저장했습니다.");
    }
  }
  function toggleSelected(item: KeywordSnapshot) {
    const id = snapshotId(item);
    if (selected.some((s) => snapshotId(s) === id))
      setSelected((old) => old.filter((s) => snapshotId(s) !== id));
    else if (selected.length >= 5)
      setNotice("한 번에 최대 5개까지 비교할 수 있습니다.");
    else setSelected((old) => [...old, item]);
  }
  function inspect(keyword: string) {
    setFocus(keyword);
    setTab("detail");
    requestAnimationFrame(() =>
      sectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      }),
    );
  }
  function openCompare() {
    setTab("compare");
    requestAnimationFrame(() =>
      sectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      }),
    );
  }
  const items = useMemo(() => {
    const list = data.keywords.map(snapshot);
    for (const item of favorites)
      if (!list.some((s) => snapshotId(s) === snapshotId(item)))
        list.push(item);
    return list;
  }, [data, favorites]);
  const focused =
    items.find((s) => snapshotId(s) === focus) ||
    items.find((s) => s.row.keyword === focus) ||
    items[0];
  function setProduct(record: ProductRecord) {
    setProducts((old) =>
      [...old.filter((p) => p.keyword !== record.keyword), record].slice(-200),
    );
  }
  return {
    favorites,
    setFavorites,
    selected,
    setSelected,
    products,
    setProducts,
    focus,
    setFocus,
    focused,
    items,
    tab,
    setTab,
    notice,
    setNotice,
    ready,
    sectionRef,
    snapshot,
    isSaved,
    isSelected,
    toggleSaved,
    toggleSelected,
    inspect,
    openCompare,
    setProduct,
  };
}
export type ResearchModel = ReturnType<typeof useKeywordResearch>;
export function KeywordResearch({
  model: m,
  data,
  device,
  endpoint,
  onQuery,
}: {
  model: ResearchModel;
  data: KeywordData;
  device: Device;
  endpoint: string;
  onQuery: (q: string) => void;
}) {
  const [productDraft, setProductDraft] = useState("");
  const [productError, setProductError] = useState("");
  const [productLoading, setProductLoading] = useState(false);
  const [trendDraft, setTrendDraft] = useState("");
  const [trends, setTrends] = useState<Record<string, TrendPoint[]>>({});
  const [trendError, setTrendError] = useState("");
  const [trendNotice, setTrendNotice] = useState("");
  const [shoppingNotice, setShoppingNotice] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const shoppingController = useRef<AbortController | null>(null);
  const keyword = m.focused?.row.keyword || "";
  const product = m.products.find((p) => p.keyword === keyword);
  const trend = trends[keyword] || [];
  const summary = trendSummary(trend);
  const ratio = m.focused
    ? productSearchRatio(
        product?.count ?? null,
        exactVolume(m.focused.row, device),
      )
    : null;
  const suggestions = keywordSuggestions(
    data.queriedKeywords[0] || "",
    data.keywords.map((r) => r.keyword),
  );
  useEffect(() => {
    setProductDraft(product ? String(product.count) : "");
    setProductError("");
    setShoppingNotice("");
    setTrendDraft("");
    setTrendError("");
    setTrendNotice("");
    shoppingController.current?.abort();
    shoppingController.current = null;
    setProductLoading(false);
  }, [keyword]);
  useEffect(() => () => shoppingController.current?.abort(), []);
  useEffect(() => {
    setProductDraft(product ? String(product.count) : "");
  }, [product?.count]);
  function saveProduct() {
    try {
      const count = parseProductCount(productDraft);
      shoppingController.current?.abort();
      shoppingController.current = null;
      setProductLoading(false);
      if (count === null) {
        m.setProducts((old) => old.filter((p) => p.keyword !== keyword));
        m.setNotice("입력한 상품 수를 지웠습니다.");
      } else {
        m.setProduct({
          keyword,
          count,
          source: "manual",
          capturedAt: new Date().toISOString(),
        });
        m.setNotice("상품 수를 직접 입력값으로 저장했습니다.");
      }
      setProductError("");
    } catch (e) {
      setProductError((e as Error).message);
    }
  }
  async function fetchProduct() {
    if (!endpoint) {
      setProductError(
        "조회 서버를 연결한 뒤 사용할 수 있습니다. 상품 수를 직접 입력할 수도 있습니다.",
      );
      return;
    }
    setProductError("");
    setShoppingNotice("");
    setProductLoading(true);
    const controller = new AbortController();
    shoppingController.current?.abort();
    shoppingController.current = controller;
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const url = new URL(endpoint);
      url.searchParams.set("mode", "shopping");
      url.searchParams.set("keywords", keyword);
      const response = await fetch(url, {
        signal: controller.signal,
        credentials: "omit",
        cache: "no-store",
      });
      const result = await response.json().catch(() => {
        throw new Error("상품 수 응답 형식을 확인해 주세요.");
      });
      if (!response.ok)
        throw new Error(
          typeof result?.error === "string"
            ? result.error.slice(0, 200)
            : "상품 수를 조회하지 못했습니다.",
        );
      if (shoppingController.current !== controller) return;
      const row = result.products?.find(
        (p: { keyword: string }) => p.keyword === keyword,
      );
      if (
        result.source !== "naver-shopping" ||
        !row ||
        !Number.isSafeInteger(row.count) ||
        row.count < 0 ||
        row.count > 1e12 ||
        !Number.isFinite(Date.parse(result.fetchedAt))
      )
        throw new Error("상품 수 응답 형식이 올바르지 않습니다.");
      m.setProduct({
        keyword,
        count: row.count,
        source: "naver-shopping",
        capturedAt: result.fetchedAt,
      });
      setShoppingNotice("네이버 쇼핑 API의 검색 결과 수를 가져왔습니다.");
    } catch (e) {
      if (shoppingController.current === controller)
        setProductError(
          controller.signal.aborted
            ? "상품 수 조회 시간이 초과되었습니다."
            : e instanceof TypeError
              ? "조회 서버에 연결하지 못했습니다."
              : (e as Error).message,
        );
    } finally {
      clearTimeout(timer);
      if (shoppingController.current === controller) setProductLoading(false);
    }
  }
  function applyTrend(text = trendDraft) {
    try {
      const parsed = parseMonthlyTrend(text);
      setTrends((old) => ({ ...old, [keyword]: parsed }));
      setTrendError("");
      setTrendNotice("입력한 월별 검색량으로 추이를 갱신했습니다.");
    } catch (e) {
      setTrendError((e as Error).message);
    }
  }
  async function importTrend(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 1_000_000)
        throw new Error("CSV 파일은 1MB 이하로 선택해 주세요.");
      const text = await file.text();
      setTrendDraft(text);
      applyTrend(text);
    } catch (e) {
      setTrendError((e as Error).message);
    }
    e.target.value = "";
  }
  function download(text: string, name: string) {
    const url = URL.createObjectURL(
      new Blob([text], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const source = (item: KeywordSnapshot) =>
    item.source === "demo" ? "데모 검색량" : "네이버 API 검색량";
  const ratioText = (item: KeywordSnapshot) =>
    decimal(
      productSearchRatio(
        m.products.find((p) => p.keyword === item.row.keyword)?.count ?? null,
        exactVolume(item.row, device),
      ),
      3,
    );
  return (
    <>
      <section className="kr-suggestions">
        <div>
          <h3>다음 키워드도 탐색해 보세요</h3>
          <p>
            규칙으로 만든 확장 후보입니다. 실제 연관 검색어나 검색량이 확인된
            목록이 아닙니다.
          </p>
        </div>
        <div>
          {suggestions.map((s) => (
            <button key={s} onClick={() => onQuery(s)} title="검색어에 입력">
              {s} <Search size={11} />
            </button>
          ))}
          {!suggestions.length && (
            <span>키워드를 조회하면 확장 후보가 표시됩니다.</span>
          )}
        </div>
      </section>
      <section
        className="kr-workbench"
        ref={m.sectionRef}
        aria-label="키워드 리서치 작업실"
      >
        <div className="kr-heading">
          <div>
            <span>KEYWORD RESEARCH WORKBENCH</span>
            <h2>찾은 키워드를, 다음 판단으로.</h2>
            <p>
              상품 수와 검색량을 비교하고, 관심 키워드와 직접 수집한 월별
              데이터를 함께 살펴보세요.
            </p>
          </div>
          <span className="kr-storage-badge">브라우저 저장 · 계정 불필요</span>
        </div>
        <div className="kr-tabs" aria-label="키워드 리서치 메뉴">
          {(
            [
              ["detail", "키워드 상세"],
              ["compare", `키워드 비교 (${m.selected.length}/5)`],
              ["saved", `관심 키워드 (${m.favorites.length})`],
            ] as const
          ).map(([tab, label]) => (
            <button
              key={tab}
              aria-pressed={m.tab === tab}
              onClick={() => m.setTab(tab)}
            >
              {tab === "detail" ? (
                <Search size={14} />
              ) : tab === "compare" ? (
                <GitCompareArrows size={14} />
              ) : (
                <Bookmark size={14} />
              )}{" "}
              {label}
            </button>
          ))}
        </div>
        {m.notice && (
          <p role="status" className="kr-notice">
            {m.notice}
            <button
              onClick={() => m.setNotice("")}
              aria-label="리서치 알림 닫기"
            >
              <X size={13} />
            </button>
          </p>
        )}
        {m.tab === "detail" && (
          <>
            {m.focused ? (
              <>
                <div className="kr-focus-row">
                  <label>
                    분석할 키워드
                    <select
                      aria-label="상세 분석 키워드"
                      value={snapshotId(m.focused)}
                      onChange={(e) => m.setFocus(e.target.value)}
                    >
                      {m.items.map((item) => (
                        <option key={snapshotId(item)} value={snapshotId(item)}>
                          {item.row.keyword} · {source(item)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    onClick={() => m.toggleSelected(m.focused!)}
                    className="kr-outline-button"
                  >
                    <GitCompareArrows size={14} />
                    {m.selected.some(
                      (s) => snapshotId(s) === snapshotId(m.focused!),
                    )
                      ? "비교에서 제외"
                      : "비교에 추가"}
                  </button>
                  <span className={`kr-source ${m.focused.source}`}>
                    {source(m.focused)}
                  </span>
                </div>
                <div className="kr-detail-grid">
                  <article className="kr-market">
                    <h3>검색 수요 대비 상품 수</h3>
                    <p>
                      상품 수 / 선택 기기의 월간 검색량. 낮을수록 검색 1회당
                      상품 수가 적다는 뜻이며 수익을 보장하지 않습니다.
                    </p>
                    <div className="kr-product-entry">
                      <label>
                        네이버 쇼핑 검색 결과 상품 수
                        <input
                          aria-label="상품 수 직접 입력"
                          inputMode="numeric"
                          placeholder="상품 수를 입력해 주세요"
                          value={productDraft}
                          onChange={(e) => setProductDraft(e.target.value)}
                        />
                      </label>
                      <button onClick={saveProduct}>직접 입력 저장</button>
                    </div>
                    <button
                      className="kr-shopping-button"
                      onClick={fetchProduct}
                      disabled={productLoading}
                    >
                      {productLoading ? (
                        <Loader2 size={13} className="kw-spin" />
                      ) : (
                        <Search size={13} />
                      )}{" "}
                      상품 수 자동 조회
                    </button>
                    <p className="kr-api-note">
                      자동 조회는 서버에 네이버 개발자센터의 쇼핑 검색 API 키를
                      별도로 연결해야 합니다. 검색광고 API 키와 다릅니다.
                    </p>
                    {productError && (
                      <p className="kr-error" role="alert">
                        {productError}
                      </p>
                    )}
                    {shoppingNotice && (
                      <p className="kr-success" role="status">
                        {shoppingNotice}
                      </p>
                    )}
                    <div className="kr-ratio">
                      <div>
                        <span>상품 수</span>
                        <strong>
                          {product ? decimal(product.count, 0) : "미입력"}
                        </strong>
                        <small>
                          {product
                            ? product.source === "manual"
                              ? "직접 입력"
                              : "네이버 쇼핑 API"
                            : "실제 값 입력 또는 API 조회 필요"}
                        </small>
                      </div>
                      <span>÷</span>
                      <div>
                        <span>
                          {device === "all"
                            ? "전체"
                            : device === "pc"
                              ? "PC"
                              : "모바일"}{" "}
                          월간 검색량
                        </span>
                        <strong>
                          {formatRange(rowVolume(m.focused.row, device))}
                        </strong>
                        <small>{source(m.focused)}</small>
                      </div>
                      <span>=</span>
                      <div>
                        <span>상품 / 검색 비율</span>
                        <strong>
                          {ratio === null ? "—" : decimal(ratio, 3)}
                        </strong>
                        <small>
                          {m.focused.source === "demo"
                            ? "데모 검색량에 따른 시뮬레이션"
                            : "입력·조회값 기반 계산"}
                        </small>
                      </div>
                    </div>
                    <p className="kr-footnote">
                      검색량이 0·범위값·누락값이면 비율을 계산하지 않습니다.
                      상품 수는 판매자 수나 스마트스토어 전용 상품 수가
                      아닙니다.
                      {product && (
                        <>
                          {" "}
                          상품 수 기준일:{" "}
                          {new Date(product.capturedAt).toLocaleDateString(
                            "ko-KR",
                            { timeZone: "Asia/Seoul" },
                          )}
                          .
                        </>
                      )}
                    </p>
                  </article>
                  <article className="kr-ad-metrics">
                    <h3>광고 지표 상세</h3>
                    <p>네이버 키워드 도구가 제공하는 항목만 표시합니다.</p>
                    <dl>
                      {[
                        [
                          "PC 광고 클릭률",
                          `${decimal(m.focused.row.pcCtr)}${m.focused.row.pcCtr != null ? "%" : ""}`,
                        ],
                        [
                          "모바일 광고 클릭률",
                          `${decimal(m.focused.row.mobileCtr)}${m.focused.row.mobileCtr != null ? "%" : ""}`,
                        ],
                        [
                          "PC 평균 광고 노출 깊이",
                          decimal(m.focused.row.adDepth),
                        ],
                        [
                          "PC 월평균 광고 클릭",
                          decimal(m.focused.row.pcClicks),
                        ],
                        [
                          "모바일 월평균 광고 클릭",
                          decimal(m.focused.row.mobileClicks),
                        ],
                        ["PC 광고 경쟁 정도", m.focused.row.competition],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <dt>{label}</dt>
                          <dd>{value}</dd>
                        </div>
                      ))}
                    </dl>
                    <p className="kr-footnote">
                      CTR·클릭 수는 최근 4주 기준입니다. CPC·구매전환율·매출이
                      아니며 검색량으로 역산하지 않습니다. 누락 항목은 —로
                      표시합니다.
                    </p>
                    <Link href="/tools/" className="kr-profit-link">
                      수익성 분석으로 이어가기 →
                    </Link>
                  </article>
                </div>
                <article className="kr-trend">
                  <div className="kr-trend-heading">
                    <div>
                      <h3>월별 검색량 추이</h3>
                      <p>
                        사용자가 수집한 월별 데이터를 입력해 비교합니다. API에서
                        조회한 과거 이력이나 미래 예측이 아닙니다.
                      </p>
                    </div>
                    <span>출처: 사용자 입력</span>
                  </div>
                  <div className="kr-trend-grid">
                    <div>
                      <label>
                        월, 검색량 CSV
                        <textarea
                          aria-label="월별 검색량 데이터"
                          value={trendDraft}
                          onChange={(e) => {
                            setTrendDraft(e.target.value);
                            setTrendError("");
                          }}
                          rows={5}
                          placeholder={
                            "month,searches\n2026-01,1000\n2026-02,1200\n2026-03,900"
                          }
                        />
                      </label>
                      <div className="kr-trend-actions">
                        <button onClick={() => applyTrend()}>
                          입력 데이터 적용
                        </button>
                        <button onClick={() => fileRef.current?.click()}>
                          <Upload size={13} /> CSV 가져오기
                        </button>
                        <button
                          onClick={() =>
                            download(
                              "\uFEFFmonth,searches\n2026-01,\n2026-02,\n",
                              "KITS-monthly-trend-template.csv",
                            )
                          }
                        >
                          <Download size={13} /> 양식
                        </button>
                        <input
                          ref={fileRef}
                          type="file"
                          accept=".csv,text/csv"
                          onChange={importTrend}
                          hidden
                          aria-label="월별 검색량 CSV 파일"
                        />
                      </div>
                      {trendError && (
                        <p role="alert" className="kr-error">
                          {trendError}
                        </p>
                      )}
                      {trendNotice && (
                        <p role="status" className="kr-success">
                          {trendNotice}
                        </p>
                      )}
                      <p className="kr-footnote">
                        2~60개월, YYYY-MM과 검색 횟수를 입력하세요. 누락된 월은
                        그래프를 연결하지 않습니다. 파일은 서버로 전송하지
                        않으며 추이는 현재 페이지에서만 유지됩니다.
                      </p>
                    </div>
                    <div className="kr-trend-visual">
                      {trend.length ? (
                        <>
                          <div className="kr-trend-chart">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart
                                data={trend}
                                margin={{
                                  top: 10,
                                  right: 15,
                                  bottom: 5,
                                  left: 0,
                                }}
                              >
                                <CartesianGrid
                                  stroke="#e7eee1"
                                  strokeDasharray="3 4"
                                />
                                <XAxis
                                  dataKey="month"
                                  tick={{ fontSize: 9 }}
                                  tickLine={false}
                                />
                                <YAxis
                                  width={48}
                                  tick={{ fontSize: 9 }}
                                  tickFormatter={(v) => decimal(Number(v), 0)}
                                  axisLine={false}
                                  tickLine={false}
                                />
                                <Tooltip
                                  formatter={(v) => [
                                    typeof v === "number"
                                      ? `${decimal(v, 0)}회`
                                      : "누락",
                                    "사용자 입력 검색량",
                                  ]}
                                  contentStyle={{
                                    fontSize: 11,
                                    borderRadius: 7,
                                  }}
                                />
                                <Line
                                  type="linear"
                                  dataKey="searches"
                                  stroke="#5f8950"
                                  strokeWidth={2.5}
                                  connectNulls={false}
                                  isAnimationActive={false}
                                  dot={{ r: 3 }}
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="kr-trend-summary">
                            <span>
                              입력 기간 최고:{" "}
                              <b>
                                {summary.peak?.month} ·{" "}
                                {decimal(summary.peak?.searches, 0)}회
                              </b>
                            </span>
                            <span>
                              직전 입력월 대비:{" "}
                              <b>
                                {summary.changePercent === null
                                  ? "계산 불가"
                                  : `${summary.changePercent > 0 ? "+" : ""}${decimal(summary.changePercent)}%`}
                              </b>
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="kr-trend-empty">
                          월별 데이터를 추가하면 추이와 증감을 확인할 수
                          있습니다.
                          <br />
                          현재 조회의 검색량 한 개로 과거 추이를 만들지
                          않습니다.
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              </>
            ) : (
              <div className="kr-empty">
                키워드를 조회하거나 관심 키워드를 저장하면 상세 분석을 사용할 수
                있습니다.
              </div>
            )}
          </>
        )}
        {m.tab === "compare" && (
          <div className="kr-compare">
            <div className="kr-panel-toolbar">
              <p>
                표에서 최대 5개를 선택하세요. 서로 다른 출처·조회 시각은 각 열에
                표시합니다.
              </p>
              <button
                onClick={() => m.setSelected([])}
                disabled={!m.selected.length}
              >
                <X size={13} /> 선택 비우기
              </button>
            </div>
            {m.selected.length ? (
              <div className="kr-compare-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>비교 항목</th>
                      {m.selected.map((item) => (
                        <th key={snapshotId(item)}>
                          {item.row.keyword}
                          <small>{source(item)}</small>
                          <button
                            onClick={() => m.toggleSelected(item)}
                            aria-label={`${item.row.keyword} 비교에서 삭제`}
                          >
                            <X size={12} />
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      [
                        "PC 검색량",
                        (s: KeywordSnapshot) => formatCount(s.row.pcSearches),
                      ],
                      [
                        "모바일 검색량",
                        (s: KeywordSnapshot) =>
                          formatCount(s.row.mobileSearches),
                      ],
                      [
                        "전체 검색량",
                        (s: KeywordSnapshot) =>
                          formatRange(rowVolume(s.row, "all")),
                      ],
                      [
                        "모바일 비중",
                        (s: KeywordSnapshot) =>
                          mobileShare(s.row) === null
                            ? "—"
                            : `${decimal(mobileShare(s.row))}%`,
                      ],
                      [
                        "상품 수",
                        (s: KeywordSnapshot) =>
                          decimal(
                            m.products.find((p) => p.keyword === s.row.keyword)
                              ?.count,
                            0,
                          ),
                      ],
                      [
                        "상품 / 검색 비율",
                        (s: KeywordSnapshot) => ratioText(s),
                      ],
                      [
                        "PC 광고 CTR",
                        (s: KeywordSnapshot) =>
                          s.row.pcCtr == null
                            ? "—"
                            : `${decimal(s.row.pcCtr)}%`,
                      ],
                      [
                        "PC 광고 경쟁",
                        (s: KeywordSnapshot) => s.row.competition,
                      ],
                      [
                        "조회 시각",
                        (s: KeywordSnapshot) =>
                          s.source === "demo"
                            ? "가상 예시"
                            : new Date(s.fetchedAt).toLocaleString("ko-KR", {
                                timeZone: "Asia/Seoul",
                              }),
                      ],
                    ].map(([label, get]) => (
                      <tr key={String(label)}>
                        <th>{String(label)}</th>
                        {m.selected.map((s) => (
                          <td key={snapshotId(s)}>
                            {(get as (s: KeywordSnapshot) => string)(s)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="kr-empty">
                키워드 표의 체크박스 또는 상세 화면의 ‘비교에 추가’를
                선택하세요.
              </div>
            )}
            <p className="kr-footnote">
              상품/검색 비율은 위의 PC·모바일 선택 기준으로 계산합니다. 낮은
              비율만으로 구매 수요·매출·수익을 보장하지 않습니다.
            </p>
          </div>
        )}
        {m.tab === "saved" && (
          <div className="kr-saved">
            <div className="kr-panel-toolbar">
              <p>
                이 브라우저에 최대 100개 저장합니다. 다른 기기와 자동 동기화되지
                않습니다.
              </p>
              <button
                disabled={!m.favorites.length}
                onClick={() =>
                  download(
                    researchKeywordsCsv(m.favorites, m.products),
                    "KITS-saved-keywords.csv",
                  )
                }
              >
                <Download size={13} /> 관심 키워드 CSV
              </button>
            </div>
            {m.favorites.length ? (
              <div className="kr-saved-list">
                {m.favorites.map((item) => (
                  <article key={snapshotId(item)}>
                    <Bookmark size={15} />
                    <div>
                      <button onClick={() => m.inspect(snapshotId(item))}>
                        {item.row.keyword}
                      </button>
                      <p>
                        {source(item)} · 월간{" "}
                        {formatRange(rowVolume(item.row, "all"))}회
                        {item.source === "naver" &&
                          ` · ${new Date(item.fetchedAt).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })}`}
                      </p>
                    </div>
                    <button
                      onClick={() => m.toggleSelected(item)}
                      aria-label={`${item.row.keyword} 관심 키워드 비교 선택`}
                      className={
                        m.selected.some(
                          (s) => snapshotId(s) === snapshotId(item),
                        )
                          ? "active"
                          : ""
                      }
                    >
                      <GitCompareArrows size={15} />
                    </button>
                    <button
                      onClick={() =>
                        m.setFavorites((old) =>
                          old.filter((s) => snapshotId(s) !== snapshotId(item)),
                        )
                      }
                      aria-label={`${item.row.keyword} 관심 키워드 삭제`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </article>
                ))}
              </div>
            ) : (
              <div className="kr-empty">
                관심 있는 키워드의 북마크 버튼을 눌러 저장하세요.
              </div>
            )}
          </div>
        )}
      </section>
    </>
  );
}
