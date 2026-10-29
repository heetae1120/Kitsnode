"use client";
import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { calculate, num, won, type ProductInput } from "@/lib/calculator";
import { clickTargetText } from "@/lib/business-diagnosis";
import "./finance-bento.css";

/** Profitability adaptation of the supplied finance-bento layout, using only calculated values. */
export function FinanceBento({
  input,
  sourceLabel = "직접 입력한 조건",
  inputHref,
}: {
  input: ProductInput;
  sourceLabel?: string;
  inputHref?: string;
}) {
  const r = useMemo(() => calculate(input), [input]);
  const chart = useMemo(
    () =>
      [0, 20, 40, 60, 80, 100].map((percent) => {
        const value = calculate({
          ...input,
          budget: (input.budget * percent) / 100,
        });
        return {
          percent: `${percent}%`,
          revenue: value.revenue,
          expenses: value.revenue - value.totalProfit,
        };
      }),
    [input],
  );
  const costs = [
    { label: "상품 원가", value: input.cost },
    { label: "배송·기타 비용", value: input.shipping + input.other },
    { label: "판매 수수료", value: (input.price * input.feePercent) / 100 },
    { label: "예상 CPA", value: r.cpa },
  ];
  const totalCost = costs.reduce((sum, row) => sum + (row.value ?? 0), 0);
  const percent = (v: number | null) =>
    v === null ? "계산 불가" : `${num(v)}%`;
  return (
    <section className="profit-bento" aria-label="한눈에 보는 수익성 요약">
      <header className="pb-heading">
        <div>
          <span>PROFIT OVERVIEW</span>
          <h2>한눈에 보는 수익 구조</h2>
        </div>
        <p>
          {sourceLabel} · 예상 계산{" "}
          {inputHref && <a href={inputHref}>입력 조건 변경 ↗</a>}
        </p>
      </header>
      <div className="pb-grid">
        <article className="pb-card pb-forecast">
          <div className="pb-card-top">
            <span>예상 총순이익</span>
            <span>예산 {won(input.budget)}</span>
          </div>
          <strong className={r.totalProfit < 0 ? "pb-loss" : "pb-gain"}>
            {won(r.totalProfit)}
          </strong>
          <p>
            광고비·입력한 상품 비용 차감 후 ·{" "}
            {r.totalProfit < 0
              ? "예상 손실"
              : r.totalProfit > 0
                ? "예상 이익"
                : "손익 균형"}
          </p>
          <div
            className="pb-chart"
            role="img"
            aria-label="입력한 광고 예산의 0~100% 단계별 예상 매출과 총비용 비교. 실제 매출 이력이 아닌 시뮬레이션입니다."
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chart}
                margin={{ top: 15, right: 10, bottom: 0, left: 0 }}
              >
                <CartesianGrid stroke="#ffffff14" vertical={false} />
                <XAxis
                  dataKey="percent"
                  tick={{ fill: "#becce4", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  width={45}
                  tickFormatter={(v) => `${num(v / 10000)}만`}
                  tick={{ fill: "#becce4", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(v, name) => [
                    won(typeof v === "number" ? v : null),
                    name === "revenue" ? "예상 매출" : "예상 총비용",
                  ]}
                  labelFormatter={(v) => `입력 예산의 ${v}`}
                  contentStyle={{
                    background: "#142543",
                    border: "1px solid #526581",
                    borderRadius: 10,
                    color: "#fff",
                    fontFamily: "var(--font-pretendard), sans-serif",
                  }}
                />
                <Area
                  type="linear"
                  dataKey="revenue"
                  stroke="#93b4ff"
                  fill="#2563eb"
                  fillOpacity={0.18}
                  strokeWidth={2.5}
                  isAnimationActive={false}
                />
                <Area
                  type="linear"
                  dataKey="expenses"
                  stroke="#f3c77a"
                  fill="transparent"
                  strokeWidth={2}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="pb-legend">
            <span>● 예상 매출</span>
            <span>● 예상 총비용</span>
            <small>예산 단계별 시뮬레이션 · 실제 매출 이력 아님</small>
          </div>
        </article>
        <article className="pb-card pb-costs">
          <span>주문 1건의 비용 구성</span>
          <h3>{input.name}</h3>
          {costs.map((row, index) => (
            <div className="pb-cost" key={row.label}>
              <div>
                <span>{row.label}</span>
                <b>{won(row.value)}</b>
              </div>
              <div className="pb-track">
                <span
                  style={{
                    width: `${totalCost > 0 ? ((row.value ?? 0) / totalCost) * 100 : 0}%`,
                    background: ["#93b4ff", "#b8c8eb", "#d2dcf3", "#f3c77a"][
                      index
                    ],
                  }}
                />
              </div>
            </div>
          ))}
          <p>
            입력·계산된 비용끼리의 구성비입니다. 세금·환불·대행 수수료 등 미입력
            비용은 제외됩니다.
          </p>
        </article>
        {[
          ["예상 ROAS", percent(r.roas), "입력 CPC·전환율 기준"],
          [
            "손익분기 ROAS",
            percent(r.breakEvenRoas),
            "입력된 비용을 회수하는 기준",
          ],
          [
            "개당 예상 순이익",
            won(r.unitProfit),
            r.unitProfit === null
              ? "CPC·전환율 확인 필요"
              : r.unitProfit > 0
                ? "예상 이익"
                : r.unitProfit < 0
                  ? "예상 손실"
                  : "손익 균형",
          ],
          [
            "손익분기 최소 판매",
            r.requiredOrders === null
              ? "달성 불가"
              : `${num(r.requiredOrders, 0)}개`,
            "이번 예산의 실제 예상 광고비 기준",
          ],
        ].map(([label, value, note], index) => (
          <article
            className={`pb-card pb-kpi ${index === 2 && r.unitProfit !== null ? (r.unitProfit < 0 ? "pb-negative" : "pb-positive") : ""}`}
            key={label}
          >
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{note}</small>
          </article>
        ))}
      </div>
      <p className="pb-click-target">
        {clickTargetText(input)}{" "}
        <small>
          100회 클릭 기준 · 손익분기보다 높은 판매량 · CPC {won(input.cpc)} ·
          100회 클릭 광고비 {won(input.cpc * 100)}
        </small>
      </p>
    </section>
  );
}
