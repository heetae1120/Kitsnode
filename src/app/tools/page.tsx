"use client";
import { ToolsHeader } from "@/components/tools-header";
import { ProductResearch } from "@/components/product-research";
import { safeProductUrl } from "@/lib/product-research";
import "./product-research.css";
import "./finance-bento.css";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  ArrowRight,
  Search,
  BarChart3,
  ChevronDown,
  CircleHelp,
  FlaskConical,
  Layers3,
  MousePointer2,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Help } from "@/components/ui/tooltip";
import {
  calculate,
  num,
  SAMPLE,
  validateInput,
  won,
  type ProductInput,
} from "@/lib/calculator";
import Link from "next/link";
type Draft = {
  name: string;
  price: string;
  cost: string;
  shipping: string;
  other: string;
  feePercent: string;
};
const initialDraft: Draft = {
  name: SAMPLE.name,
  price: "39000",
  cost: "12000",
  shipping: "",
  other: "",
  feePercent: "",
};
const statuses = {
  good: "수익성 양호",
  "break-even": "손익분기 수준",
  loss: "적자 예상",
  "not-recommended": "광고 집행 비추천",
  unavailable: "CPC 입력 필요",
};
function Metric({
  label,
  value,
  help,
  sub,
  className = "",
}: {
  label: string;
  value: string;
  help: string;
  sub?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`tool-metric ${className}`}>
      <div className="tool-metric-label">
        {label}
        <Help label={label} text={help} />
      </div>
      <strong>{value}</strong>
      {sub && <span className="tool-metric-sub">{sub}</span>}
    </div>
  );
}
function SectionTitle({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="tool-section-title">
      <span className="tool-section-number">{number}</span>
      <div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
    </div>
  );
}
function moneyText(value: string) {
  return value === "" ? "" : Number(value).toLocaleString("ko-KR");
}
function NumericInput({
  value,
  onValueChange,
  formatMoney = false,
  ...props
}: Omit<React.ComponentProps<"input">, "value" | "onChange"> & {
  value: number;
  onValueChange: (value: string) => void;
  formatMoney?: boolean;
}) {
  const [text, setText] = useState(String(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => setText(String(value)), [value]);
  const display =
    formatMoney && !focused && text.trim() && Number.isFinite(Number(text))
      ? Number(text).toLocaleString("ko-KR", { maximumFractionDigits: 6 })
      : text;
  return (
    <input
      {...props}
      type={formatMoney ? "text" : props.type}
      inputMode={formatMoney ? "decimal" : props.inputMode}
      value={display}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        const raw = e.target.value.replaceAll(",", "");
        setText(raw);
        onValueChange(raw);
      }}
    />
  );
}
export default function Home() {
  const [resetKey, setResetKey] = useState(0);
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [sellingUrl, setSellingUrl] = useState("");
  const [input, setInput] = useState<ProductInput>(SAMPLE);
  const [omitted, setOmitted] = useState([
    "택배비",
    "포장·기타 비용",
    "판매 수수료",
  ]);
  const [details, setDetails] = useState(false);
  const [error, setError] = useState("");
  const [cpcSource, setCpcSource] = useState("데모 데이터");
  const [cvrSource, setCvrSource] = useState("추정값");
  const [controlError, setControlError] = useState("");
  const results = useRef<HTMLDivElement>(null);
  const r = useMemo(() => calculate(input), [input]);
  const scenarios = [1, 2, 3].map((cvrPercent) => ({
    cvrPercent,
    ...calculate({ ...input, cvrPercent }),
  }));
  const chart = Array.from({ length: 20 }, (_, i) => {
    const cvr = (i + 1) * 0.5;
    return { cvr, profit: calculate({ ...input, cvrPercent: cvr }).unitProfit };
  });
  const pending =
    Object.keys(draft).some(
      (k) =>
        String(Number(draft[k as keyof Draft])) !==
          String(input[k as keyof ProductInput]) && k !== "name",
    ) || draft.name !== input.name;
  function analyze(event: FormEvent) {
    event.preventDefault();
    if (!draft.price.trim() || !draft.cost.trim()) {
      setError(
        "판매가와 상품 원가를 모두 입력해 주세요. 원가가 없다면 0을 입력하세요.",
      );
      return;
    }
    const next: ProductInput = {
      ...input,
      ...Object.fromEntries(
        Object.entries(draft).map(([k, v]) => [
          k,
          k === "name" ? v : Number(v),
        ]),
      ),
    } as ProductInput;
    const validation = validateInput(next);
    if (validation) {
      setError(validation);
      return;
    }
    setError("");
    setInput(next);
    setOmitted(
      (
        [
          ["shipping", "택배비"],
          ["other", "포장·기타 비용"],
          ["feePercent", "판매 수수료"],
        ] as const
      )
        .filter(([key]) => draft[key] === "")
        .map(([, label]) => label),
    );
    requestAnimationFrame(() =>
      results.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }
  function updateControl(key: "cpc" | "cvrPercent" | "budget", raw: string) {
    if (raw.trim() === "") {
      setControlError("값을 입력해 주세요.");
      return;
    }
    const next = { ...input, [key]: Number(raw) };
    const e = validateInput(next);
    if (e) {
      setControlError(e);
      return;
    }
    setControlError("");
    setInput(next);
    if (key === "cpc") setCpcSource("사용자 입력");
    if (key === "cvrPercent") setCvrSource("사용자 입력");
  }
  function reset() {
    setResetKey((k) => k + 1);
    setDraft(initialDraft);
    setSellingUrl("");
    setInput(SAMPLE);
    setCpcSource("데모 데이터");
    setCvrSource("추정값");
    setError("");
    setControlError("");
    setOmitted(["택배비", "포장·기타 비용", "판매 수수료"]);
  }
  const percent = (n: number | null) =>
    n === null ? "계산 불가" : `${num(n)}%`;
  return (
    <div className="finance-dashboard">
      <ToolsHeader active="profit" />
      <main>
        <div className="tool-hero">
          <div>
            <div className="tool-eyebrow">
              <span /> KITS FINANCE / PROFIT OVERVIEW
            </div>
            <h1>
              광고 수익성 <span>대시보드</span>
            </h1>
            <p>
              매출보다 중요한 건, 남는 이익.
              <br className="tool-mobile-break" /> 상품의 수익 구조와 광고 효율을
              한눈에 확인하세요.
            </p>
          </div>
          <div className="tool-hero-note">
            <div className="tool-hero-note-icon">
              <TrendingUp size={26} />
            </div>
            <div>
              <strong>감이 아닌, 숫자로 시작하세요.</strong>
              <p>
                광고를 시작하기 전,
                <br />내 상품의 손익분기점을 먼저 확인하세요.
              </p>
            </div>
            <span className="tool-note-decoration">↗</span>
          </div>
        </div>
        <div className="tool-workspace" id="analysis">
          <aside className="tool-input-panel">
            <div className="tool-panel-heading">
              <span className="tool-step-label">STEP 01</span>
              <button
                type="button"
                onClick={reset}
                className="tool-text-button"
              >
                <RotateCcw size={13} /> 샘플로 초기화
              </button>
            </div>
            <h2>어떤 상품을 판매하시나요?</h2>
            <p className="tool-panel-intro">
              상품 정보를 입력하고 수익성을 확인하세요.
            </p>
            <form onSubmit={analyze} noValidate>
              <label className="tool-field">
                <span>
                  상품명 <b>*</b>
                </span>
                <input
                  aria-label="상품명"
                  maxLength={80}
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="예: 무선 미니 가습기"
                />
              </label>
              <label className="tool-field">
                <span>
                  판매 링크 <small>선택</small>
                </span>
                <input
                  aria-label="판매 링크 (선택)"
                  type="url"
                  maxLength={2000}
                  placeholder="https://smartstore.naver.com/…"
                  value={sellingUrl}
                  onChange={(event) => setSellingUrl(event.target.value)}
                />
                <small>참고 링크로만 사용합니다. 상품 자동 수집 · 미연결</small>
                {sellingUrl && !safeProductUrl(sellingUrl) && (
                  <small className="pr-error">
                    http 또는 https 주소를 입력하세요.
                  </small>
                )}
              </label>
              {(["price", "cost"] as const).map((key) => (
                <label className="tool-field" key={key}>
                  <span>
                    {key === "price" ? "판매가" : "상품 원가"} <b>*</b>
                    <Help
                      label={key === "price" ? "판매가" : "상품 원가"}
                      text={
                        key === "price"
                          ? "고객이 상품 1개를 구매할 때 지불하는 가격입니다."
                          : "상품 1개를 매입하거나 생산하는 데 드는 비용입니다."
                      }
                    />
                  </span>
                  <div className="tool-input-unit">
                    <input
                      aria-label={key === "price" ? "판매가" : "상품 원가"}
                      inputMode="numeric"
                      value={moneyText(draft[key])}
                      onChange={(e) => {
                        const v = e.target.value.replaceAll(",", "");
                        if (/^\d*$/.test(v)) setDraft({ ...draft, [key]: v });
                      }}
                    />
                    <span>원</span>
                  </div>
                </label>
              ))}
              <button
                type="button"
                className="tool-details-toggle"
                aria-expanded={details}
                aria-controls="details"
                onClick={() => setDetails(!details)}
              >
                상세 비용 설정{" "}
                <span>
                  선택{" "}
                  <ChevronDown size={15} className={details ? "rotate" : ""} />
                </span>
              </button>
              {details && (
                <div id="details" className="tool-details">
                  {(
                    [
                      ["shipping", "개당 택배비", "원"],
                      ["other", "개당 포장·기타 비용", "원"],
                      ["feePercent", "판매 수수료", "%"],
                    ] as const
                  ).map(([key, label, unit]) => (
                    <label className="tool-field" key={key}>
                      <span>{label}</span>
                      <div className="tool-input-unit">
                        <input
                          aria-label={label}
                          inputMode="decimal"
                          placeholder="0"
                          value={draft[key]}
                          onChange={(e) =>
                            setDraft({ ...draft, [key]: e.target.value })
                          }
                        />
                        <span>{unit}</span>
                      </div>
                    </label>
                  ))}
                  <label className="tool-field">
                    <span>
                      광고 예산{" "}
                      <Help
                        label="광고 예산"
                        text="기본 100,000원. 아래 예산 시뮬레이션과 같은 값을 사용합니다."
                      />
                    </span>
                    <div className="tool-input-unit">
                      <NumericInput
                        key={resetKey}
                        formatMoney
                        aria-label="상세 광고 예산"
                        type="number"
                        min="0"
                        max="1000000000"
                        value={input.budget}
                        onValueChange={(v) => updateControl("budget", v)}
                      />
                      <span>원</span>
                    </div>
                  </label>
                </div>
              )}
              {error && (
                <p role="alert" className="tool-error">
                  {error}
                </p>
              )}
              <Button type="submit" className="tool-analyze-button">
                <Sparkles size={17} /> 내 상품 광고 수익성 분석하기{" "}
                <ArrowRight size={16} />
              </Button>
              <p className="tool-privacy-note">
                <ShieldCheck size={13} /> 입력한 상품 정보는 저장되지 않습니다.
              </p>
            </form>
            <div className="tool-input-tip">
              <div className="tool-tip-title">
                <CircleHelp size={16} /> 아직 판매 전이어도 괜찮아요
              </div>
              <p>
                판매 예정 가격과 예상 원가로
                <br />
                광고 수익성을 미리 살펴보세요.
              </p>
            </div>
            <div className="tool-sample-note">
              <FlaskConical size={14} />
              <span>
                샘플 상품이 입력되어 있어요.
                <br />
                지금 바로 데모 결과를 확인해 보세요.
              </span>
            </div>
          </aside>
          <div className="tool-results" ref={results}>
            <div className="tool-results-top">
              <div>
                <span className="tool-step-label">STEP 02</span>
                <h2>내 상품의 광고 수익성</h2>
              </div>
              <span className="tool-live-label">
                <span /> 실시간 계산
              </span>
            </div>
            <div className="tool-product-line">
              <span>{input.name}</span>
              <span>
                판매가 <strong>{won(input.price)}</strong>
              </span>
            </div>
            {pending && (
              <p className="tool-pending">
                상품 정보를 수정했습니다. 분석 버튼을 눌러 결과에 반영해 주세요.
              </p>
            )}
            <div className="tool-assumptions">
              <div className="tool-assumptions-heading">
                <h3>
                  <MousePointer2 size={15} /> CPC와 전환율을 설정하세요
                </h3>
                <span>변경하면 즉시 반영됩니다</span>
              </div>
              <div className="tool-assumption-fields">
                <label>
                  <span>
                    예상 클릭당 비용 (CPC)
                    <Help
                      label="CPC"
                      text="광고 클릭 1회당 비용. 키워드 검색량이나 입찰가가 아닌 별도의 시나리오 값입니다."
                    />
                  </span>
                  <div className="tool-input-unit">
                    <NumericInput
                      key={resetKey}
                      type="number"
                      formatMoney
                      aria-label="예상 CPC"
                      min="0"
                      max="1000000000"
                      value={input.cpc}
                      onValueChange={(v) => updateControl("cpc", v)}
                    />
                    <span>원</span>
                  </div>
                  <small className="tool-source">{cpcSource}</small>
                </label>
                <label>
                  <span>
                    예상 구매전환율 (CVR)
                    <Help
                      label="CVR"
                      text="광고 클릭 중 구매로 이어질 비율. 기본 2%는 검증된 실제 성과가 아닌 가정값입니다."
                    />
                  </span>
                  <div className="tool-input-unit">
                    <NumericInput
                      key={resetKey}
                      type="number"
                      aria-label="예상 구매전환율"
                      min="0"
                      max="100"
                      step="0.1"
                      value={input.cvrPercent}
                      onValueChange={(v) => updateControl("cvrPercent", v)}
                    />
                    <span>%</span>
                  </div>
                  <small className="tool-source">
                    {cvrSource}
                    {cvrSource === "추정값" ? " · 기본 가정" : ""}
                  </small>
                </label>
              </div>
              <div className="tool-preset-row">
                <span>데모 CPC</span>
                {[300, 450, 700].map((v) => (
                  <button
                    key={v}
                    className={
                      input.cpc === v &&
                      cpcSource === "\uB370\uBAA8 \uB370\uC774\uD130"
                        ? "selected"
                        : ""
                    }
                    onClick={() => {
                      setInput({ ...input, cpc: v });
                      setCpcSource("데모 데이터");
                      setControlError("");
                    }}
                  >
                    {num(v)}원
                  </button>
                ))}
              </div>
              {controlError && (
                <p role="alert" className="tool-error">
                  {controlError}
                </p>
              )}
            </div>
            <div className={`tool-diagnosis ${r.status}`}>
              <div className="tool-diagnosis-top">
                <span className="tool-status-badge">
                  {r.status === "good" ? (
                    <TrendingUp size={13} />
                  ) : (
                    <BarChart3 size={13} />
                  )}{" "}
                  {statuses[r.status]}
                </span>
                <span>광고 기여 판매 1건 기준</span>
              </div>
              <div className="tool-diagnosis-main">
                <div>
                  <p>예상 개당 순이익 · 광고비 차감 후</p>
                  <strong>
                    {r.unitProfit === null ? (
                      "계산할 수 없어요"
                    ) : (
                      <>
                        {won(Math.abs(r.unitProfit))}
                        <span>
                          {" "}
                          {r.unitProfit >= 0 ? "남아요" : "손실이에요"}
                        </span>
                      </>
                    )}
                  </strong>
                </div>
                <div className="tool-diagnosis-symbol">
                  <TrendingUp size={40} />
                </div>
              </div>
              <p className="tool-diagnosis-description">
                {r.margin <= 0
                  ? "광고 없이도 공헌이익이 0원 이하입니다. 판매가와 원가 구조를 먼저 점검하세요."
                  : input.cpc === 0
                    ? "CPC가 0원이면 유료 광고 성과를 계산할 수 없습니다. 0원보다 큰 CPC를 입력하세요."
                    : input.cvrPercent === 0
                      ? "전환율 0%에서는 판매가 발생하지 않고 광고비만 지출됩니다. CPA와 개당 순이익은 계산할 수 없습니다."
                      : r.status === "break-even"
                        ? "예상 개당 순이익이 ±1원 이내인 손익분기 수준입니다. 비용 누락에 유의하세요."
                        : r.status === "good"
                          ? "현재 가정에서는 광고를 통한 판매가 수익으로 이어질 수 있습니다."
                          : `현재 예상 전환율보다 ${num(Math.max(0, (r.breakEvenCvr ?? 0) - input.cvrPercent), 2)}%p 높은 전환율이 필요합니다. CPC를 낮추거나 전환율을 개선해 보세요.`}
              </p>
            </div>
            <div className="tool-core-metrics">
              <Metric
                label="상품 기본 마진"
                value={won(r.margin)}
                help="판매가 − 원가 − 배송·기타 비용 − 판매 수수료. 광고 전 공헌이익입니다."
                sub={`마진율 ${num((r.margin / input.price) * 100)}%`}
              />
              <Metric
                label="판매 1건당 광고비"
                value={won(r.cpa)}
                help="CPA = CPC ÷ 구매전환율. 1건의 판매에 필요한 예상 광고비입니다."
                sub="예상 CPA"
              />
            </div>
            <div className="tool-roas-comparison">
              <Metric
                label="예상 ROAS"
                value={percent(r.roas)}
                help="판매가 ÷ 예상 CPA × 100. 광고비 대비 매출 비율입니다."
                sub="현재 CPC·전환율 기준"
              />
              <Metric
                label="손익분기 ROAS"
                value={percent(r.breakEvenRoas)}
                help="판매가 ÷ 광고 전 공헌이익 × 100. 원가와 입력된 비용을 회수하는 데 필요한 최소 ROAS입니다."
                sub="이 상품이 손해를 피하는 기준"
              />
              <p className="tool-roas-verdict">
                {r.margin <= 0 ? (
                  "공헌이익이 0원 이하라 ROAS를 높여도 광고 수익을 낼 수 없습니다."
                ) : r.roas === null ? (
                  "CPC와 0%보다 큰 전환율을 설정하면 두 ROAS를 비교할 수 있어요."
                ) : (
                  <>
                    예상 ROAS가 손익분기 기준보다{" "}
                    <strong>
                      {num(Math.abs(r.roas - r.breakEvenRoas!))}%p{" "}
                      {r.roas >= r.breakEvenRoas! ? "높습니다" : "낮습니다"}
                    </strong>
                    . 원가와 비용에 따라 필요한 ROAS가 달라져요.
                  </>
                )}
              </p>
            </div>
            <div className="tool-breakeven-strip">
              <div className="tool-break-icon">
                <MousePointer2 size={20} />
              </div>
              <div>
                <strong>
                  {r.breakEvenClicks === null ? (
                    "손익분기점을 계산할 수 없어요"
                  ) : r.breakEvenClicks === 0 ? (
                    "클릭 1회 비용도 기본 마진을 초과해요"
                  ) : (
                    <>
                      클릭 <em>{num(r.breakEvenClicks, 0)}회</em> 이내에 1개가
                      팔려야 해요
                    </>
                  )}
                </strong>
                <p>
                  예산과 무관 · 공헌이익 ÷ CPC로 계산{" "}
                  <Help
                    label="손익분기 클릭 수"
                    text="광고비가 공헌이익을 넘지 않는 최대 정수 클릭 수: floor(공헌이익 ÷ CPC)."
                  />{" "}
                  · 손익분기 전환율 <b>{percent(r.breakEvenCvr)}</b>
                  <Help
                    label="손익분기 구매전환율"
                    text="CPC ÷ 공헌이익 × 100. 100%를 초과하면 해당 CPC로는 수익을 낼 수 없습니다."
                  />
                </p>
              </div>
            </div>
          </div>
        </div>
        <section className="tool-card simulation" id="simulation">
          <SectionTitle
            number="03"
            title="이 광고 예산, 몇 개를 팔아야 본전일까요?"
            description="설정한 예산에서 실제 지출할 광고비를 기준으로 최소 판매량을 계산합니다."
          />
          {controlError && (
            <p role="alert" className="tool-error">
              {controlError} 마지막 유효한 값으로 계산한 결과입니다.
            </p>
          )}
          <div className="tool-simulation-layout">
            <div className="tool-budget-control">
              <label htmlFor="budget">
                광고 예산{" "}
                <Help
                  label="광고 예산"
                  text="정수 클릭 수 × CPC만 지출하며, 나머지는 미사용 잔액으로 구분합니다."
                />
              </label>
              <div className="tool-budget-input">
                <NumericInput
                  key={resetKey}
                  id="budget"
                  formatMoney
                  aria-label="광고 예산"
                  type="number"
                  min="0"
                  max="1000000000"
                  step="1000"
                  value={input.budget}
                  onValueChange={(v) => updateControl("budget", v)}
                />
                <span>원</span>
              </div>
              <input
                className="tool-slider"
                aria-label="광고 예산 슬라이더"
                type="range"
                min="0"
                max={Math.max(1000000, input.budget)}
                step="1000"
                value={input.budget}
                onChange={(e) => updateControl("budget", e.target.value)}
              />
              <div className="tool-range-labels">
                <span>0원</span>
                <span>{won(Math.max(1000000, input.budget))}</span>
              </div>
              <div className="tool-budget-presets">
                {[50000, 100000, 300000].map((v) => (
                  <button
                    key={v}
                    onClick={() => {
                      setInput({ ...input, budget: v });
                      setControlError("");
                    }}
                    className={input.budget === v ? "selected" : ""}
                  >
                    {v / 10000}만 원
                  </button>
                ))}
              </div>
              <div className="tool-budget-summary">
                <Wallet size={18} />
                <p>
                  {r.requiredOrders === null ? (
                    "공헌이익이 0원 이하라 손익분기 판매량이 없습니다."
                  ) : (
                    <>
                      이 예산에서는 최소{" "}
                      <strong>{num(r.requiredOrders, 0)}개</strong>를<br />
                      판매해야 손해를 피할 수 있어요.
                    </>
                  )}
                </p>
              </div>
            </div>
            <div className="simulation-results">
              <div className="tool-simulation-metrics">
                <Metric
                  label="예상 확보 클릭 수"
                  value={`${num(r.clicks, 0)}회`}
                  help="floor(광고 예산 ÷ CPC). CPC가 0원이면 계산하지 않습니다."
                />
                <Metric
                  label="예상 판매 건수"
                  value={`${num(r.orders, 2)}개`}
                  help="정수 클릭 수 × 구매전환율. 실제 주문 수가 아닌 기대값입니다."
                />
                <Metric
                  label="예상 총매출"
                  value={won(r.revenue)}
                  help="예상 판매 건수 × 판매가."
                />
                <Metric
                  label="실제 예상 광고비"
                  value={won(r.adSpend)}
                  help="정수 클릭 수 × CPC. 전체 예산과 다를 수 있습니다."
                  sub={`미사용 잔액 ${won(r.remainingBudget)}`}
                />
                <Metric
                  label="예상 ROAS"
                  value={percent(r.simulatedRoas)}
                  help="예상 매출 ÷ 실제 예상 광고비 × 100. 광고비가 0원이면 계산 불가."
                />
                <Metric
                  label="손익분기 최소 판매량"
                  value={
                    r.requiredOrders === null
                      ? "달성 불가"
                      : `${num(r.requiredOrders, 0)}개`
                  }
                  help="ceil(실제 예상 광고비 ÷ 공헌이익). 판매량은 올림 처리합니다."
                />
              </div>
              <div
                className={`tool-total-profit ${r.totalProfit < 0 ? "negative" : ""}`}
              >
                <div>
                  <span>
                    예상 총순이익{" "}
                    <Help
                      label="예상 총순이익"
                      text="예상 판매 건수 × 광고 전 공헌이익 − 실제 예상 광고비."
                    />
                  </span>
                  <small>
                    입력된 비용과 광고비 차감 후 ·{" "}
                    {r.totalProfit > 0
                      ? "예상 이익"
                      : r.totalProfit < 0
                        ? "예상 손실"
                        : "손익 균형"}
                  </small>
                </div>
                <strong>
                  {r.totalProfit > 0 ? "+" : ""}
                  {won(r.totalProfit)}
                </strong>
              </div>
              <p className="tool-simulation-insight">
                {input.cpc === 0 ? (
                  "유효한 CPC를 입력하면 예산 시뮬레이션이 시작됩니다."
                ) : r.adSpend === 0 ? (
                  "예산으로 확보 가능한 클릭이 없습니다. CPC 이상의 예산을 설정해 주세요."
                ) : (
                  <>
                    현재 전환율 기준 예상 판매량은 <b>{num(r.orders, 2)}개</b>
                    로,{" "}
                    {r.totalProfit >= 0
                      ? "입력한 조건에서는 광고비를 회수할 수 있습니다."
                      : "광고 수익성이 부족합니다."}
                  </>
                )}
              </p>
            </div>
          </div>
        </section>
        <section className="tool-card scenario-section">
          <SectionTitle
            number="04"
            title="전환율이 달라지면, 수익도 달라져요"
            description="같은 상품과 CPC로 비교한 전환율별 수익 시나리오입니다."
          />
          <div className="tool-scenario-layout">
            <div className="tool-chart-area">
              <div className="tool-chart-heading">
                <h3>
                  전환율별 개당 순이익{" "}
                  <Help
                    label="전환율별 개당 순이익"
                    text="가로축은 구매전환율, 세로축은 광고비 차감 후 개당 순이익. 점선은 순이익 0원과 손익분기 전환율입니다."
                  />
                </h3>
                <span>
                  <i /> 예상 순이익
                </span>
              </div>
              <div
                className="tool-chart"
                role="img"
                aria-label="전환율 0.5%부터 10%까지 개당 순이익 변화. 상세 수치는 옆 시나리오 표에서 확인하세요."
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chart}
                    margin={{ top: 20, right: 18, bottom: 5, left: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 5"
                      vertical={false}
                      stroke="#ebeeed"
                    />
                    <XAxis
                      dataKey="cvr"
                      type="number"
                      domain={[0, 10]}
                      ticks={[0, 2, 4, 6, 8, 10]}
                      tickFormatter={(v) => `${v}%`}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: "#818784" }}
                    />
                    <YAxis
                      tickFormatter={(v) => `${num(v / 10000)}만`}
                      width={48}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: "#818784" }}
                    />
                    <Tooltip
                      formatter={(v) => [
                        won(typeof v === "number" ? v : null),
                        "개당 순이익",
                      ]}
                      labelFormatter={(v) => `구매전환율 ${v}%`}
                      contentStyle={{
                        borderRadius: 10,
                        border: "1px solid #e5e7eb",
                        fontSize: 12,
                      }}
                    />
                    <ReferenceLine
                      y={0}
                      stroke="#a5aba8"
                      strokeDasharray="4 4"
                    />
                    {r.breakEvenCvr !== null && r.breakEvenCvr <= 10 && (
                      <ReferenceLine
                        x={r.breakEvenCvr}
                        stroke="#2563eb"
                        strokeDasharray="4 4"
                        label={{
                          value: `손익분기 ${num(r.breakEvenCvr, 2)}%`,
                          position: "insideTopRight",
                          fill: "#2563eb",
                          fontSize: 10,
                        }}
                      />
                    )}
                    <Line
                      type="monotone"
                      dataKey="profit"
                      stroke="#2563eb"
                      strokeWidth={3}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="tool-chart-note">
                표시 구간 0.5~10% ·{" "}
                {input.cpc === 0
                  ? "CPC 0원으로 그래프 계산 불가"
                  : r.breakEvenCvr !== null && r.breakEvenCvr > 10
                    ? "손익분기점이 그래프 범위 밖에 있습니다."
                    : "0원 선 위에서는 광고비 차감 후 수익이 발생합니다."}
              </p>
            </div>
            <div className="scenario-table-wrap">
              <table className="tool-scenario-table">
                <caption>전환율별 광고 수익 비교 · 추정값</caption>
                <thead>
                  <tr>
                    <th>시나리오</th>
                    <th>예상 CPA / ROAS</th>
                    <th>개당 순이익</th>
                  </tr>
                </thead>
                <tbody>
                  {scenarios.map((s, i) => (
                    <tr key={s.cvrPercent}>
                      <td>
                        <strong>{["보수적", "기본", "낙관적"][i]}</strong>
                        <small>전환율 {s.cvrPercent}%</small>
                      </td>
                      <td>
                        {won(s.cpa)}
                        <small>{percent(s.roas)}</small>
                      </td>
                      <td
                        className={
                          s.unitProfit !== null && s.unitProfit >= 0
                            ? "tool-positive-text"
                            : "tool-negative-text"
                        }
                      >
                        <strong>{won(s.unitProfit)}</strong>
                        <small>
                          {s.unitProfit === null
                            ? "계산 불가"
                            : Math.abs(s.unitProfit) <= 1
                              ? "손익분기"
                              : s.unitProfit > 0
                                ? "흑자 예상"
                                : "적자 예상"}
                        </small>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="tool-scenario-tip">
                <Sparkles size={15} />
                <p>
                  전환율은 작은 차이로도 수익에 큰 영향을 줍니다.
                  <br />
                  상세페이지와 구매 경험도 함께 점검해 보세요.
                </p>
              </div>
            </div>
          </div>
        </section>
        <section className="tool-card roas-explainer">
          <SectionTitle
            number="WHY"
            title="같은 ROAS 200%, 수익은 정반대일 수 있어요"
            description="판매가 40,000원 · CPC 400원 · 전환율 2% · 추가 비용 0원으로 비교한 가상 예시입니다."
          />
          <div className="tool-cost-examples">
            {[30, 70].map((costRate) => {
              const example = calculate({
                ...SAMPLE,
                price: 40000,
                cost: (40000 * costRate) / 100,
                cpc: 400,
                cvrPercent: 2,
              });
              return (
                <div className="tool-cost-example" key={costRate}>
                  <span>원가율 {costRate}% 상품</span>
                  <strong
                    className={
                      example.unitProfit! > 0
                        ? "tool-positive-text"
                        : "tool-negative-text"
                    }
                  >
                    {won(example.unitProfit)} <small>/ 판매 1건</small>
                  </strong>
                  <dl>
                    <div>
                      <dt>예상 ROAS</dt>
                      <dd>{percent(example.roas)}</dd>
                    </div>
                    <div>
                      <dt>손익분기 ROAS</dt>
                      <dd>{percent(example.breakEvenRoas)}</dd>
                    </div>
                  </dl>
                  <p>
                    {example.unitProfit! > 0
                      ? "광고비를 회수하고 이익이 남습니다."
                      : "매출이 광고비의 2배여도 손실이 발생합니다."}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
        <ProductResearch price={input.price} sellingUrl={sellingUrl} />
        <section className="tool-keyword-shortcut">
          <Search size={23} />
          <div>
            <h3>키워드·검색량 연동은 보류 중입니다.</h3>
            <p>
              검색량·실시간 광고순위 데이터는 수익성 계산에 연결되지 않습니다.
            </p>
          </div>
          <Link href="/tools/keywords/">
            기존 키워드 도구 <ArrowRight size={15} />
          </Link>
        </section>
        <section id="guide" className="tool-guide">
          <ShieldCheck size={21} />
          <div>
            <h3>분석 결과를 확인하기 전에</h3>
            <p>
              본 서비스는 영업 시연용 MVP이며 네이버 공식 서비스가 아닙니다.
              결과는 순수 광고 기여 판매를 가정한 시뮬레이션으로 실제 성과를
              보장하지 않습니다. 세금, 반품, 환불, 할인 및 입력되지 않은 비용은
              포함하지 않습니다.
            </p>
            <p>
              {omitted.length
                ? `미입력으로 제외된 비용: ${omitted.join(", ")} (각 0원 또는 0% 적용).`
                : "추가 비용은 입력된 범위에서만 반영됩니다."}{" "}
              예상 판매량은 소수점 기대값이며 실제 판매량과 다를 수 있습니다.
            </p>
          </div>
        </section>
        <footer>
          <a href="#" className="tool-footer-brand">
            <Layers3 size={17} /> KITS
          </a>
          <span>더 나은 판매의 시작, 숫자로 확인하세요.</span>
          <span>© {new Date().getFullYear()} KITS · Demo MVP</span>
        </footer>
      </main>
    </div>
  );
}
