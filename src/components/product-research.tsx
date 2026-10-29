"use client";

import { useState, type FormEvent } from "react";
import {
  competitorTotal,
  safeProductUrl,
  summarizeReviews,
  validateCompetitor,
  type Competitor,
  type ManualReview,
} from "@/lib/product-research";

const money = (value: number) => value.toLocaleString("ko-KR") + "원";
const targetNames = [
  "내 상품",
  "광고 1위 상품",
  "광고 2위 상품",
  "광고 3위 상품",
];

function CompetitorEditor({
  rank,
  record,
  onSave,
}: {
  rank: number;
  record?: Competitor;
  onSave: (row: Competitor) => void;
}) {
  const [row, setRow] = useState<Competitor>({
    rank,
    name: "",
    url: "",
    price: "",
    shipping: "",
    source: "",
    checkedAt: "",
    context: "",
    strengths: "",
    weaknesses: "",
  });
  const [error, setError] = useState("");
  const saved =
    record !== undefined && JSON.stringify(record) === JSON.stringify(row);
  function submit(event: FormEvent) {
    event.preventDefault();
    const error = validateCompetitor(row);
    setError(error || "");
    if (error) return;
    onSave({ ...row });
  }
  return (
    <form className="pr-card" onSubmit={submit} noValidate>
      <div className="pr-card-title">
        <h3>광고 {rank}위</h3>
        <span>{saved ? "직접 입력 · 기록됨" : "미입력"}</span>
      </div>
      <p>사용자가 확인한 위치이며 현재 실시간 순위가 아닙니다.</p>
      {(
        [
          ["name", "상품명", "text"],
          ["url", "상품 링크", "url"],
          ["price", "판매가 (원)", "text"],
          ["shipping", "배송비 (원, 무료는 0)", "text"],
          ["checkedAt", "확인 시점 (현지 시각)", "datetime-local"],
          ["source", "출처", "text"],
          ["context", "확인 조건", "text"],
          ["strengths", "직접 확인한 강점", "text"],
          ["weaknesses", "직접 확인한 약점", "text"],
        ] as const
      ).map(([key, label, type]) => (
        <label key={key}>
          <span>
            {label}
            {!["strengths", "weaknesses"].includes(key) && " *"}
          </span>
          <input
            aria-label={`광고 ${rank}위 ${label}`}
            type={type}
            value={row[key]}
            maxLength={key === "url" ? 2000 : 300}
            inputMode={
              key === "price" || key === "shipping" ? "numeric" : undefined
            }
            placeholder={
              key === "source"
                ? "예: 네이버 쇼핑 검색 결과 / 직접 확인"
                : key === "context"
                  ? "예: 텀블러 / 쇼핑검색광고 / 모바일"
                  : undefined
            }
            onChange={(event) =>
              setRow((prev) => ({ ...prev, [key]: event.target.value }))
            }
          />
        </label>
      ))}
      {error && (
        <p role="alert" className="pr-error">
          {error}
        </p>
      )}
      <button type="submit" className="pr-primary">
        {saved ? "기록 완료" : "비교표에 기록"}
      </button>
      {!saved && <p>수정한 값은 기록 버튼을 눌러야 비교표에 반영됩니다.</p>}
    </form>
  );
}

