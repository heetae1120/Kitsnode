export type LayoutPatch = { text?: string; color?: string; backgroundColor?: string; fontSize?: string; padding?: string; width?: string; left?: string; top?: string; order?: string; hidden?: boolean };
export type LayoutChanges = Record<string, Record<string, LayoutPatch>>;

export function applyLayoutPatch(el: HTMLElement, patch: LayoutPatch) {
  if (patch.text !== undefined && el.children.length === 0 && el.textContent !== patch.text) el.textContent = patch.text;
  for (const key of ["color", "backgroundColor", "fontSize", "padding", "width", "left", "top", "order"] as const) {
    if (patch[key] !== undefined && el.style[key] !== (patch[key] || "")) el.style[key] = patch[key] || "";
  }
  if ((patch.left || patch.top) && el.style.position !== "relative") el.style.position = "relative";
  if (patch.hidden && el.style.display !== "none") el.style.display = "none";
}
export function applyPageLayout(doc: Document, changes: LayoutChanges, page: string) {
  for (const [selector, patch] of Object.entries(changes[page] || {})) {
    try {
      const el = doc.querySelector<HTMLElement>(selector);
      if (el) applyLayoutPatch(el, patch);
    } catch { /* Ignore selectors from an incompatible older layout. */ }
  }
}
