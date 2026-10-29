"use client";
import { useEffect, useRef, useState } from "react";
import { toolLinks, type ToolId } from "@/lib/tool-navigation";
import Link from "next/link";
import { ChevronDown, Layers3 } from "lucide-react";
import { MenuMotion } from "@/components/menu-motion";

const groups = [
  { id: "store", label: "스토어 분석", ids: ["rankings", "seo", "traffic"] },
  { id: "ads", label: "광고 관리", ids: ["bidding", "negative-search"] },
] as const;

export function ToolsHeader({ active }: { active: ToolId }) {
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
  return (
    <header ref={header} className="tool-topbar expanded-tools">
      <Link className="tool-brand" href="/tools/start/" aria-label="KITS 도구 메인으로" aria-current={active === "start" ? "page" : undefined} onClick={close}>
        <span className="tool-brand-icon"><Layers3 size={20} /></span>
        KITS
        <span className="tool-brand-divider" />
        <span className="tool-brand-caption">Tools · 맞춤 진단</span>
      </Link>
      <nav id="tools-navigation" aria-label="도구 메뉴" className={open ? "tool-nav open" : "tool-nav"}>
        {["profit", "keywords"].map((id) => {
          const tool = toolLinks.find((item) => item.id === id)!;
          return (
            <Link
              key={tool.id}
              href={tool.href}
              aria-current={active === tool.id ? "page" : undefined}
              onClick={close}
            >
              <MenuMotion kind={tool.id === "profit" ? "profit" : "keywords"} />
              <span className="tool-nav-label">{tool.id === "keywords" ? "키워드 도구" : tool.label}</span>
            </Link>
          );
        })}
        {groups.map((item) => (
          <div key={item.id} className="tool-nav-group">
            <button
              ref={(element) => { groupButtons.current[item.id] = element; }}
              type="button"
              aria-expanded={group === item.id}
              aria-controls={`tool-group-${item.id}`}
              data-active={item.ids.some((id) => id === active) || undefined}
              onClick={() => setGroup(group === item.id ? null : item.id)}
            >
              <MenuMotion kind={item.id} />
              <span className="tool-nav-label">{item.label}</span>
              <ChevronDown className="tool-nav-chevron" size={14} aria-hidden="true" />
            </button>
            <div id={`tool-group-${item.id}`} className="tool-subnav" hidden={group !== item.id}>
              {toolLinks.filter((tool) => item.ids.some((id) => id === tool.id)).map((tool) => (
                <Link
                  key={tool.id}
                  href={tool.href}
                  aria-current={active === tool.id ? "page" : undefined}
                  onClick={close}
                >
                  {tool.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <span className="tool-demo-pill"><span />KITS TOOLS</span>
      <button className="tool-mobile-menu" type="button" aria-label={open ? "메뉴 닫기" : "메뉴 열기"}
        aria-expanded={open} aria-controls="tools-navigation" onClick={() => { setOpen(!open); setGroup(null); }}>
        <span className="tool-menu-toggle" aria-hidden="true"><span /><span /><span /></span>
      </button>
    </header>
  );
}