export function ProductResearch({
  price,
  sellingUrl,
}: {
  price: number;
  sellingUrl: string;
}) {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [reviews, setReviews] = useState<ManualReview[]>([]);
  const [target, setTarget] = useState("0");
  const [review, setReview] = useState({
    text: "",
    source: "",
    checkedAt: "",
    strength: "",
    weakness: "",
  });
  const [error, setError] = useState("");
  const summary = summarizeReviews(reviews, target);
  const url = safeProductUrl(sellingUrl);
  function addReview(event: FormEvent) {
    event.preventDefault();
    if (
      !review.text.trim() ||
      !review.source.trim() ||
      !review.checkedAt ||
      !Number.isFinite(Date.parse(review.checkedAt))
    ) {
      setError("리뷰 원문, 출처와 확인 시점을 입력하세요.");
      return;
    }
    if (reviews.length >= 50) {
      setError(
        "한 번에 최대 50개 리뷰를 사용할 수 있습니다. 기존 리뷰를 삭제한 뒤 추가하세요.",
      );
      return;
    }
    setReviews((prev) => [
      ...prev,
      { ...review, target, id: crypto.randomUUID() },
    ]);
    setReview((prev) => ({ ...prev, text: "", strength: "", weakness: "" }));
    setError("");
  }
  return (
    <section className="pr-workspace" aria-labelledby="product-research-title">
      <header className="pr-heading">
        <div>
          <span className="pr-eyebrow">PRODUCT RESEARCH</span>
          <h2 id="product-research-title">
            경쟁 상품과 리뷰를 함께 살펴보세요
          </h2>
          <p>직접 확인한 근거를 모아 가격과 상품 개선 포인트를 비교하세요.</p>
        </div>
        <div className="pr-connections">
          <span>자동 수집 · 미연결</span>
          <span>AI 분석 · 미연결</span>
          <span>키워드·검색량 연동 · 보류</span>
        </div>
      </header>
      <div className="pr-notice">
        링크를 입력해도 상품·광고 순위·리뷰를 자동으로 가져오지 않습니다. 직접
        입력한 정보만 사용하며 수익성 계산값은 변경하지 않습니다. 이 화면의
        입력은 서버로 전송하거나 저장하지 않으며 새로고침하면 사라집니다.
      </div>
      <div className="pr-section-heading">
        <div>
          <h3>경쟁사 비교 · 광고 1·2·3위 기록</h3>
          <p>
            광고 영역·검색어·기기·시점에 따라 노출 위치가 달라집니다. 출처와
            조건이 같은 기록끼리 비교하세요.
          </p>
        </div>
      </div>
      <div className="pr-table-wrap">
        <table>
          <caption>
            직접 입력한 광고 순위별 경쟁사 비교. 내 상품 판매가는 마지막 수익성
            분석에 적용한 값입니다.
          </caption>
          <thead>
            <tr>
              <th scope="col">상품 / 직접 확인 위치</th>
              <th scope="col">판매가</th>
              <th scope="col">구매자 배송비</th>
              <th scope="col">경쟁사 합계 / 판매가 차이</th>
              <th scope="col">확인 시점·출처·조건</th>
              <th scope="col">강점 / 약점</th>
              <th scope="col">관리</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">
                내 상품
                {url && (
                  <a href={url} target="_blank" rel="noopener noreferrer">
                    판매 링크 ↗
                  </a>
                )}
              </th>
              <td>{money(price)}</td>
              <td>미입력</td>
              <td>판매가 비교 기준</td>
              <td colSpan={3}>
                수익성 분석 적용값 · 판매 링크 {url ? "입력됨" : "미입력"}
              </td>
            </tr>
            {[1, 2, 3].map((rank) => {
              const row = competitors.find((item) => item.rank === rank);
              const total = row ? competitorTotal(row) : null;
              const delta = row ? Number(row.price) - price : null;
              return (
                <tr key={rank}>
                  <th scope="row">
                    광고 {rank}위
                    {row ? (
                      <a
                        href={safeProductUrl(row.url)!}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {row.name} ↗
                      </a>
                    ) : (
                      <small>직접 입력 대기</small>
                    )}
                  </th>
                  <td>{row ? money(Number(row.price)) : "—"}</td>
                  <td>{row ? money(Number(row.shipping)) : "—"}</td>
                  <td>
                    {total === null ? "—" : money(total)}
                    {delta !== null && (
                      <small>
                        {delta === 0
                          ? "내 상품과 같음"
                          : `판매가 ${money(Math.abs(delta))} ${delta > 0 ? "높음" : "낮음"}`}
                      </small>
                    )}
                  </td>
                  <td>
                    {row ? (
                      <>
                        <time dateTime={row.checkedAt}>
                          {row.checkedAt.replace("T", " ")}
                        </time>
                        <small>출처: {row.source}</small>
                        <small>조건: {row.context}</small>
                        <small>직접 입력 · 실시간 미확인</small>
                      </>
                    ) : (
                      "확인 기록 없음"
                    )}
                  </td>
                  <td>
                    {row ? (
                      <>
                        <small>강점: {row.strengths || "미입력"}</small>
                        <small>약점: {row.weaknesses || "미입력"}</small>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    {row && (
                      <button
                        type="button"
                        onClick={() =>
                          setCompetitors((prev) =>
                            prev.filter((item) => item.rank !== rank),
                          )
                        }
                      >
                        기록 삭제
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="pr-footnote">
        차이는 배송비를 제외한 판매가끼리 비교합니다. 경쟁사 합계는 판매가 +
        구매자 배송비입니다. 수익성 계산의 택배비는 판매자 비용이므로 구매자
        배송비로 사용하지 않습니다.
      </p>
      <details className="pr-editors" open>
        <summary>광고 1·2·3위 정보 직접 입력·수정</summary>
        <div className="pr-card-grid">
          {[1, 2, 3].map((rank) => (
            <CompetitorEditor
              key={rank}
              rank={rank}
              record={competitors.find((item) => item.rank === rank)}
              onSave={(row) =>
                setCompetitors((prev) => [
                  ...prev.filter((item) => item.rank !== row.rank),
                  row,
                ])
              }
            />
          ))}
        </div>
      </details>
      <div className="pr-section-heading">
        <div>
          <h3>리뷰 장단점 분석</h3>
          <p>
            리뷰 원문과 직접 판단한 장단점을 기록하세요. 자동 감성 분류·AI
            요약은 미연결입니다.
          </p>
        </div>
        <span>직접 입력 {reviews.length}/50개</span>
      </div>
      <label className="pr-target">
        <span>분석 대상</span>
        <select
          aria-label="분석 대상"
          value={target}
          onChange={(event) => setTarget(event.target.value)}
        >
          {targetNames.map((name, index) => (
            <option key={name} value={index}>
              {name}
              {index > 0
                ? ` · ${competitors.find((item) => item.rank === index)?.name || "상품명 미입력"}`
                : ""}
            </option>
          ))}
        </select>
      </label>
      <div className="pr-review-grid">
        <form className="pr-card" onSubmit={addReview} noValidate>
          <h4>{targetNames[Number(target)]} 리뷰 추가</h4>
          <label>
            <span>리뷰 원문 *</span>
            <textarea
              aria-label="리뷰 원문"
              maxLength={3000}
              rows={4}
              value={review.text}
              placeholder="개인정보를 제외한 리뷰 내용을 붙여 넣으세요."
              onChange={(event) =>
                setReview((prev) => ({ ...prev, text: event.target.value }))
              }
            />
          </label>
          {(
            [
              ["source", "리뷰 출처", "text"],
              ["checkedAt", "리뷰 확인 시점", "datetime-local"],
              ["strength", "장점 (직접 분류)", "text"],
              ["weakness", "단점 (직접 분류)", "text"],
            ] as const
          ).map(([key, label, type]) => (
            <label key={key}>
              <span>
                {label}
                {(key === "source" || key === "checkedAt") && " *"}
              </span>
              <input
                aria-label={label}
                type={type}
                maxLength={500}
                value={review[key]}
                onChange={(event) =>
                  setReview((prev) => ({ ...prev, [key]: event.target.value }))
                }
              />
            </label>
          ))}
          <p>
            장단점을 비워두면 미분류로 집계합니다. 하나의 리뷰에 장점과 단점을
            함께 기록할 수 있습니다.
          </p>
          {error && (
            <p role="alert" className="pr-error">
              {error}
            </p>
          )}
          <button type="submit" className="pr-primary">
            직접 입력한 리뷰 추가
          </button>
        </form>
        <div className="pr-review-results" aria-live="polite">
          <div className="pr-summary">
            <div>
              <strong>{summary.total}</strong>
              <span>입력 리뷰</span>
            </div>
            <div>
              <strong>{summary.strengths.length}</strong>
              <span>장점 기록</span>
            </div>
            <div>
              <strong>{summary.weaknesses.length}</strong>
              <span>단점 기록</span>
            </div>
            <div>
              <strong>{summary.unclassified}</strong>
              <span>미분류</span>
            </div>
          </div>
          <p className="pr-footnote">
            현재 선택한 대상의 입력 표본만 집계합니다. 전체 구매자의 평가나
            긍정·부정 비율을 뜻하지 않습니다.
          </p>
          <div className="pr-themes">
            {(
              [
                ["직접 분류한 장점", summary.strengths, "strength"],
                ["직접 분류한 단점", summary.weaknesses, "weakness"],
              ] as const
            ).map(([title, items, key]) => (
              <div key={key}>
                <h4>{title}</h4>
                {items.length ? (
                  <ul>
                    {items.map((item) => (
                      <li key={item.id}>{item[key]}</li>
                    ))}
                  </ul>
                ) : (
                  <p>아직 분류한 내용이 없습니다.</p>
                )}
              </div>
            ))}
          </div>
          {summary.total === 0 && (
            <div className="pr-empty">
              이 상품의 리뷰를 추가하면 원문과 직접 분류한 장단점을 확인할 수
              있습니다.
            </div>
          )}
          {reviews
            .filter((item) => item.target === target)
            .map((item) => (
              <article key={item.id} className="pr-review">
                <p className="pr-review-text">{item.text}</p>
                <small>
                  출처: {item.source} · 확인:{" "}
                  <time dateTime={item.checkedAt}>
                    {item.checkedAt.replace("T", " ")}
                  </time>
                </small>
                <p>
                  장점: {item.strength || "미분류"} / 단점:{" "}
                  {item.weakness || "미분류"}
                </p>
                <button
                  type="button"
                  aria-label={`리뷰 삭제: ${item.text.slice(0, 20)}`}
                  onClick={() =>
                    setReviews((prev) =>
                      prev.filter((row) => row.id !== item.id),
                    )
                  }
                >
                  리뷰 삭제
                </button>
              </article>
            ))}
        </div>
      </div>
    </section>
  );
}
