"use client";
import { useState } from "react";
const checks = ["상품명과 핵심 키워드", "카테고리 적합성", "상품 설명과 주요 정보", "이미지 대체 텍스트", "모바일 화면 가독성"];
const statuses = [
  { id: "positive", label: "긍정", text: "확인한 기준을 충족합니다." },
  { id: "normal", label: "보통", text: "추가 점검할 부분이 있습니다." },
  { id: "improve", label: "개선 필요", text: "수정할 항목이 있습니다." },
] as const;
export function SeoChecklist() {
  const [values, setValues] = useState<Record<string, string>>({});
  return (
    <section className="workspace-panel" aria-labelledby="seo-checklist-title">
      <h2 id="seo-checklist-title">SEO 직접 점검</h2>
      <p>확인한 항목의 상태를 선택하세요. 기록은 현재 화면에서만 유지됩니다.</p>
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
              onChange={(e) => setValues({ ...values, [check]: e.target.value })}
            >
              <option value="">미평가</option>
              {statuses.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </label>
        ))}
      </div>
      <p className="workspace-footnote">미평가 {checks.length - Object.values(values).filter(Boolean).length}개 · 직접 점검 결과이며 자동 SEO 점수가 아닙니다.</p>
    </section>
  );
}
