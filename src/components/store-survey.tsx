"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { consultationEndpoint } from "@/lib/consultation-api";

type Answers = {
  status: string;
  category: string;
  categoryOther: string;
  revenue: string;
  adMode: string;
  adSpend: string;
  pains: string[];
  goal: string;
};

type Step =
  | {
      id: keyof Answers;
      kind: "single" | "multi";
      title: string;
      hint?: string;
      options: string[];
      skip?: (a: Answers) => boolean;
    }
  | { id: "goal"; kind: "text"; title: string; hint: string; placeholder: string }
  | { id: "contact"; kind: "contact"; title: string; hint: string };

const NO_ADS = "광고를 하지 않습니다";
const OTHER = "기타";

const steps: Step[] = [
  {
    id: "status",
    kind: "single",
    title: "스마트스토어를 운영하나요?",
    options: ["운영하고 있습니다", "오픈을 준비하고 있습니다", "다른 채널에서만 판매합니다"],
  },
  {
    id: "category",
    kind: "single",
    title: "어떤 상품을 판매하시나요?",
    hint: "가장 많이 파는 상품을 고르세요.",
    options: ["생활·주방", "뷰티·헬스", "패션·잡화", "식품", "디지털·가전", "유아·반려동물", OTHER],
  },
  {
    id: "revenue",
    kind: "single",
    title: "지난달 매출은 얼마인가요?",
    hint: "대략적인 구간이면 충분합니다.",
    options: ["아직 매출이 없습니다", "1천만 원 미만", "1천만~5천만 원", "5천만~1억 원", "1억 원 이상"],
  },
  {
    id: "adMode",
    kind: "single",
    title: "광고는 누가 관리하나요?",
    options: ["직접 운영합니다", "대행사에 맡기고 있습니다", NO_ADS],
  },
  {
    id: "adSpend",
    kind: "single",
    title: "한 달 광고비는 얼마인가요?",
    hint: "대행 수수료를 뺀 광고비예요.",
    options: ["100만 원 미만", "100만~500만 원", "500만~1,000만 원", "1,000만 원 이상"],
    skip: (a) => a.adMode === NO_ADS,
  },
  {
    id: "pains",
    kind: "multi",
    title: "요즘 가장 답답한 점을 모두 골라 주세요",
    hint: "여러 개를 고를 수 있습니다.",
    options: [
      "광고를 끄면 순위와 매출이 바로 떨어집니다",
      "광고 매출은 나는데 이익이 없습니다",
      "대행사 보고서를 믿기 어렵습니다",
      "재구매나 브랜드 검색이 늘지 않습니다",
      "상품 설명과 리뷰가 부족합니다",
      "무엇부터 해야 할지 모르겠습니다",
    ],
  },
  {
    id: "goal",
    kind: "text",
    title: "6개월 뒤, 스토어가 어떤 모습이면 좋겠나요?",
    hint: "한두 줄이면 됩니다. 건너뛰어도 괜찮습니다.",
    placeholder: "예: 광고비를 줄여도 매출이 유지됐으면 좋겠어요",
  },
  {
    id: "contact",
    kind: "contact",
    title: "결과를 받아 보실 연락처를 남겨 주세요",
    hint: "답변을 보고 상담을 준비할게요.",
  },
];

const empty: Answers = {
  status: "",
  category: "",
  categoryOther: "",
  revenue: "",
  adMode: "",
  adSpend: "",
  pains: [],
  goal: "",
};

