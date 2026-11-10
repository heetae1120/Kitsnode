"use client";
import { memo, useEffect, useRef, useState } from "react";
import { toolLinks, type ToolId } from "@/lib/tool-navigation";
import Link from "next/link";
import { ChevronDown, ClipboardList, CircleHelp } from "lucide-react";
import { MenuMotion } from "@/components/menu-motion";
import { LiquidNavbar, type LiquidNavItem } from "@/components/ui/liquid-glass-navbar";
import { storeLinks } from "@/lib/store-navigation";

const groups = [
  { id: "store", label: "스토어 점검", ids: ["rankings", "seo", "traffic"] },
  { id: "ads", label: "광고 도구", ids: ["bidding", "negative-search"] },
] as const;

const liquidItems: LiquidNavItem[] = [
  {label:"남는 돈 계산",fx:"glow"}, {label:"검색어 찾기",fx:"spin"},
  {label:"설문",fx:"pop"}, {label:"소개",fx:"wave"},
  {label:"스토어 점검",fx:"drop"}, {label:"광고 도구",fx:"spin"},
];

export const ToolsHeader = memo(function ToolsHeader({ active }: { active: ToolId }) {
  const [open, setOpen] = useState(false);
  const [group, setGroup] = useState<string | null>(null);
  const header = useRef<HTMLElement>(null);
  const groupButtons = useRef<Record<string, HTMLButtonElement | null>>({});
  function close() {
    setOpen(false);
    setGroup(null);
  }
  useEffect(() => {
    function outside(event: PointerEvent) {
      if (event.target instanceof Node && !header.current?.contains(event.target)) {
        setOpen(false);
        setGroup(null);
      }
    }
    function escape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (group) {
        setGroup(null);
        groupButtons.current[group]?.focus();
      } else if (open) {
        setOpen(false);
        header.current?.querySelector<HTMLButtonElement>(".tool-mobile-menu")?.focus();
      }
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [group, open]);
  const selected = group ? (group === "store" ? 4 : 5) : ["profit","keywords","survey","about"].indexOf(active);
  const liquidActive = selected >= 0 ? selected : groups.findIndex(item => item.ids.some(id => id === active)) >= 0 ? 4 + groups.findIndex(item => item.ids.some(id => id === active)) : -1;
  return (
    <header ref={header} className="tool-topbar expanded-tools">
      <Link className="tool-brand" href="/tools/start/" aria-label="KITSNODE 도구 메인으로" aria-current={active === "start" ? "page" : undefined} onClick={close}>
        KITSNODE
      </Link>
      <LiquidNavbar id="tools-navigation" motionKey="tools" ariaLabel="도구 메뉴" items={liquidItems} active={liquidActive} compact={false} sound={false} className={open ? "tool-nav open" : "tool-nav"}>
        {["profit", "keywords"].map((id) => {
          const tool = toolLinks.find((item) => item.id === id)!;
          return (
            <Link
              key={tool.id}
              className="nimbus-item"
              href={tool.href}
              aria-current={active === tool.id ? "page" : undefined}
              onClick={close}
            >
              <span className="nv-ico"><MenuMotion kind={tool.id === "profit" ? "profit" : "keywords"} /></span>
              <span className="tool-nav-label">{tool.id === "keywords" ? "검색어 찾기" : tool.label}</span>
            </Link>
          );
        })}
        <Link className="nimbus-item" href="/tools/survey/" aria-current={active === "survey" ? "page" : undefined} onClick={close}><span className="nv-ico"><ClipboardList size={18} aria-hidden="true"/></span><span>설문</span></Link>
        <Link className="nimbus-item" href="/tools/about/" aria-current={active === "about" ? "page" : undefined} onClick={close}><span className="nv-ico"><CircleHelp size={18} aria-hidden="true"/></span><span>소개</span></Link>
        <span className="tool-nav-separator" aria-hidden="true" />
        {groups.map((item) => (
          <div key={item.id} className="tool-nav-group">
            <button
              className="nimbus-item"
              ref={(element) => { groupButtons.current[item.id] = element; }}
              type="button"
              aria-expanded={group === item.id}
              aria-controls={`tool-group-${item.id}`}
              data-active={item.ids.some((id) => id === active) || undefined}
              onClick={() => setGroup(group === item.id ? null : item.id)}
            >
              <span className="nv-ico"><MenuMotion kind={item.id} /></span>
              <span className="tool-nav-label">{item.label}</span>
              <ChevronDown className="tool-nav-chevron" size={14} aria-hidden="true" />
            </button>
            <div id={`tool-group-${item.id}`} className="tool-subnav" hidden={group !== item.id}>
              <p className="tool-membership-notice" role="status">{item.label}은 회원가입 후 이용할 수 있습니다.</p>
              <small className="tool-membership-note">회원가입·로그인 기능은 준비 중입니다.</small>
              {item.id === "store" && storeLinks.map(link => (
                <Link key={link.id} href={link.href} onClick={close}>{link.label}</Link>
              ))}
            </div>
          </div>
        ))}
      </LiquidNavbar>
      <button className="tool-mobile-menu" type="button" aria-label={open ? "메뉴 닫기" : "메뉴 열기"}
        aria-expanded={open} aria-controls="tools-navigation" onClick={() => { setOpen(!open); setGroup(null); }}>
        <span className="tool-menu-toggle" aria-hidden="true"><span /><span /><span /></span>
      </button>
    </header>
  );
});
