"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import {
  ArrowDown,
  ArrowDownRight,
  ArrowUpRight,
  Check,
  Copy,
  Download,
  Menu,
  Plus,
  X,
} from "lucide-react";
import Link from "next/link";
import { KitScene } from "@/components/kit-scene";
import {
  spectrum,
  studies,
  projectTypes,
  validateBrief,
  formatBrief,
  type SpectrumId,
  type ProjectBrief,
} from "@/lib/brand";

function BrandMark({ className = "" }: { className?: string }) {
  return (
    <span className={`wordmark ${className}`} aria-label="KITS">
      <svg viewBox="0 0 28 28" fill="none" aria-hidden="true">
        <path
          d="M2 3h7v9L19 3h8L15 14l12 11h-9l-9-9v9H2V3Z"
          fill="currentColor"
        />
      </svg>
      <span>
        KITS
        <span className="wordmark-dot" aria-hidden="true">
          +
        </span>
      </span>
    </span>
  );
}
function SectionLabel({
  number,
  children,
  light = false,
}: {
  number: string;
  children: React.ReactNode;
  light?: boolean;
}) {
  return (
    <div className={`section-label ${light ? "light" : ""}`}>
      <span className="label-square" />
      <span>{children}</span>
      <span className="section-index">({number})</span>
    </div>
  );
}
const initialBrief: ProjectBrief = {
  name: "",
  email: "",
  company: "",
  type: "",
  description: "",
};

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSpectrum, setActiveSpectrum] = useState<SpectrumId>("heritage");
  const [filter, setFilter] = useState<"all" | SpectrumId>("all");
  const [study, setStudy] = useState<(typeof studies)[number] | null>(null);
  const [briefOpen, setBriefOpen] = useState(false);
  const [brief, setBrief] = useState<ProjectBrief>(initialBrief);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [prepared, setPrepared] = useState("");
  const [notice, setNotice] = useState("");
  const [scrolled, setScrolled] = useState(false);
  const studyDialog = useRef<HTMLDialogElement>(null);
  const briefDialog = useRef<HTMLDialogElement>(null);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const current = spectrum.find((s) => s.id === activeSpectrum)!;
  const shown = studies.filter(
    (s) => filter === "all" || s.category === filter,
  );
  useEffect(() => {
    document.documentElement.dataset.hydrated = "true";
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    let observer: IntersectionObserver | undefined;
    if (!reduced) {
      document.documentElement.classList.add("has-motion");
      observer = new IntersectionObserver(
        (entries) =>
          entries.forEach((e) => {
            if (e.isIntersecting) {
              e.target.classList.add("is-visible");
              observer?.unobserve(e.target);
            }
          }),
        { threshold: 0.08 },
      );
      document
        .querySelectorAll(".reveal")
        .forEach((el) => observer!.observe(el));
    }
    return () => {
      window.removeEventListener("scroll", onScroll);
      observer?.disconnect();
      document.documentElement.classList.remove("has-motion");
    };
  }, []);
  useEffect(() => {
    if (study) studyDialog.current?.showModal();
    else studyDialog.current?.close();
  }, [study]);
  useEffect(() => {
    if (briefOpen) briefDialog.current?.showModal();
    else briefDialog.current?.close();
  }, [briefOpen]);
  useEffect(() => {
    const previous = document.body.style.overflow;
    if (study || briefOpen) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [study, briefOpen]);
  function startProject(description = "") {
    setStudy(null);
    setBrief({ ...initialBrief, description });
    setPrepared("");
    setErrors({});
    setNotice("");
    setBriefOpen(true);
  }
  function handleTabKey(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;
    if (e.key === "ArrowRight") next = (index + 1) % 3;
    else if (e.key === "ArrowLeft") next = (index + 2) % 3;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = 2;
    else return;
    e.preventDefault();
    setActiveSpectrum(spectrum[next].id);
    tabs.current[next]?.focus();
  }
  function prepare() {
    const validation = validateBrief(brief);
    setErrors(validation);
    if (Object.keys(validation).length) {
      setNotice("입력 내용을 확인해 주세요.");
      return null;
    }
    const text = formatBrief(brief);
    setPrepared(text);
    return text;
  }
  async function copyBrief(e: FormEvent) {
    e.preventDefault();
    const text = prepare();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setNotice("제안 내용을 복사했습니다. 원하는 채널로 전달해 주세요.");
    } catch {
      setNotice(
        "브리프가 준비되었습니다. 아래 내용을 직접 복사하거나 파일로 저장해 주세요.",
      );
    }
  }
  function downloadBrief() {
    const text = prepare();
    if (!text) return;
    const url = URL.createObjectURL(
      new Blob([text], { type: "text/plain;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "KITS-project-brief.txt";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice("프로젝트 브리프를 파일로 저장했습니다.");
  }
  function updateBrief(key: keyof ProjectBrief, value: string) {
    setBrief((b) => ({ ...b, [key]: value }));
    setPrepared("");
    setNotice("");
    setErrors((e) => ({ ...e, [key]: "" }));
  }
  return (
    <>
      <a className="skip-link" href="#main">
        본문으로 건너뛰기
      </a>
      <header className={`site-header ${scrolled ? "is-scrolled" : ""}`}>
        <div className="nav-inner">
          <a href="#" aria-label="KITS 홈" className="home-link">
            <BrandMark />
          </a>
          <nav
            aria-label="주 메뉴"
            className={menuOpen ? "main-nav is-open" : "main-nav"}
          >
            {[
              ["About", "about"],
              ["Our spectrum", "spectrum"],
              ["Object studies", "studies"],
            ].map(([label, id]) => (
              <a href={`#${id}`} key={id} onClick={() => setMenuOpen(false)}>
                {label}
              </a>
            ))}
            <Link
              href="/tools/"
              className="tools-nav-link"
              onClick={() => setMenuOpen(false)}
            >
              Tools <ArrowUpRight size={12} />
            </Link>
          </nav>
          <button className="nav-contact" onClick={() => startProject()}>
            Let’s make a kit <ArrowUpRight size={14} />
          </button>
          <button
            type="button"
            className="menu-toggle"
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "메뉴 닫기" : "메뉴 열기"}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </header>
      <main id="main">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-grid-lines" aria-hidden="true" />
          <div className="hero-inner shell">
            <div className="hero-copy">
              <div className="eyebrow hero-eyebrow">
                <span className="status-dot" /> OBJECT CURATION & CREATIVE LAB
              </div>
              <h1 id="hero-title">
                Sensible
                <br />
                <span className="hero-line">
                  Everyday{" "}
                  <span className="hero-star" aria-hidden="true">
                    ✳
                  </span>
                </span>
                <span className="hero-kits">
                  Kits<span className="hero-period">.</span>
                </span>
              </h1>
              <p className="hero-description">
                삶과 브랜드의 순간을 완성하는
                <br />
                <strong>가장 감각적인 해답, KITS.</strong>
              </p>
              <a href="#spectrum" className="pill-button lime">
                Explore our spectrum <ArrowUpRight size={17} />
              </a>
            </div>
            <div className="hero-visual">
              <div className="visual-corner top-left" />
              <div className="visual-corner top-right" />
              <div className="scene-meta">
                <span>THE ESSENTIAL EDIT</span>
                <span>OBJECT STUDY — 001 / 003</span>
              </div>
              <div className="hero-orbit" aria-hidden="true" />
              <KitScene />
              <div className="scene-caption">
                <span className="small-cross">+</span>
                <span>
                  ESSENTIAL IN FORM.
                  <br />
                  SENSIBLE IN EVERY WAY.
                </span>
                <span className="scene-coordinate">K/S — 37° N</span>
              </div>
              <div className="visual-corner bottom-left" />
              <div className="visual-corner bottom-right" />
            </div>
          </div>
          <div className="hero-bottom shell">
            <span>HERITAGE. PRESENT. NEXT.</span>
            <span>어제의 가치를 잇고, 내일의 감각을 제안합니다.</span>
            <a href="#about" aria-label="브랜드 소개로 내려가기">
              SCROLL TO DISCOVER <ArrowDown size={12} />
            </a>
          </div>
        </section>
        <div className="brand-ribbon" aria-hidden="true">
          <div>
            {Array.from({ length: 4 }, (_, i) => (
              <span key={i}>
                ESSENTIAL BY DESIGN <span>✳</span> SENSIBLE BY NATURE{" "}
                <span>✳</span>
              </span>
            ))}
          </div>
        </div>
        <section className="about-section shell section-space" id="about">
          <div className="about-top reveal">
            <SectionLabel number="01">THE IDEA OF KITS</SectionLabel>
            <span className="muted-caption">
              A TOOL. A MOMENT. A BETTER EVERYDAY.
            </span>
          </div>
          <div className="about-grid">
            <div className="about-heading reveal">
              <h2>
                더 많이가 아닌,
                <br />
                <span>더 본질적인 것.</span>
              </h2>
              <div className="kit-definition">
                <span>kit</span>
                <span>
                  /kɪt/ <i>noun.</i>
                </span>
                <p>
                  어떤 순간을 온전히 누리기 위해,
                  <br />
                  가장 필요한 본질만 정제해 담은 도구.
                </p>
              </div>
            </div>
            <div className="about-body reveal">
              <p className="lead-korean">
                우리의 매일을 채우는 사물들은
                <br />
                우리가 누구인지, 어떤 시대를
                <br className="desktop-break" /> 살아가는지를 말해줍니다.
              </p>
              <p>
                KITS는 시대의 유산부터 동시대의 트렌드, 내일의 감각까지 탐구하는
                오브제 큐레이션 & 크리에이티브 랩입니다.
              </p>
              <p>
                불필요한 것은 덜어내고, 분명한 쓰임과 정제된 디자인을 남깁니다.
                일상의 작은 조각부터 브랜드의 새로운 가능성까지, 가장
                감각적이면서도 쓸모 있는 형태로 완성합니다.
              </p>
              <a className="text-link" href="#manifesto">
                Read our manifesto <ArrowUpRight size={15} />
              </a>
            </div>
          </div>
        </section>
        <section className="spectrum-section" id="spectrum">
          <div className="shell section-space">
            <div className="section-heading-row reveal">
              <div>
                <SectionLabel number="02">OUR SPECTRUM</SectionLabel>
                <h2>
                  시대를 넘나드는 시선.
                  <br />
                  <span>일상에 닿는 세 가지 감각.</span>
                </h2>
              </div>
              <p>
                하나의 카테고리나 시대에 머물지 않습니다.
                <br />
                어제와 오늘, 내일에서 발견한 가능성을
                <br />
                손에 잡히는 해답으로 만듭니다.
              </p>
            </div>
            <div
              className="spectrum-tabs reveal"
              role="tablist"
              aria-label="KITS의 세 가지 스펙트럼"
            >
              {spectrum.map((s, i) => (
                <button
                  key={s.id}
                  ref={(el) => {
                    tabs.current[i] = el;
                  }}
                  role="tab"
                  type="button"
                  id={`tab-${s.id}`}
                  aria-controls="spectrum-panel"
                  aria-selected={activeSpectrum === s.id}
                  tabIndex={activeSpectrum === s.id ? 0 : -1}
                  onClick={() => setActiveSpectrum(s.id)}
                  onKeyDown={(e) => handleTabKey(e, i)}
                >
                  <span>{s.number}</span>
                  <strong>{s.title}</strong>
                  <ArrowUpRight size={18} />
                </button>
              ))}
            </div>
            <div
              className={`spectrum-panel ${activeSpectrum}`}
              role="tabpanel"
              id="spectrum-panel"
              aria-labelledby={`tab-${activeSpectrum}`}
              key={activeSpectrum}
            >
              <div className="spectrum-art">
                <span className="art-label">
                  KITS / {current.title.toUpperCase()} STUDY
                </span>
                <KitScene variant={activeSpectrum} />
                <span className="art-footnote">
                  FORM EXPLORATION — CONCEPT ONLY
                </span>
              </div>
              <div className="spectrum-copy">
                <span className="eyebrow">{current.era}</span>
                <h3>
                  {current.korean.split("\n").map((line, i) => (
                    <span key={line}>
                      {line}
                      {i === 0 && <br />}
                    </span>
                  ))}
                </h3>
                <p>{current.description}</p>
                <div className="tag-list">
                  {current.tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
                <button
                  className="text-link"
                  onClick={() => {
                    setFilter(activeSpectrum);
                    document
                      .getElementById("studies")
                      ?.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  이 감각의 오브제 살펴보기 <ArrowUpRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </section>
        <section className="studies-section shell section-space" id="studies">
          <div className="section-heading-row reveal">
            <div>
              <SectionLabel number="03">OBJECT STUDIES</SectionLabel>
              <h2>생각이, 형태가 되는 순간.</h2>
            </div>
            <p>
              정제된 형태와 새로운 쓰임을 탐구하는
              <br />
              KITS의 콘셉트 스터디.
            </p>
          </div>
          <div className="study-controls reveal">
            <span>EXPLORATIONS, NOT LIMITATIONS.</span>
            <div className="study-filters" aria-label="콘셉트 스터디 필터">
              {(["all", "heritage", "present", "next"] as const).map((v) => (
                <button
                  key={v}
                  aria-pressed={filter === v}
                  onClick={() => setFilter(v)}
                >
                  {v === "all"
                    ? "All objects"
                    : v[0].toUpperCase() + v.slice(1)}
                  {filter === v && <span />}
                </button>
              ))}
            </div>
          </div>
          <div className="study-grid" aria-live="polite">
            {shown.map((s) => (
              <button
                className={`study-card ${s.category}`}
                key={s.id}
                onClick={() => setStudy(s)}
                aria-label={`${s.title} 콘셉트 상세 보기`}
              >
                <div className="study-visual">
                  <div className="study-card-top">
                    <span>{s.category.toUpperCase()}</span>
                    <span>CONCEPT {s.id}</span>
                  </div>
                  <KitScene variant={s.category} />
                  <span className="study-open">
                    <ArrowUpRight size={20} />
                  </span>
                  <span className="study-material">{s.material}</span>
                </div>
                <div className="study-caption">
                  <div>
                    <h3>{s.title}</h3>
                    <p>{s.subtitle}</p>
                  </div>
                  <span>({s.id})</span>
                </div>
              </button>
            ))}
          </div>
        </section>
        <section className="principles-section" id="approach">
          <div className="shell section-space">
            <div className="section-heading-row reveal">
              <div>
                <SectionLabel number="04" light>
                  THE WAY WE MAKE
                </SectionLabel>
                <h2>감각에는 기준이 있습니다.</h2>
              </div>
              <p>
                아름다운 생각을 넘어, 선택받는 실물까지.
                <br />
                KITS가 지키는 네 가지 태도.
              </p>
            </div>
            <div className="principle-grid">
              {[
                [
                  "01",
                  "Essential Kit",
                  "정제된 완결성",
                  "복잡함을 덜어내고, 그 사물이 존재하는 목적에 가장 충실한 형태와 기능을 남깁니다.",
                ],
                [
                  "02",
                  "Trend & Futurity",
                  "동시대성과 미래 감각",
                  "라이프스타일의 변화, 새로운 소재와 기술을 포착해 한발 앞선 경험을 설계합니다.",
                ],
                [
                  "03",
                  "Heritage\nReinterpretation",
                  "유산과 상징의 현대화",
                  "고유의 미학과 이야기를 과거에 두지 않고, 오늘의 일상에서 살아 있는 오브제로 번역합니다.",
                ],
                [
                  "04",
                  "Sensible\nRealization",
                  "감각적 실체화",
                  "추상적인 아이디어를 높은 만듦새와 분명한 쓰임을 가진 실물 제품으로 구현합니다.",
                ],
              ].map(([n, en, ko, desc]) => (
                <article className="principle-card reveal" key={n}>
                  <div>
                    <span>{n}</span>
                    <Plus size={16} />
                  </div>
                  <h3>
                    {en.split("\n").map((line, i) => (
                      <span key={line}>
                        {line}
                        {i === 0 && en.includes("\n") && <br />}
                      </span>
                    ))}
                  </h3>
                  <h4>{ko}</h4>
                  <p>{desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section className="partners-section shell section-space" id="partners">
          <div className="partner-intro reveal">
            <SectionLabel number="05">FOR YOUR BRAND, WITH KITS</SectionLabel>
            <h2>
              브랜드의 가능성을,
              <br />
              감각적인 실물로.
            </h2>
            <p>
              고유한 철학을 담은 시그니처 제품부터
              <br />
              동시대의 감각을 읽어낸 새로운 라이프스타일 도구까지.
              <br />
              당신의 브랜드가 상상하는 다음을 함께 만듭니다.
            </p>
            <button className="pill-button dark" onClick={() => startProject()}>
              프로젝트 이야기 나누기 <ArrowUpRight size={17} />
            </button>
          </div>
          <div className="partner-process reveal">
            {[
              [
                "01",
                "Read the essence",
                "본질을 읽습니다",
                "브랜드의 철학, 고객의 일상, 시장의 흐름을 연결합니다.",
              ],
              [
                "02",
                "Shape the idea",
                "해답을 설계합니다",
                "컨셉과 쓰임, 소재와 형태를 하나의 방향으로 정제합니다.",
              ],
              [
                "03",
                "Make it tangible",
                "실물로 완성합니다",
                "OEM / ODM, 브랜디드 굿즈, 시그니처 제품으로 구현합니다.",
              ],
            ].map(([n, en, title, desc]) => (
              <div className="process-step" key={n}>
                <span>{n}</span>
                <div>
                  <span>{en}</span>
                  <h3>{title}</h3>
                  <p>{desc}</p>
                </div>
                <ArrowDownRight size={21} />
              </div>
            ))}
            <div className="service-tags">
              <span>PRODUCT PLANNING</span>
              <span>OEM / ODM</span>
              <span>BRANDED OBJECTS</span>
            </div>
          </div>
        </section>
        <section className="manifesto-section" id="manifesto">
          <div className="manifesto-inner shell reveal">
            <div className="manifesto-top">
              <SectionLabel number="06" light>
                OUR MANIFESTO
              </SectionLabel>
              <span className="manifesto-star" aria-hidden="true">
                ✳
              </span>
            </div>
            <p className="manifesto-statement">
              어제의 가치를 잇고,
              <br />
              오늘의 트렌드를 담으며,
              <br />
              <span>내일의 감각을 제안합니다.</span>
            </p>
            <div className="manifesto-bottom">
              <p>
                일상을 채우는 작은 조각 하나가 하루의 감도를 바꾸고,
                <br />
                정교하게 기획된 사물 하나가 브랜드의 미래를 증명하기에.
              </p>
              <span>SENSIBLE EVERYDAY KITS.</span>
            </div>
          </div>
        </section>
        <section className="contact-section shell reveal" id="contact">
          <div>
            <span className="eyebrow">
              <span className="status-dot" /> OPEN TO NEW POSSIBILITIES
            </span>
            <h2>
              What’s your
              <br />
              <span>next kit?</span>
            </h2>
          </div>
          <div className="contact-copy">
            <p>
              당신의 브랜드가 가진 이야기,
              <br />
              아직 형태가 되지 않은 아이디어.
              <br />
              KITS와 함께 다음을 만들어보세요.
            </p>
            <button
              className="contact-circle"
              onClick={() => startProject()}
              aria-label="프로젝트 제안서 작성하기"
            >
              <ArrowUpRight size={34} />
            </button>
            <button className="text-link" onClick={() => startProject()}>
              프로젝트 제안서 작성하기 <ArrowUpRight size={15} />
            </button>
          </div>
        </section>
        <footer className="site-footer">
          <div className="shell">
            <div className="footer-top">
              <a href="#" aria-label="KITS 홈으로">
                <BrandMark />
              </a>
              <span>OBJECT CURATION & CREATIVE LAB</span>
              <a href="#" className="back-top">
                Back to top <ArrowUpRight size={14} />
              </a>
            </div>
            <div className="footer-bottom">
              <span>
                © {new Date().getFullYear()} KITS. All rights reserved.
              </span>
              <span>Heritage, present, and everything next.</span>
              <Link href="/tools/" className="footer-tools-link">
                광고 수익성 진단 <ArrowUpRight size={12} />
              </Link>
              <button onClick={() => startProject()}>
                Let’s make something sensible. <ArrowUpRight size={12} />
              </button>
            </div>
          </div>
        </footer>
      </main>
      <dialog
        ref={studyDialog}
        className="study-dialog"
        aria-labelledby="study-dialog-title"
        onClose={() => setStudy(null)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setStudy(null);
        }}
      >
        {study && (
          <div className="study-dialog-inner">
            <button
              className="dialog-close"
              onClick={() => setStudy(null)}
              aria-label="상세 보기 닫기"
            >
              <X size={21} />
            </button>
            <div className={`dialog-art ${study.category}`}>
              <KitScene variant={study.category} />
            </div>
            <div className="dialog-study-copy">
              <span className="eyebrow">
                {study.category.toUpperCase()} / CONCEPT {study.id}
              </span>
              <h2 id="study-dialog-title">{study.title}</h2>
              <h3>{study.subtitle}</h3>
              <p>{study.detail}</p>
              <p className="concept-note">
                브랜드의 방향을 표현한 오리지널 콘셉트 스터디입니다. 실제 판매
                제품 또는 진행된 클라이언트 프로젝트를 의미하지 않습니다.
              </p>
              <button
                className="pill-button dark"
                onClick={() =>
                  startProject(
                    `${study.title}의 방향을 바탕으로 프로젝트를 함께 기획하고 싶습니다.`,
                  )
                }
              >
                이런 프로젝트 함께 만들기 <ArrowUpRight size={15} />
              </button>
            </div>
          </div>
        )}
      </dialog>
      <dialog
        ref={briefDialog}
        className="brief-dialog"
        aria-labelledby="brief-title"
        onClose={() => setBriefOpen(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setBriefOpen(false);
        }}
      >
        <div className="brief-inner">
          <button
            className="dialog-close"
            onClick={() => setBriefOpen(false)}
            aria-label="프로젝트 제안 닫기"
          >
            <X size={21} />
          </button>
          <span className="eyebrow">LET’S MAKE IT TANGIBLE</span>
          <h2 id="brief-title">
            당신의 다음 Kit은
            <br />
            무엇인가요?
          </h2>
          <p className="brief-intro">
            아이디어를 간단한 프로젝트 브리프로 정리해 보세요.
            <br />
            내용을 복사하거나 파일로 저장할 수 있습니다.
          </p>
          <form noValidate onSubmit={copyBrief}>
            <div className="brief-fields">
              {(
                [
                  ["name", "이름", "홍길동", "text", true],
                  ["email", "이메일", "name@brand.com", "email", true],
                  [
                    "company",
                    "브랜드 / 회사",
                    "브랜드명 또는 회사명",
                    "text",
                    false,
                  ],
                ] as const
              ).map(([key, label, placeholder, type, required]) => (
                <label key={key} className={key === "company" ? "wide" : ""}>
                  {label} {required && <span>*</span>}
                  <input
                    name={key}
                    type={type}
                    autoComplete={
                      key === "name"
                        ? "name"
                        : key === "email"
                          ? "email"
                          : "organization"
                    }
                    placeholder={placeholder}
                    value={brief[key]}
                    maxLength={
                      key === "name" ? 60 : key === "email" ? 254 : 100
                    }
                    required={required}
                    aria-invalid={!!errors[key]}
                    aria-describedby={errors[key] ? `${key}-error` : undefined}
                    onChange={(e) => updateBrief(key, e.target.value)}
                  />
                  {errors[key] && (
                    <small className="field-error" id={`${key}-error`}>
                      {errors[key]}
                    </small>
                  )}
                </label>
              ))}
              <label className="wide">
                프로젝트 유형 <span>*</span>
                <select
                  value={brief.type}
                  required
                  aria-invalid={!!errors.type}
                  aria-describedby={errors.type ? "type-error" : undefined}
                  onChange={(e) => updateBrief("type", e.target.value)}
                >
                  <option value="">어떤 프로젝트를 생각하고 계신가요?</option>
                  {projectTypes.map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
                {errors.type && (
                  <small className="field-error" id="type-error">
                    {errors.type}
                  </small>
                )}
              </label>
              <label className="wide">
                프로젝트 이야기 <span>*</span>
                <textarea
                  value={brief.description}
                  rows={4}
                  maxLength={2000}
                  required
                  placeholder="브랜드의 이야기, 만들고 싶은 제품, 일정이나 수량 등 자유롭게 들려주세요. (10자 이상)"
                  aria-invalid={!!errors.description}
                  aria-describedby={
                    errors.description ? "description-error" : undefined
                  }
                  onChange={(e) => updateBrief("description", e.target.value)}
                />
                {errors.description && (
                  <small className="field-error" id="description-error">
                    {errors.description}
                  </small>
                )}
                <span className="character-count">
                  {brief.description.length} / 2,000
                </span>
              </label>
            </div>
            <p className="brief-local-note">
              입력 내용은 서버에 전송되지 않습니다. 파일 저장이나 복사 후 원하는
              채널로 직접 전달해 주세요.
            </p>
            <div className="brief-actions">
              <button type="submit" className="pill-button dark">
                <Copy size={15} /> 제안 내용 복사하기
              </button>
              <button
                type="button"
                className="brief-download"
                onClick={downloadBrief}
                aria-label="프로젝트 제안서 파일 저장"
              >
                <Download size={18} />
              </button>
            </div>
            {notice && (
              <p role="status" className="brief-status">
                {prepared && <Check size={15} />} {notice}
              </p>
            )}
            {prepared && (
              <label className="prepared-brief">
                완성된 프로젝트 브리프
                <textarea
                  aria-label="완성된 프로젝트 브리프"
                  readOnly
                  value={prepared}
                  rows={7}
                  onFocus={(e) => e.currentTarget.select()}
                />
              </label>
            )}
          </form>
        </div>
      </dialog>
    </>
  );
}
