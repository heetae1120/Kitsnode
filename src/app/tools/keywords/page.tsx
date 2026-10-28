"use client";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  FlaskConical,
  Info,
  Link2,
  Loader2,
  Monitor,
  Search,
  Settings2,
  Smartphone,
  TrendingUp,
  X,
} from "lucide-react";
import { ToolsHeader } from "@/components/tools-header";
import { Help } from "@/components/ui/tooltip";
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
} from "@/lib/naver-keywords";

const configuredEndpoint = process.env.NEXT_PUBLIC_KEYWORD_API_URL || "";
const storageKey = "kits.keyword-api-url";
const decimal = (v: number | null) =>
  v === null ? "—" : v.toLocaleString("ko-KR", { maximumFractionDigits: 1 });
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
    return () => controller.current?.abort();
  }, []);
  const filtered = useMemo(
    () =>
      sortKeywords(
        data.keywords.filter(
          (r) =>
            (!filter || r.keyword.includes(filter.trim())) &&
            (competition === "all" || r.competition === competition),
        ),
        device,
      ),
    [data, filter, competition, device],
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 25));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * 25, currentPage * 25);
  const pcTotal = addRanges(data.keywords.map((r) => countRange(r.pcSearches)));
  const mobileTotal = addRanges(
    data.keywords.map((r) => countRange(r.mobileSearches)),
  );
  const share =
    pcTotal &&
    mobileTotal &&
    pcTotal.min === pcTotal.max &&
    mobileTotal.min === mobileTotal.max &&
    pcTotal.min + mobileTotal.min > 0
      ? (mobileTotal.min / (pcTotal.min + mobileTotal.min)) * 100
      : null;
  const chart = filtered.slice(0, 8).map((r) => ({
    keyword: r.keyword,
    PC: countRange(r.pcSearches)?.min ?? null,
    pcLabel: formatCount(r.pcSearches),
    모바일: countRange(r.mobileSearches)?.min ?? null,
    mobileLabel: formatCount(r.mobileSearches),
  }));
  const pending = (() => {
    try {
      return parseSeeds(query).join(",") !== data.queriedKeywords.join(",");
    } catch {
      return true;
    }
  })();
  function resetFilters() {
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
        "실제 검색량을 조회하려면 조회 서버를 연결해 주세요. 현재 아래 수치는 가상 데모 데이터입니다.",
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
          "조회 서버 응답 형식이 올바르지 않습니다. API 엔드포인트 주소를 확인해 주세요.",
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
      setData(result);
      resetFilters();
      results.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (e) {
      if (controller.current !== current) return;
      setError(
        current.signal.aborted
          ? "조회 시간이 초과되었습니다. 서버 연결을 확인하고 다시 시도해 주세요."
          : e instanceof TypeError
            ? "조회 서버에 연결하지 못했습니다. 서버 주소와 사이트 접근 허용 설정을 확인해 주세요."
            : (e as Error).message,
      );
    } finally {
      clearTimeout(timer);
      if (controller.current === current) setLoading(false);
    }
  }
  function download() {
    const csv = keywordCsv(filtered, device, data.source, data.fetchedAt);
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
        <section className="kw-hero">
          <div>
            <span className="kw-eyebrow">
              <Search size={13} /> KITS KEYWORD EXPLORER
            </span>
            <h1>
              검색량을 확인하고,
              <br />
              기회를 발견하세요.
            </h1>
            <p>
              네이버 검색광고 키워드 도구의 데이터를 기반으로
              <br className="kw-mobile-break" /> PC·모바일 검색량과 연관
              키워드를 비교하세요.
            </p>
          </div>
          <div className="kw-hero-note">
            <Monitor size={22} />
            <span>
              PC & MOBILE
              <br />
              <strong>최근 30일 검색량 비교</strong>
            </span>
            <Smartphone size={25} />
          </div>
        </section>
        <section className="kw-search-panel" aria-label="키워드 조회">
          <div className="kw-search-heading">
            <h2>어떤 키워드가 궁금하세요?</h2>
            <button
              className="kw-settings-button"
              type="button"
              onClick={() => {
                setSettingsOpen(!settingsOpen);
                setSaved(false);
              }}
            >
              <Settings2 size={14} /> 조회 서버 연결{" "}
              <span className={endpoint ? "kw-connected" : "kw-disconnected"}>
                {endpoint ? "주소 설정됨" : "미연결"}
              </span>
            </button>
          </div>
          <form className="kw-search-form" onSubmit={search}>
            <div className="kw-search-field">
              <Search size={18} />
              <input
                aria-label="조회 키워드"
                value={query}
                maxLength={300}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="예: 미니가습기, 무선가습기 (최대 5개)"
              />
              {query && (
                <button
                  type="button"
                  aria-label="조회 키워드 지우기"
                  onClick={() => setQuery("")}
                >
                  <X size={15} />
                </button>
              )}
            </div>
            <button
              className="kw-search-submit"
              type="submit"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="kw-spin" size={17} />
              ) : (
                <Search size={17} />
              )}{" "}
              {loading ? "조회 중…" : "검색량 조회"}
            </button>
            <button className="kw-demo-button" type="button" onClick={showDemo}>
              <FlaskConical size={15} /> 데모 조회
            </button>
          </form>
          <p className="kw-search-help">
            쉼표로 구분해 최대 5개까지 입력할 수 있습니다. 띄어쓰기는 검색광고
            키워드 기준으로 정리됩니다.
          </p>
          <details
            className="kw-connection"
            open={settingsOpen}
            onToggle={(e) => setSettingsOpen(e.currentTarget.open)}
          >
            <summary>
              <Link2 size={13} /> 조회 서버 설정
            </summary>
            <form onSubmit={saveEndpoint}>
              <label htmlFor="keyword-endpoint">검색량 조회 서버 주소</label>
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
                <button type="submit">설정 저장</button>
              </div>
              <p>
                API 키·비밀 키·고객 ID는 조회 서버에만 등록합니다. 이 화면에는
                서버 주소만 입력하세요. 주소 설정만으로 인증이나 조회 성공이
                확인되지는 않습니다.
              </p>
              {settingsError && (
                <p className="kw-form-error" role="alert">
                  {settingsError}
                </p>
              )}
              {saved && (
                <p className="kw-saved" role="status">
                  <Check size={13} />{" "}
                  {endpoint
                    ? "서버 주소를 저장했습니다. 검색량 조회 버튼으로 연결을 확인하세요."
                    : "서버 주소를 해제했습니다."}
                </p>
              )}
            </form>
          </details>
          {error && (
            <div className="kw-query-error" role="alert">
              <Info size={17} />
              <div>
                <strong>{error}</strong>
                <span>
                  아래 표는 {data.source === "demo" ? "기존 데모" : "이전 조회"}{" "}
                  결과이며, 방금 요청의 성공 결과가 아닙니다.
                </span>
              </div>
            </div>
          )}
        </section>
        <div className={`kw-source-notice ${data.source}`}>
          <span className="kw-source-badge">
            {data.source === "demo" ? (
              <FlaskConical size={13} />
            ) : (
              <Check size={13} />
            )}{" "}
            {data.source === "demo" ? "데모 데이터" : "네이버 API 조회 데이터"}
          </span>
          <p>
            {data.source === "demo"
              ? "실제 네이버 검색량이 아닌 가상 예시입니다. API 연결 전에도 화면과 정렬 기능을 체험할 수 있습니다."
              : "네이버 검색광고 키워드 도구에서 조회한 값입니다. 검색량은 최근 30일, 월평균 광고 클릭 수는 최근 4주 기준입니다."}
          </p>
        </div>
        <section className="kw-stat-grid" aria-label="조회 결과 요약">
          <article>
            <span>조회된 연관 키워드</span>
            <strong>
              {data.keywords.length.toLocaleString("ko-KR")}
              <small>개</small>
            </strong>
            <p>{data.queriedKeywords.join(", ")}</p>
          </article>
          <article>
            <span>
              <Monitor size={13} /> PC 월간 검색량 합계
              <Help
                label="PC 검색량 합계"
                text="이번 조회 결과의 PC 검색 횟수 합계입니다. 네이버 전체 검색량이나 방문자 수가 아닙니다. 범위 표기는 원본 범위를 유지합니다."
              />
            </span>
            <strong>{formatRange(pcTotal)}</strong>
            <p>이번에 조회된 키워드 기준</p>
          </article>
          <article>
            <span>
              <Smartphone size={13} /> 모바일 월간 검색량 합계
            </span>
            <strong>{formatRange(mobileTotal)}</strong>
            <p>이번에 조회된 키워드 기준</p>
          </article>
          <article>
            <span>
              모바일 검색 비중
              <Help
                label="모바일 검색 비중"
                text="정확한 PC·모바일 검색량이 모두 있는 경우에만 계산합니다. 범위값이나 누락값이 있으면 표시하지 않습니다."
              />
            </span>
            <strong>
              {share === null ? "—" : decimal(share)}
              {share !== null && <small>%</small>}
            </strong>
            <p>
              {share === null
                ? "범위값·누락값 포함 시 미표시"
                : "PC + 모바일 검색량 대비"}
            </p>
          </article>
        </section>
        <section
          className="kw-results"
          ref={results}
          aria-label="키워드 검색량 결과"
        >
          <div className="kw-result-heading">
            <div>
              <h2>조회 결과 내 검색량 순위</h2>
              <p>
                네이버 전체 인기 검색어 순위가 아닌, 이번 조회·필터 결과 안의
                순위입니다.
              </p>
            </div>
            <div className="kw-device-tabs" aria-label="검색량 기준 기기">
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
                  {d === "pc" ? (
                    <Monitor size={14} />
                  ) : d === "mobile" ? (
                    <Smartphone size={14} />
                  ) : null}
                  {deviceName[d]}
                </button>
              ))}
            </div>
          </div>
          <div className="kw-result-meta">
            <div>
              {data.queriedKeywords.map((seed) => (
                <span key={seed}>{seed}</span>
              ))}
              {pending && <em>입력 변경됨 · 조회 시 반영</em>}
            </div>
            <span>
              <Clock3 size={12} />
              {data.source === "demo"
                ? "가상 예시 · 실제 집계 아님"
                : new Intl.DateTimeFormat("ko-KR", {
                    timeZone: "Asia/Seoul",
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(data.fetchedAt)) + " 조회"}
            </span>
          </div>
          <div className="kw-chart-grid">
            <article className="kw-chart-card">
              <div className="kw-chart-title">
                <h3>
                  <TrendingUp size={16} /> 검색량 TOP 8
                </h3>
                <span>{deviceName[device]} 기준 · 검색 횟수</span>
              </div>
              {chart.length ? (
                <div className="kw-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={chart}
                      layout="vertical"
                      margin={{ top: 3, right: 20, bottom: 0, left: 4 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 4"
                        horizontal={false}
                        stroke="#e9eeea"
                      />
                      <XAxis
                        type="number"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fill: "#8b978c" }}
                        tickFormatter={(v) =>
                          Number(v) >= 10000
                            ? `${decimal(Number(v) / 10000)}만`
                            : decimal(Number(v))
                        }
                      />
                      <YAxis
                        dataKey="keyword"
                        type="category"
                        width={105}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: "#6a786d" }}
                        tickFormatter={(v) =>
                          String(v).length > 10
                            ? String(v).slice(0, 10) + "…"
                            : v
                        }
                      />
                      <Tooltip
                        formatter={(_value, name, item) => {
                          const label =
                            String(name) === "PC"
                              ? item.payload?.pcLabel
                              : item.payload?.mobileLabel;
                          return [
                            label === "—" ? "조회값 없음" : `${label}회`,
                            String(name),
                          ];
                        }}
                        contentStyle={{
                          borderRadius: 8,
                          fontSize: 12,
                          border: "1px solid #dce7de",
                          maxWidth: "min(240px, 70vw)",
                          whiteSpace: "normal",
                          overflowWrap: "anywhere",
                        }}
                      />
                      <Legend
                        iconType="circle"
                        iconSize={7}
                        wrapperStyle={{ fontSize: 10, paddingTop: 10 }}
                      />
                      {device !== "mobile" && (
                        <Bar
                          dataKey="PC"
                          fill="#2f5843"
                          radius={[0, 3, 3, 0]}
                          maxBarSize={14}
                          isAnimationActive={false}
                        />
                      )}{" "}
                      {device !== "pc" && (
                        <Bar
                          dataKey="모바일"
                          fill="#9dbd83"
                          radius={[0, 3, 3, 0]}
                          maxBarSize={14}
                          isAnimationActive={false}
                        />
                      )}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="kw-chart-empty">
                  조건에 맞는 키워드가 없습니다.
                </div>
              )}
              <p className="kw-chart-footnote">
                범위값은 하한 기준으로 정렬·시각화하며, 누락값은 막대 길이로
                표현하지 않습니다. 정확한 값과 범위는 표에서 확인하세요.
              </p>
            </article>
            <article className="kw-top-card">
              <span className="kw-top-eyebrow">KEYWORDS TO LOOK AT</span>
              <h3>이번 조회의 상위 키워드</h3>
              <p>{deviceName[device]} 검색량이 높은 순서입니다.</p>
              {filtered.slice(0, 3).map((r, i) => (
                <div className="kw-top-item" key={r.keyword}>
                  <span>{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <strong>{r.keyword}</strong>
                    <small>
                      {formatRange(rowVolume(r, device))}회 · {r.competition}
                    </small>
                  </div>
                </div>
              ))}
              {!filtered.length && <p>표시할 키워드가 없습니다.</p>}
              <div className="kw-top-note">
                <Info size={14} />
                <span>
                  검색량은 광고 수익을 보장하지 않습니다. CPC·전환율과 함께
                  수익성을 판단하세요.
                </span>
              </div>
            </article>
          </div>
          <div className="kw-table-toolbar">
            <div className="kw-result-search">
              <Search size={14} />
              <input
                aria-label="결과 내 키워드 검색"
                placeholder="결과 내 키워드 검색"
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
              <option value="all">모든 경쟁 정도</option>
              <option>높음</option>
              <option>중간</option>
              <option>낮음</option>
            </select>
            <span className="kw-result-count">
              총 <b>{filtered.length.toLocaleString("ko-KR")}</b>개
            </span>
            <button
              className="kw-csv-button"
              type="button"
              disabled={!filtered.length}
              onClick={download}
            >
              <Download size={14} />{" "}
              {data.source === "demo" ? "데모 CSV" : "CSV 다운로드"}
            </button>
          </div>
          <div className="kw-table-scroll">
            <table className={`kw-table device-${device}`}>
              <caption>
                {data.source === "demo"
                  ? "가상 데모 데이터"
                  : "네이버 검색광고 API 데이터"}{" "}
                · {deviceName[device]} 검색량순
              </caption>
              <thead>
                <tr>
                  <th>순위</th>
                  <th>검색 키워드</th>
                  <th className="kw-pc-column">
                    PC 검색량<small>최근 30일</small>
                  </th>
                  <th className="kw-mobile-column">
                    모바일 검색량<small>최근 30일</small>
                  </th>
                  <th>
                    합계<small>PC + 모바일</small>
                  </th>
                  <th>모바일 비중</th>
                  <th>
                    월평균 광고 클릭 수<small>PC / 모바일 · 최근 4주</small>
                  </th>
                  <th>
                    경쟁 정도<small>PC 광고 기준</small>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r, i) => (
                  <tr key={r.keyword}>
                    <td>
                      <span
                        className={
                          currentPage === 1 && i < 3 ? "kw-rank top" : "kw-rank"
                        }
                      >
                        {(currentPage - 1) * 25 + i + 1}
                      </span>
                    </td>
                    <th scope="row">
                      {r.keyword}
                      {data.queriedKeywords.some(
                        (seed) =>
                          seed.toLocaleLowerCase() ===
                          r.keyword.toLocaleLowerCase(),
                      ) && <span className="kw-seed-tag">입력</span>}
                    </th>
                    <td className="kw-pc-column">
                      {formatCount(r.pcSearches)}
                    </td>
                    <td className="kw-mobile-column">
                      {formatCount(r.mobileSearches)}
                    </td>
                    <td>
                      <strong>{formatRange(rowVolume(r, "all"))}</strong>
                    </td>
                    <td>
                      {mobileShare(r) === null
                        ? "—"
                        : `${decimal(mobileShare(r))}%`}
                    </td>
                    <td className="kw-clicks">
                      {decimal(r.pcClicks)} <span>/</span>{" "}
                      {decimal(r.mobileClicks)}
                    </td>
                    <td>
                      <span
                        className={`kw-competition ${r.competition === "높음" ? "high" : r.competition === "낮음" ? "low" : ""}`}
                      >
                        {r.competition}
                      </span>
                    </td>
                  </tr>
                ))}
                {!visible.length && (
                  <tr>
                    <td colSpan={8} className="kw-no-results">
                      {data.keywords.length
                        ? "필터에 맞는 키워드가 없습니다. 조건을 바꿔보세요."
                        : "조회된 연관 키워드가 없습니다. 다른 키워드로 검색해 보세요."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="kw-table-bottom">
            <p>
              {deviceName[device]} 검색량 내림차순 · 범위값은 하한 기준 ·
              누락값은 마지막에 표시
              {data.truncated && " · 최대 1,000개 결과 표시"}
            </p>
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
                {currentPage} / {pages}
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
          </div>
        </section>
        <section className="kw-guide">
          <Info size={19} />
          <div>
            <h3>데이터를 읽기 전에</h3>
            <p>
              검색량은 최근 30일의 검색 횟수이며 실시간 인기 검색어 순위나
              검색자 수가 아닙니다. 월평균 클릭 수는 키워드 광고의 최근 4주
              지표이며 CPC·입찰가·구매전환율과 다릅니다. &lt;10은 0~9회 범위로
              보존하고 임의의 정확한 수치로 바꾸지 않습니다.
            </p>
            <p>
              현재 GitHub Pages 화면에는 API 비밀 키를 저장하지 않습니다. 실제
              조회는 인증 정보를 가진 별도 조회 서버를 연결한 뒤 사용할 수
              있습니다.
            </p>
          </div>
          <a
            href="https://searchad.naver.com/"
            target="_blank"
            rel="noreferrer"
          >
            네이버 검색광고 <ArrowUpRight size={13} />
          </a>
        </section>
        <div className="kw-footer">
          <strong>KITS Tools</strong>
          <span>더 나은 판단을 위한, 감각적인 비즈니스 도구.</span>
        </div>
      </main>
    </>
  );
}
