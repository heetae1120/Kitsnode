"use client";

import type { PointerEvent, ReactNode } from "react";

const targets = ".mp-field, .mp-name, .mp-target-input, .hc-field, .kw-search-field, .tool-subnav a, .kr-tabs button, .kw-segmented button, .store-sidebar nav a";

/** One delegated effect for the existing forms; it never changes their values. */
export function LiquidSurfaces({ children }: { children: ReactNode }) {
  function surface(event: PointerEvent<HTMLDivElement>) {
    return event.target instanceof Element ? event.target.closest<HTMLElement>(targets) : null;
  }
  function point(event: PointerEvent<HTMLDivElement>) {
    const element = surface(event);
    if (!element) return;
    const bounds = element.getBoundingClientRect();
    element.style.setProperty("--liquid-x", `${event.clientX - bounds.left}px`);
    element.style.setProperty("--liquid-y", `${event.clientY - bounds.top}px`);
  }
  function pulse(event: PointerEvent<HTMLDivElement>) {
    const element = surface(event);
    if (!element || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    element.animate([
      { boxShadow: "0 0 0 0 rgba(73,163,240,.24)" },
      { boxShadow: "0 0 0 8px rgba(73,163,240,0)" },
    ], { duration: 550, easing: "ease-out" });
  }
  return <div className="liquid-surfaces" onPointerMove={point} onPointerDown={pulse}>{children}</div>;
}
