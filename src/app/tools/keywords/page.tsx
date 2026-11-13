"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  GitCompareArrows,
  Loader2,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  KeywordResearch,
  useKeywordResearch,
} from "@/components/keyword-research";
import {
  filterResearchKeywords,
  productSearchRatio,
  exactVolume,
  researchKeywordsCsv,
} from "@/lib/keyword-research";
import { ToolsHeader } from "@/components/tools-header";
import { Help } from "@/components/ui/tooltip";
import { classifyKeywords } from "@/lib/keyword-relevance";
import {
  addRanges,
  countRange,
  demoKeywordData,
  formatCount,
  formatRange,
  keywordCsv,
  mobileShare,
  parseSeeds,
  rowVolume,
  sortKeywords,
  validateEndpoint,
  validateKeywordResponse,
  type Device,
  type KeywordData,
  type KeywordRow,
} from "@/lib/naver-keywords";

const configuredEndpoint = process.env.NEXT_PUBLIC_KEYWORD_API_URL || "";
const storageKey = "kits.keyword-api-url";
const decimal = (v: number | null) =>
  v === null ? "—" : v.toLocaleString("ko-KR", { maximumFractionDigits: 1 });
const formatRatio = (v: number | null) =>
  v === null ? "—" : v.toLocaleString("ko-KR", { maximumFractionDigits: 3 });
