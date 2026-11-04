"use client";
import { useState } from "react";
const checks = ["상품명과 핵심 키워드", "상품 분류가 맞는지", "상품 설명과 필수 정보", "이미지를 설명하는 글", "휴대폰에서 읽기 쉬운지"];
const statuses = [
  { id: "positive", label: "잘 됐어요", text: "확인한 항목이 맞아요." },
  { id: "normal", label: "보통", text: "한 번 더 보세요." },
  { id: "improve", label: "개선 필요", text: "고칠 부분이 있어요." },
] as const;
export function SeoChecklist({ onValuesChange }: { onValuesChange?: (values: Record<string, string>) => void } = {}) {
  const [values, setValues] = useState<Record<string, string>>({});
  return (
    <section className="workspace-panel" aria-labelledby="seo-checklist-title">
      <h2 id="seo-checklist-title">상품 검색 직접 점검</h2>
      <p>직접 확인하고 골라주세요. 새로고침하면 지워져요.</p>
      <div className="seo-status-grid">
        {statuses.map((status) => (
          <article key={status.id} className={`seo-status ${status.id}`}>
            <span>{status.label}</span>
            <strong>{Object.values(values).filter((v) => v === status.id).length}개</strong>
            <p>{status.text}</p>
          </article>
        ))}
      </div>
      <div className="seo-checks">
        {checks.map((check) => (
          <label key={check}>
            <span>{check}</span>
            <select
              aria-label={check}
              className={values[check] || ""}
              value={values[check] || ""}
              onChange={(e) => { const next = { ...values, [check]: e.target.value };setValues(next);onValuesChange?.(next); }}
            >
              <option value="">아직 확인 전</option>
              {statuses.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </label>
        ))}
      </div>
      <p className="workspace-footnote">아직 확인 전 {checks.length - Object.values(values).filter(Boolean).length}개 · 직접 체크한 결과예요. 자동 점수는 아니에요.</p>
    </section>
  );
}
