"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useDraftPreviewStage } from '@/lib/draft-preview-stage';
import Link from "next/link";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { consultationEndpoint } from "@/lib/consultation-api";

type Answers = {
  brandVision:string; audience:string; category:string; categoryOther:string;
  stage:string; budget:string; support:string[]; brandGoal:string;
};
type Step =
 | {id:'category'|'stage'|'budget';kind:'single';title:string;hint?:string;options:string[]}
 | {id:'support';kind:'multi';title:string;hint?:string;options:string[]}
 | {id:'brandVision'|'audience'|'brandGoal';kind:'text';title:string;hint:string;placeholder:string;optional?:boolean}
 | {id:'contact';kind:'contact';title:string;hint:string};
const OTHER='기타';
const steps:Step[]=[
 {id:'brandVision',kind:'text',title:'어떤 브랜드를 만들고 싶나요?',hint:'이름이 없어도 괜찮아요. 떠오르는 모습을 짧게 적어주세요.',placeholder:'예: 일상에서 오래 쓰는 실용적인 생활용품 브랜드'},
 {id:'audience',kind:'text',title:'누구에게 사랑받는 브랜드이고 싶나요?',hint:'고객의 생활이나 고민을 떠올려 보세요.',placeholder:'예: 작은 집에서도 편하게 살고 싶은 1인 가구'},
 {id:'category',kind:'single',title:'어떤 상품으로 시작하고 싶나요?',options:['생활·주방','뷰티·헬스','패션·잡화','식품','디지털·가전','유아·반려동물',OTHER]},
 {id:'stage',kind:'single',title:'지금 어디까지 준비했나요?',options:['아이디어를 정리하고 있어요','상품·샘플을 준비하고 있어요','이미 판매하고 있어요','기존 브랜드를 새롭게 바꾸고 싶어요']},
 {id:'budget',kind:'single',title:'브랜드 준비에 얼마까지 쓸 수 있나요?',hint:'상품·디자인·판매 준비를 합친 전체 예산이에요.',options:['500만 원 미만','500만~2천만 원','2천만~5천만 원','5천만 원 이상','아직 정하지 못했어요']},
 {id:'support',kind:'multi',title:'어떤 준비를 함께하고 싶나요?',hint:'여러 개를 고를 수 있어요.',options:['브랜드 방향·고객 정리','상품 기획·소싱·수입','이름·로고·패키지','인증·물류·판매 준비','온라인 스토어·상세페이지','홍보·판매 성장','전체적으로 점검하고 싶어요']},
 {id:'brandGoal',kind:'text',title:'6개월 뒤, 어떤 브랜드가 되길 바라나요?',hint:'작은 목표도 좋아요. 아직 모르겠다면 건너뛰세요.',placeholder:'예: 첫 고객 100명이 다시 찾는 브랜드',optional:true},
 {id:'contact',kind:'contact',title:'함께 이야기할 연락처를 남겨주세요',hint:'답변을 바탕으로 브랜드 상담을 준비할게요.'},
];
const empty:Answers={brandVision:'',audience:'',category:'',categoryOther:'',stage:'',budget:'',support:[],brandGoal:''};

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

  const previewStage = useDraftPreviewStage('/tools/survey/');
  useEffect(() => { if (previewStage) setIndex(Number(previewStage.slice(7))); }, [previewStage]);
  const active = steps;
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
    setAnswers(update);
    if (!(step.id === "category" && option === OTHER)) {
      setError("");
      setIndex((i) => Math.min(i + 1, active.length - 1));
    }
  }
  function toggle(option: string) {
    setError("");
    setAnswers((a) => ({
      ...a,
      support: a.support.includes(option)
        ? a.support.filter((p) => p !== option)
        : [...a.support, option],
    }));
  }
  function continueStep() {
    if (step.kind === "single" && !answers[step.id]) {
      setError("하나를 골라 주세요.");
      return;
    }
    if (step.kind === "multi" && !answers.support.length) {
      setError("하나 이상 골라 주세요.");
      return;
    }
    if(step.kind==='text'&&!step.optional&&!answers[step.id].trim()){
      setError('한두 줄로 적어 주세요.');return;
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
    <div className="sv-card" data-preview-stage={`survey-${index}`}>
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
                aria-checked={answers.support.includes(option)}
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
              value={answers[step.id]}
              placeholder={step.placeholder}
              onChange={(e) => setAnswers({ ...answers, [step.id]: e.target.value })}
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
              목적: 브랜드 상담 준비와 연락. 관리자만 열람하며 목적을 달성하면
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
                  {step.kind === "text" && step.optional && !answers[step.id].trim() ? "건너뛰기" : "다음"}
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
