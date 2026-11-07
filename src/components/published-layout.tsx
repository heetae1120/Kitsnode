"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import published from "@/data/published-layout.json";
import { applyLayoutPatch, type LayoutChanges, type LayoutPatch } from "@/lib/layout-edits";
import { FAST_LAYOUT_CACHE, FAST_LAYOUT_URL, isLayoutChanges } from "@/lib/fast-layout";

type Original = { styles: Map<string, { value: string; priority: string; applied: string }>; text?: { value: string; applied: string } };
const cssName = (key: string) => key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

export function PublishedLayout() {
  const pathname = usePathname();
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("kits_editor")) return;
    const page = pathname.endsWith("/") ? pathname : `${pathname}/`;
    if (!page.startsWith('/tools/')) return;
    let current: LayoutChanges = published as LayoutChanges;
    let cancelled = false, pending = false;
    const originals = new Map<HTMLElement, Original>();
    const restore = () => {
      for (const [el, record] of originals) {
        for (const [key, state] of record.styles) if (el.style.getPropertyValue(key) === state.applied) {
          if (state.value) el.style.setProperty(key, state.value, state.priority); else el.style.removeProperty(key);
        }
        if (record.text && el.children.length === 0 && el.textContent === record.text.applied) el.textContent = record.text.value;
      }
      originals.clear();
    };
    const apply = () => {
      pending = false;
      for (const [selector, patch] of Object.entries(current[page] || {})) {
        let el: HTMLElement | null;
        try { el = document.querySelector<HTMLElement>(selector); } catch { continue; }
        if (!el) continue;
        let record = originals.get(el);
        if (!record) { record = { styles: new Map() }; originals.set(el, record); }
        const keys = (['color','backgroundColor','fontSize','padding','width','left','top','order'] as const).filter((key) => patch[key] !== undefined).map(cssName);
        if (patch.left || patch.top) keys.push('position');
        if (patch.hidden) keys.push('display');
        for (const key of keys) if (!record.styles.has(key)) record.styles.set(key, { value: el.style.getPropertyValue(key), priority: el.style.getPropertyPriority(key), applied: '' });
        if (patch.text !== undefined && el.children.length === 0 && !record.text) record.text = { value: el.textContent || '', applied: '' };
        applyLayoutPatch(el, patch as LayoutPatch);
        for (const key of keys) record.styles.get(key)!.applied = el.style.getPropertyValue(key);
        if (record.text && patch.text !== undefined && el.children.length === 0) record.text.applied = el.textContent || '';
      }
    };
    try { const stored = JSON.parse(localStorage.getItem(FAST_LAYOUT_CACHE) || 'null'); if (isLayoutChanges(stored)) current = stored; } catch { /* use bundled fallback */ }
    const observer = new MutationObserver(() => { if (!pending) { pending = true; queueMicrotask(() => { if (!cancelled) apply(); }); } });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    apply();
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 5000);
    void fetch(`${FAST_LAYOUT_URL}?resource=published`, { cache: 'no-store', signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error('unavailable'); return response.json(); })
      .then((data: unknown) => {
        if (cancelled || !data || typeof data !== 'object' || !('changes' in data) || !isLayoutChanges(data.changes)) return;
        try { localStorage.setItem(FAST_LAYOUT_CACHE, JSON.stringify(data.changes)); } catch { /* current page still updates */ }
        if (JSON.stringify(current) !== JSON.stringify(data.changes)) { restore(); current = data.changes; apply(); }
      }).catch(() => { /* use the last valid configuration or bundled fallback */ }).finally(() => window.clearTimeout(timer));
    return () => { cancelled = true; window.clearTimeout(timer); controller.abort(); observer.disconnect(); restore(); };
  }, [pathname]);
  return null;
}
