"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Layers3, Menu, X } from "lucide-react";
export function ToolsHeader({ active }: { active: "profit" | "keywords" }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="tool-topbar">
      <Link className="tool-brand" href="/" aria-label="KITS 브랜드 홈으로">
        <span className="tool-brand-icon">
          <Layers3 size={20} />
        </span>
        KITS
        <span className="tool-brand-divider" />
        <span className="tool-brand-caption">Tools · 비즈니스 도구</span>
      </Link>
      <nav
        aria-label="도구 메뉴"
        className={open ? "tool-nav open" : "tool-nav"}
      >
        <Link
          href="/tools/"
          aria-current={active === "profit" ? "page" : undefined}
          onClick={() => setOpen(false)}
        >
          수익성 분석
        </Link>
        <Link
          href="/tools/keywords/"
          aria-current={active === "keywords" ? "page" : undefined}
          onClick={() => setOpen(false)}
        >
          네이버 키워드 도구
        </Link>
        {active === "profit" && (
          <a href="#simulation" onClick={() => setOpen(false)}>
            예산 시뮬레이션
          </a>
        )}
        <Link href="/" onClick={() => setOpen(false)}>
          브랜드 홈 <ArrowUpRight size={13} />
        </Link>
      </nav>
      <span className="tool-demo-pill">
        <span />
        KITS TOOLS
      </span>
      <button
        className="tool-mobile-menu"
        type="button"
        aria-label={open ? "메뉴 닫기" : "메뉴 열기"}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {open ? <X /> : <Menu />}
      </button>
    </header>
  );
}