export function StoreSurvey() {
  const [answers, setAnswers] = useState<Answers>(empty);
  const [index, setIndex] = useState(0);
  const [contact, setContact] = useState({ store: "", company: "", nameRole: "", phone: "" });
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [savedId, setSavedId] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);

  const active = steps.filter((s) => !("skip" in s && s.skip?.(answers)));
  const step = active[Math.min(index, active.length - 1)];
  const position = Math.min(index, active.length - 1);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    heading.current?.focus();
  }, [position, savedId]);

  const next = () => {
    setError("");
    setIndex((i) => Math.min(i + 1, active.length - 1));
  };
  const back = () => {
    setError("");
    setIndex((i) => Math.max(i - 1, 0));
  };

  function choose(option: string) {
    if (step.kind !== "single") return;
    const update = { ...answers, [step.id]: option } as Answers;
    if (step.id === "adMode" && option === NO_ADS) update.adSpend = "";
    setAnswers(update);
    if (!(step.id === "category" && option === OTHER)) {
      setError("");
      // advance after the selection is seen
      window.setTimeout(() => setIndex((i) => i + 1), 180);
    }
  }
  function toggle(option: string) {
    setError("");
    setAnswers((a) => ({
      ...a,
      pains: a.pains.includes(option)
        ? a.pains.filter((p) => p !== option)
        : [...a.pains, option],
    }));
  }
  function continueStep() {
    if (step.kind === "single" && !answers[step.id]) {
      setError("하나를 골라 주세요.");
      return;
    }
    if (step.kind === "multi" && !answers.pains.length) {
      setError("하나 이상 골라 주세요.");
      return;
    }
    next();
  }

  // Enter moves on, as in a typed form. Buttons, inputs and the text area
  // keep their own Enter behaviour.
  const continueRef = useRef(continueStep);
  continueRef.current = continueStep;
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Enter" || e.isComposing) return;
      const t = e.target as HTMLElement;
      if (t.closest("button, input, textarea, select, a")) return;
      if (step.kind === "contact" || savedId) return;
      e.preventDefault();
      continueRef.current();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [step.kind, savedId]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError("");
    if (!contact.company.trim() || !contact.nameRole.trim() || !contact.phone.trim()) {
      setError("상호명, 이름과 직급, 연락처를 입력해 주세요.");
      return;
    }
    if (!consent) {
      setError("연락을 위한 개인정보 수집·이용에 동의해 주세요.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(consultationEndpoint(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "omit",
        body: JSON.stringify({
          ...contact,
          consent,
          answers: {
            ...answers,
            categoryOther: answers.category === OTHER ? answers.categoryOther : "",
          },
        }),
        signal: AbortSignal.timeout(15000),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
          typeof data.error === "string" ? data.error : "설문을 저장하지 못했습니다. 다시 시도해 주세요.",
        );
      if (typeof data.id !== "string")
        throw new Error("접수 결과를 확인하지 못했습니다. 다시 보내기 전에 문의해 주세요.");
      setSavedId(data.id);
    } catch (e) {
      setError(
        e instanceof Error && e.name !== "TimeoutError"
          ? e.message
          : "서버 응답이 없습니다. 잠시 후 다시 시도해 주세요.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (savedId)
    return (
      <div className="sv-card sv-done" aria-live="polite">
        <span className="sv-done-mark" aria-hidden>
          <Check size={22} />
        </span>
        <h2 ref={heading} tabIndex={-1}>
          설문이 접수되었습니다
        </h2>
        <p>답변을 보고 남겨 주신 연락처로 연락드리겠습니다.</p>
        <p className="sv-receipt">접수번호 {savedId}</p>
        <Link className="kp-button line" href="/tools/about/">
          소개 다시 보기
        </Link>
      </div>
    );

  const progress = (position + 1) / active.length;
  return (
    <div className="sv-card">
      <div className="sv-progress" aria-hidden>
        <i style={{ transform: `scaleX(${progress})` }} />
      </div>
      <div className="sv-meta">
        {position > 0 ? (
          <button type="button" className="sv-back" onClick={back}>
            <ArrowLeft size={16} aria-hidden /> 이전
          </button>
        ) : (
          <span />
        )}
        <span className="sv-count">
          {position + 1} / {active.length}
        </span>
      </div>

      <fieldset className="sv-step" key={step.id}>
        <legend>
          <h2 ref={heading} tabIndex={-1}>
            {step.title}
          </h2>
        </legend>
        {"hint" in step && step.hint && <p className="sv-hint">{step.hint}</p>}

        {step.kind === "single" && (
          <div className="sv-options" role="radiogroup" aria-label={step.title}>
            {step.options.map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={answers[step.id] === option}
                onClick={() => choose(option)}
              >
                <span className="sv-dot" aria-hidden />
                {option}
              </button>
            ))}
          </div>
        )}
        {step.kind === "single" && step.id === "category" && answers.category === OTHER && (
          <label className="sv-field">
            어떤 상품인지 적어 주세요
            <input
              autoFocus
              maxLength={100}
              value={answers.categoryOther}
              onChange={(e) => setAnswers({ ...answers, categoryOther: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  continueStep();
                }
              }}
              placeholder="예: 캠핑용품"
            />
          </label>
        )}

        {step.kind === "multi" && (
          <div className="sv-options" role="group" aria-label={step.title}>
            {step.options.map((option) => (
              <button
                key={option}
                type="button"
                role="checkbox"
                aria-checked={answers.pains.includes(option)}
                onClick={() => toggle(option)}
              >
                <span className="sv-box" aria-hidden>
                  <Check size={14} />
                </span>
                {option}
              </button>
            ))}
          </div>
        )}

        {step.kind === "text" && (
          <label className="sv-field">
            <span className="sv-visually-hidden">{step.title}</span>
            <textarea
              rows={3}
              maxLength={500}
              value={answers.goal}
              placeholder={step.placeholder}
              onChange={(e) => setAnswers({ ...answers, goal: e.target.value })}
            />
          </label>
        )}

        {step.kind === "contact" && (
          <form className="sv-contact" onSubmit={submit} noValidate>
            {(
              [
                ["company", "상호명", "text", "예: 키츠상점", "organization"],
                ["nameRole", "이름과 직급", "text", "예: 홍길동 대표", "name"],
                ["phone", "연락처", "tel", "010-0000-0000", "tel"],
                ["store", "스마트스토어 주소 (선택)", "url", "https://smartstore.naver.com/…", "url"],
              ] as const
            ).map(([key, label, type, placeholder, auto]) => (
              <label className="sv-field" key={key}>
                {label}
                <input
                  type={type}
                  autoComplete={auto}
                  maxLength={key === "store" ? 1000 : 100}
                  disabled={busy}
                  value={contact[key]}
                  placeholder={placeholder}
                  onChange={(e) => {
                    setContact({ ...contact, [key]: e.target.value });
                    setError("");
                  }}
                />
              </label>
            ))}
            <p className="sv-note">
              수집 항목: 상호명, 이름과 직급, 연락처, 스토어 주소(선택), 설문 답변.
              목적: 진단 결과 안내와 상담 연락. 관리자만 열람하며 목적을 달성하면
              삭제합니다. 동의하지 않으실 수 있으나 그 경우 접수가 되지 않습니다.
            </p>
            <label className="sv-consent">
              <input
                type="checkbox"
                checked={consent}
                disabled={busy}
                onChange={(e) => {
                  setConsent(e.target.checked);
                  setError("");
                }}
              />
              연락을 위한 개인정보 수집·이용에 동의합니다
            </label>
            {error && (
              <p className="sv-error" role="alert">
                {error}
              </p>
            )}
            <button type="submit" className="kp-button primary sv-submit" disabled={busy}>
              {busy && <Loader2 size={17} className="sv-spin" aria-hidden />}
              {busy ? "보내는 중…" : "설문 보내기"}
            </button>
          </form>
        )}

        {step.kind !== "contact" && (
          <>
            {error && (
              <p className="sv-error" role="alert">
                {error}
              </p>
            )}
            {(step.kind !== "single" || (step.id === "category" && answers.category === OTHER) || answers[step.id]) && (
              <div className="sv-next">
                <button type="button" className="kp-button primary" onClick={continueStep}>
                  {step.kind === "text" && !answers.goal.trim() ? "건너뛰기" : "다음"}
                </button>
                {step.kind !== "text" && <span>Enter 키로도 넘어갈 수 있습니다</span>}
              </div>
            )}
          </>
        )}
      </fieldset>
    </div>
  );
}