const deviceName = { all: "전체", pc: "PC", mobile: "모바일" };
export default function KeywordTool() {
  const [query, setQuery] = useState("미니가습기");
  const [data, setData] = useState<KeywordData>(() =>
    demoKeywordData(["미니가습기"]),
  );
  const [device, setDevice] = useState<Device>("all");
  const [filter, setFilter] = useState("");
  const [competition, setCompetition] = useState("all");
  const [page, setPage] = useState(1);
  const [advanced, setAdvanced] = useState({
    exclude: "",
    minVolume: "",
    maxVolume: "",
    minMobileShare: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [endpointDraft, setEndpointDraft] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [saved, setSaved] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const results = useRef<HTMLElement>(null);
  useEffect(() => {
    try {
      const url = validateEndpoint(
        localStorage.getItem(storageKey) || configuredEndpoint,
      );
      setEndpoint(url);
      setEndpointDraft(url);
    } catch {
      setEndpoint("");
    }
    return () => {
      controller.current?.abort();
      controller.current = null;
    };
  }, []);
  // Unrelated keywords are excluded throughout results, totals, exports and research.
  const relevance = useMemo(
    () => classifyKeywords(data.keywords, data.queriedKeywords),
    [data],
  );
  const hiddenCount = data.keywords.filter(
    (r) => relevance.get(r.keyword) === "unrelated",
  ).length;
  const rows = useMemo(
    () =>
      data.keywords.filter((r) => relevance.get(r.keyword) === "related"),
    [data, relevance],
  );
  const relatedData = useMemo(() => ({...data,keywords:rows}), [data, rows]);
  const research = useKeywordResearch(relatedData);
  const filterResult = useMemo(
    () =>
      filterResearchKeywords(rows, {
        ...advanced,
        text: filter,
        competition,
        device,
      }),
    [rows, advanced, filter, competition, device],
  );
  const filtered = useMemo(
    () => sortKeywords(filterResult.rows, device),
    [filterResult, device],
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 25));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * 25, currentPage * 25);
  const pcTotal = addRanges(rows.map((r) => countRange(r.pcSearches)));
  const mobileTotal = addRanges(
    rows.map((r) => countRange(r.mobileSearches)),
  );
  const share =
    pcTotal &&
    mobileTotal &&
    pcTotal.min === pcTotal.max &&
    mobileTotal.min === mobileTotal.max &&
    pcTotal.min + mobileTotal.min > 0
      ? (mobileTotal.min / (pcTotal.min + mobileTotal.min)) * 100
      : null;
  // Demand bars: each row's PC and mobile searches drawn against the largest
  // row in the current view. Range values use their lower bound, like the sort.
  const low = (r: KeywordRow) => ({
    pc: device === "mobile" ? 0 : (countRange(r.pcSearches)?.min ?? 0),
    mobile: device === "pc" ? 0 : (countRange(r.mobileSearches)?.min ?? 0),
  });
  const barMax = Math.max(
    1,
    ...filtered.map((r) => {
      const v = low(r);
      return v.pc + v.mobile;
    }),
  );
  const fetchedLabel =
    data.source === "demo"
      ? "실제 검색량은 아니에요"
      : new Intl.DateTimeFormat("ko-KR", {
          timeZone: "Asia/Seoul",
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(data.fetchedAt)) + " 조회";
  const pending = (() => {
    try {
      return parseSeeds(query).join(",") !== data.queriedKeywords.join(",");
    } catch {
      return true;
    }
  })();
  function resetFilters() {
    setAdvanced({
      exclude: "",
      minVolume: "",
      maxVolume: "",
      minMobileShare: "",
    });
    setFilter("");
    setCompetition("all");
    setPage(1);
  }
  function showDemo() {
    try {
      const seeds = parseSeeds(query);
      controller.current?.abort();
      controller.current = null;
      setLoading(false);
      setData(demoKeywordData(seeds));
      setError("");
      resetFilters();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function saveEndpoint(e: FormEvent) {
    e.preventDefault();
    try {
      const value = validateEndpoint(endpointDraft);
      controller.current?.abort();
      controller.current = null;
      setLoading(false);
      setEndpoint(value);
      setEndpointDraft(value);
      setSettingsError("");
      setError("");
      try {
        if (value) localStorage.setItem(storageKey, value);
        else localStorage.removeItem(storageKey);
      } catch {}
      setSaved(true);
    } catch (e) {
      setSettingsError((e as Error).message);
      setSaved(false);
    }
  }
  async function search(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    let seeds: string[];
    try {
      seeds = parseSeeds(query);
    } catch (e) {
      setError((e as Error).message);
      return;
    }
    if (!endpoint) {
      setSettingsOpen(true);
      setError(
        "실제 검색량을 조회하려면 자료 연결를 연결해 주세요. 현재 아래 수치는 가상 예시 자료입니다.",
      );
      return;
    }
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setLoading(true);
    setError("");
    const timer = setTimeout(() => current.abort(), 15000);
    try {
      const url = new URL(endpoint);
      url.searchParams.set("keywords", seeds.join(","));
      const response = await fetch(url, {
        signal: current.signal,
        credentials: "omit",
        cache: "no-store",
      });
      const payload = await response.json().catch(() => {
        throw new Error(
          "자료 연결 응답 형식이 올바르지 않습니다. API 엔드포인트 주소를 확인해 주세요.",
        );
      });
      if (!response.ok)
        throw new Error(
          typeof payload?.error === "string"
            ? payload.error.slice(0, 200)
            : "검색량을 조회하지 못했습니다.",
        );
      const result = validateKeywordResponse(payload);
      if (controller.current !== current) return;
      if (current.signal.aborted) throw new Error("조회 시간이 초과되었습니다.");
      setData(result);
      resetFilters();
      results.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (e) {
      if (controller.current !== current) return;
      setError(
        current.signal.aborted
          ? "조회 시간이 초과되었습니다. 서버 연결을 확인하고 다시 시도해 주세요."
          : e instanceof TypeError
            ? "자료 연결에 연결하지 못했습니다. 서버 주소와 사이트 접근 허용 설정을 확인해 주세요."
            : (e as Error).message,
      );
    } finally {
      clearTimeout(timer);
      if (controller.current === current) setLoading(false);
    }
  }
  function download() {
    const csv = researchKeywordsCsv(
      filtered.map(research.snapshot),
      research.products,
      device,
    );
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `${data.source === "demo" ? "DEMO-" : ""}KITS-keywords-${data.fetchedAt.slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <>
      <ToolsHeader active="keywords" />
      <main className="kw-main">
        <header className="kw-title">
          <div>
            <h1>검색어 찾기</h1>
          </div>
          <p className={`kw-stamp ${data.source}`}>
            {data.source === "demo" ? "예시 자료" : "네이버 검색광고 데이터"}
            <span>{fetchedLabel}</span>
          </p>
        </header>

        <section className="kw-plate" aria-labelledby="kw-plate-title">
          <div className="kw-plate-head">
            <h2 id="kw-plate-title">찾을 검색어</h2>
            <button
              className="kw-server-toggle"
              type="button"
              aria-expanded={settingsOpen}
              aria-controls="kw-connection"
              onClick={() => {
                setSettingsOpen(!settingsOpen);
                setSaved(false);
              }}
            >
              자료 연결{" "}
              <b className={endpoint ? "on" : "off"}>
                {endpoint ? "연결됨" : "연결 전"}
              </b>
            </button>
          </div>
          <form className="kw-search-form" onSubmit={search}>
            <div className="kw-search-field">
              <Search size={18} aria-hidden />
              <input
                aria-label="찾을 검색어"
                value={query}
                maxLength={300}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="예: 미니가습기, 무선가습기"
              />
              {query && (
                <button
                  type="button"
                  aria-label="찾을 검색어 지우기"
                  onClick={() => setQuery("")}
                >
                  <X size={16} />
                </button>
              )}
            </div>
            <button
              className="kw-search-submit"
              type="submit"
              disabled={loading}
            >
              {loading && <Loader2 className="kw-spin" size={17} />}
              {loading ? "조회 중…" : "검색량 보기"}
            </button>
            <button className="kw-demo-button" type="button" onClick={showDemo}>
              예시 보기
            </button>
          </form>
          {settingsOpen && (
            <form
              className="kw-connection"
              id="kw-connection"
              onSubmit={saveEndpoint}
            >
              <label htmlFor="keyword-endpoint">검색량 자료 연결 주소</label>
              <div className="kw-endpoint-row">
                <input
                  id="keyword-endpoint"
                  type="url"
                  placeholder="https://your-keyword-api.vercel.app/api/keywords"
                  value={endpointDraft}
                  onChange={(e) => {
                    setEndpointDraft(e.target.value);
                    setSaved(false);
                  }}
                />
                <button type="submit">주소 저장</button>
              </div>
              <p>
                API 키·비밀 키·고객 ID는 자료 연결에만 등록합니다. 이 화면에는
                서버 주소만 입력하세요. 주소를 저장해도 인증이나 조회 성공이
                확인되지는 않습니다.
              </p>
              {settingsError && (
                <p className="kw-form-error" role="alert">
                  {settingsError}
                </p>
              )}
              {saved && (
                <p className="kw-saved" role="status">
                  <Check size={14} aria-hidden />
                  {endpoint
                    ? "서버 주소를 저장했습니다. 검색량 보기로 연결을 확인하세요."
                    : "서버 주소를 해제했습니다."}
                </p>
              )}
            </form>
          )}
        </section>

        {error && (
          <div className="kw-query-error" role="alert">
            <strong>{error}</strong>
            <span>
              아래 결과는 {data.source === "demo" ? "기존 데모" : "이전 조회"}{" "}
              결과이며, 방금 요청의 결과가 아닙니다.
            </span>
          </div>
        )}
        {data.source === "demo" ? (
          <p className="kw-notice">
            지금 보이는 수치는 실제 네이버 검색량이 아닌 가상 예시입니다. 자료 연결를 연결하기 전에도 정렬과 필터를 써 볼 수 있습니다.
          </p>
        ) : (
          <p className="kw-notice naver">
            네이버 검색광고 검색어 찾기의 검색량(최근 30일)과 파워링크 광고 클릭
            통계(최근 4주)입니다. 쇼핑검색광고의 클릭·경쟁 통계가 아닙니다.
          </p>
        )}

        <section className="kw-stats" aria-label="조회 결과 요약">
          <div>
            <h2>관련 검색어</h2>
            <p className="kw-stat-value">
              {rows.length.toLocaleString("ko-KR")}
              <small>개</small>
            </p>
            <p className="kw-stat-note">{data.queriedKeywords.join(", ")}</p>
          </div>
          <div>
            <h2>
              PC 검색 합계
              <Help
                label="PC 검색 합계"
                text="이번 조회 결과의 PC 검색 횟수 합계입니다. 네이버 전체 검색량이나 방문자 수가 아닙니다. 범위 표기는 원본 범위를 유지합니다."
              />
            </h2>
            <p className="kw-stat-value">{formatRange(pcTotal)}</p>
            <p className="kw-stat-note">최근 30일 · 현재 검색어 기준</p>
          </div>
          <div>
            <h2>휴대폰 검색 합계</h2>
            <p className="kw-stat-value">{formatRange(mobileTotal)}</p>
            <p className="kw-stat-note">최근 30일 · 현재 검색어 기준</p>
          </div>
          <div>
            <h2>
              휴대폰 비율
              <Help
                label="모바일 검색 비중"
                text="정확한 PC·모바일 검색량이 모두 있는 경우에만 계산합니다. 범위값이나 누락값이 있으면 표시하지 않습니다."
              />
            </h2>
            <p className="kw-stat-value">
              {share === null ? (
                <span className="kw-dash">—</span>
              ) : (
                <>
                  {decimal(share)}
                  <small>%</small>
                </>
              )}
            </p>
            <p className="kw-stat-note">
              {share === null
                ? "범위값이나 누락값이 있어 계산하지 않음"
                : "PC와 휴대폰 검색 합계 대비"}
            </p>
          </div>
        </section>

        <section
          className="kw-results"
          ref={results}
          aria-labelledby="kw-results-title"
        >
          <div className="kw-results-head">
            <div>
              <h2 id="kw-results-title">검색량 순위</h2>
              <p>
                지금 찾은 검색어 안에서 검색량이 많은 순서예요.
              </p>
            </div>
            <div className="kw-segmented" role="group" aria-label="검색량 기준 기기">
              {(["all", "mobile", "pc"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={device === d}
                  onClick={() => {
                    setDevice(d);
                    setPage(1);
                  }}
                >
                  {deviceName[d]}
                </button>
              ))}
            </div>
          </div>

          <div className="kw-toolbar">
            <div className="kw-filter-field">
              <Search size={15} aria-hidden />
              <input
                aria-label="결과에서 찾기"
                placeholder="결과에서 찾기"
                value={filter}
                onChange={(e) => {
                  setFilter(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <select
              aria-label="경쟁 정도 필터"
              value={competition}
              onChange={(e) => {
                setCompetition(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">경쟁 정도 전체</option>
              <option value="높음">경쟁 높음</option>
              <option value="중간">경쟁 중간</option>
              <option value="낮음">경쟁 낮음</option>
            </select>
            <p className="kw-count">
              <span>
                <b>{filtered.length.toLocaleString("ko-KR")}</b>개 키워드
              </span>
              {pending && <em>입력한 검색어로 다시 찾아주세요.</em>}
            </p>
            {hiddenCount > 0 && (
              <p className="kw-relevance">
                관련 검색어만 보여요 · 관련성이 낮은 {hiddenCount.toLocaleString("ko-KR")}개 제외
              </p>
            )}
            <div className="kw-toolbar-actions">
              {research.selected.length > 0 && (
                <button
                  className="kw-ghost-button"
                  type="button"
                  onClick={research.openCompare}
                >
                  <GitCompareArrows size={15} aria-hidden /> 선택한{" "}
                  {research.selected.length}개 비교
                </button>
              )}
              <button
                className="kw-ghost-button"
                type="button"
                disabled={!filtered.length}
                onClick={download}
              >
                <Download size={15} aria-hidden />
                {data.source === "demo" ? "데모 CSV" : "CSV 내려받기"}
              </button>
            </div>
          </div>

          <details className="kw-advanced">
            <summary>
              <SlidersHorizontal size={14} aria-hidden /> 상세 필터
            </summary>
            <div className="kw-advanced-fields">
              {(
                [
                  ["exclude", "제외 단어", "추천, 중고"],
                  ["minVolume", "최소 검색량", "0"],
                  ["maxVolume", "최대 검색량", "100000"],
                  ["minMobileShare", "최소 휴대폰 비율 (%)", "0"],
                ] as const
              ).map(([key, label, placeholder]) => (
                <label key={key}>
                  {label}
                  <input
                    type={key === "exclude" ? "text" : "number"}
                    min={key === "exclude" ? undefined : 0}
                    max={key === "minMobileShare" ? 100 : undefined}
                    placeholder={placeholder}
                    value={advanced[key]}
                    onChange={(e) => {
                      setAdvanced((old) => ({ ...old, [key]: e.target.value }));
                      setPage(1);
                    }}
                  />
                </label>
              ))}
              <button type="button" onClick={resetFilters}>
                필터 초기화
              </button>
            </div>
            <p>
              결과 내 검색은 쉼표로 나눈 단어를 모두 포함해야 하고, 제외 단어는
              하나라도 포함되면 빠집니다. 범위값은 범위 전체가 검색량 조건 안에
              들어올 때만 포함합니다.
            </p>
          </details>
          {filterResult.error && (
            <p role="alert" className="kw-inline-error">
              {filterResult.error}
            </p>
          )}

          <div className="kw-legend" aria-hidden>
            {device !== "mobile" && (
              <span>
                <i className="pc" />
                PC
              </span>
            )}
            {device !== "pc" && (
              <span>
                <i className="mobile" />
                모바일
              </span>
            )}
            <span className="kw-legend-note">
              막대가 길수록 검색량이 많아요
            </span>
          </div>

          <div className="kw-table-scroll" tabIndex={0} aria-label="키워드 표, 가로로 스크롤할 수 있습니다">
            <table className={`kw-table device-${device}`}>
              <caption className="kw-visually-hidden">
                {data.source === "demo"
                  ? "가상 예시 자료"
                  : "네이버 검색광고 API 데이터"}
                , {deviceName[device]} 검색량순
              </caption>
              <thead>
                <tr>
                  <th scope="col" className="num">순위</th>
                  <th scope="col">키워드</th>
                  <th scope="col" className="kw-demand-col">
                    {deviceName[device]} 검색 수요
                  </th>
                  <th scope="col" className="num kw-pc-column">
                    PC
                  </th>
                  <th scope="col" className="num kw-mobile-column">
                    모바일
                  </th>
                  <th scope="col" className="num">
                    휴대폰 비율
                  </th>
                  <th scope="col" className="num">
                    상품 수
                  </th>
                  <th scope="col" className="num">
                    상품 / 검색
                  </th>
                  <th scope="col" className="num">
                    광고 클릭
                    <small>PC / 모바일, 4주 평균</small>
                  </th>
                  <th scope="col">
                    경쟁
                    <small>파워링크 PC</small>
                  </th>
                  <th scope="col" className="kw-actions-col">
                    <span className="kw-visually-hidden">비교 선택과 저장</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r, i) => {
                  const v = low(r);
                  const product =
                    research.products.find((p) => p.keyword === r.keyword)
                      ?.count ?? null;
                  return (
                    <tr
                      key={r.keyword}
                      className={research.isSelected(r) ? "is-selected" : ""}
                    >
                      <td className="num kw-rank">
                        {(currentPage - 1) * 25 + i + 1}
                      </td>
                      <th scope="row" className="kw-keyword">
                        <button
                          type="button"
                          onClick={() => research.inspect(r.keyword)}
                        >
                          {r.keyword}
                        </button>
                        {data.queriedKeywords.some(
                          (seed) =>
                            seed.toLocaleLowerCase() ===
                            r.keyword.toLocaleLowerCase(),
                        ) && <span className="kw-chip">입력</span>}

                      </th>
                      <td className="kw-demand">
                        <span className="kw-demand-figure">
                          {formatRange(rowVolume(r, device))}
                        </span>
                        <span className="kw-bar" aria-hidden>
                          {v.pc > 0 && (
                            <i
                              className="pc"
                              style={{ inlineSize: `${(v.pc / barMax) * 100}%` }}
                            />
                          )}
                          {v.mobile > 0 && (
                            <i
                              className="mobile"
                              style={{
                                inlineSize: `${(v.mobile / barMax) * 100}%`,
                              }}
                            />
                          )}
                        </span>
                      </td>
                      <td className="num kw-pc-column">
                        {formatCount(r.pcSearches)}
                      </td>
                      <td className="num kw-mobile-column">
                        {formatCount(r.mobileSearches)}
                      </td>
                      <td className="num">
                        {mobileShare(r) === null
                          ? "—"
                          : `${decimal(mobileShare(r))}%`}
                      </td>
                      <td className="num">{decimal(product)}</td>
                      <td className="num">
                        {formatRatio(
                          productSearchRatio(product, exactVolume(r, device)),
                        )}
                      </td>
                      <td className="num kw-clicks">
                        {decimal(r.pcClicks)}
                        <span> / </span>
                        {decimal(r.mobileClicks)}
                      </td>
                      <td>
                        <span
                          className={`kw-pill ${r.competition === "높음" ? "high" : r.competition === "낮음" ? "low" : "mid"}`}
                        >
                          {r.competition}
                        </span>
                      </td>
                      <td className="kw-row-actions">
                        <input
                          type="checkbox"
                          aria-label={`${r.keyword} 비교 선택`}
                          checked={research.isSelected(r)}
                          onChange={() =>
                            research.toggleSelected(research.snapshot(r))
                          }
                        />
                        <button
                          type="button"
                          aria-label={`${r.keyword} 관심 키워드 ${research.isSaved(r) ? "저장 해제" : "저장"}`}
                          aria-pressed={research.isSaved(r)}
                          onClick={() => research.toggleSaved(r)}
                        >
                          <Bookmark
                            size={16}
                            fill={research.isSaved(r) ? "currentColor" : "none"}
                          />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {!visible.length && (
                  <tr>
                    <td colSpan={11} className="kw-no-results">
                      {rows.length
                        ? "필터에 맞는 키워드가 없습니다. 조건을 바꿔 보세요."
                        : "조회된 관련 검색어가 없습니다. 다른 키워드로 조회해 보세요."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="kw-table-foot">
            <p>
              {deviceName[device]} 검색량 내림차순입니다. 범위값은 하한으로
              정렬하고 누락값은 마지막에 둡니다.
              {data.truncated && " 결과는 최대 1,000개까지 표시합니다."}
            </p>
            {pages > 1 && (
              <div className="kw-pagination">
                <button
                  type="button"
                  aria-label="이전 결과 페이지"
                  disabled={currentPage === 1}
                  onClick={() => setPage(currentPage - 1)}
                >
                  <ChevronLeft size={16} />
                </button>
                <span>
                  {(currentPage - 1) * 25 + 1}–
                  {Math.min(currentPage * 25, filtered.length)} /{" "}
                  {filtered.length.toLocaleString("ko-KR")}
                </span>
                <button
                  type="button"
                  aria-label="다음 결과 페이지"
                  disabled={currentPage === pages}
                  onClick={() => setPage(currentPage + 1)}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        </section>

        <KeywordResearch
          model={research}
          data={relatedData}
          device={device}
          endpoint={endpoint}
          onQuery={(value) => {
            setQuery(value);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />

        <section className="kw-guide" aria-labelledby="kw-guide-title">
          <h2 id="kw-guide-title">이 숫자는 무슨 뜻인가요?</h2>
          <div>
            <p>
              검색량은 최근 30일의 검색 횟수예요. 검색한 사람 수나 실시간 인기 순위는 아니에요. 검색이 많아도 잘 팔린다는 뜻은 아니에요.
            </p>
            <p>
              광고 클릭은 파워링크의 최근 4주 기록이에요. 클릭 비용·구매 수와는 달라요. &lt;10은 0~9회, —는 자료 없음이에요.
            </p>
            <p>
              쇼핑광고 예상 가격은{" "}
              <Link href="/tools/start/">광고 진단에서 확인</Link>
              하세요. 이 화면에는 API 비밀 키를 저장하지 않으며, 실제 조회는
              인증 정보를 가진 별도 자료 연결를 연결한 뒤 사용할 수 있습니다.
            </p>
            <p>
              <a
                href="https://searchad.naver.com/"
                target="_blank"
                rel="noreferrer"
              >
                네이버 검색광고 열기
              </a>
            </p>
          </div>
        </section>
        <footer className="kw-footer">
          <strong>KITS Tools</strong>
          <span>판매를 쉽게 준비하는 도구</span>
        </footer>
      </main>
    </>
  );
}
