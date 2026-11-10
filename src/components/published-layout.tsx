"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import published from "@/data/published-layout.json";
import type { LayoutChanges } from "@/lib/layout-edits";
import { isAuthLayoutPage } from "@/lib/layout-edits";
import { createEditorLayoutApplier } from "@/lib/editor-layout-applier";
import { FAST_LAYOUT_CACHE, FAST_LAYOUT_URL, isLayoutChanges } from "@/lib/fast-layout";

export function PublishedLayout() {
  const pathname = usePathname();
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    if (query.has("kits_editor") || query.has("kits_preview")) return;
    const page = pathname.endsWith("/") ? pathname : `${pathname}/`;
    if (!page.startsWith('/tools/') && !isAuthLayoutPage(page)) return;
    let current: LayoutChanges = published as LayoutChanges;
    let cancelled = false, pending = false;
    const applier = createEditorLayoutApplier(document, page);
    const apply = () => {
      pending = false;
      if (!cancelled) applier.apply(current);
    };
    try { const stored = JSON.parse(localStorage.getItem(FAST_LAYOUT_CACHE) || 'null'); if (isLayoutChanges(stored)) current = stored; } catch { /* use bundled fallback */ }
    const observer = new MutationObserver(() => { if (!cancelled && !pending) { pending = true; queueMicrotask(() => { if (!cancelled) apply(); }); } });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    apply();
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 5000);
    void fetch(`${FAST_LAYOUT_URL}?resource=published`, { cache: 'no-store', signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error('unavailable'); return response.json(); })
      .then((data: unknown) => {
        if (cancelled || !data || typeof data !== 'object' || !('changes' in data) || !isLayoutChanges(data.changes)) return;
        try { localStorage.setItem(FAST_LAYOUT_CACHE, JSON.stringify(data.changes)); } catch { /* current page still updates */ }
        if (JSON.stringify(current) !== JSON.stringify(data.changes)) { applier.dispose(); current = data.changes; apply(); }
      }).catch(() => { /* use the last valid configuration or bundled fallback */ }).finally(() => window.clearTimeout(timer));
    return () => { cancelled = true; window.clearTimeout(timer); controller.abort(); observer.disconnect(); applier.dispose(); };
  }, [pathname]);
  return null;
}
