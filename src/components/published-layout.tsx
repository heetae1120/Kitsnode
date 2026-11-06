"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import published from "@/data/published-layout.json";
import { applyPageLayout, type LayoutChanges } from "@/lib/layout-edits";

export function PublishedLayout() {
  const pathname = usePathname();
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("kits_editor")) return;
    const page = pathname.endsWith("/") ? pathname : `${pathname}/`;
    if (!(page in published)) return;
    let pending = false;
    const apply = () => { pending = false; applyPageLayout(document, published as LayoutChanges, page); };
    const observer = new MutationObserver(() => {
      if (!pending) { pending = true; queueMicrotask(apply); }
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    apply();
    return () => observer.disconnect();
  }, [pathname]);
  return null;
}
