export type LayoutPatch = { text?: string; color?: string; backgroundColor?: string; fontSize?: string; padding?: string; width?: string; left?: string; top?: string; order?: string; hidden?: boolean };
export type LayoutChanges = Record<string, Record<string, LayoutPatch>>;

/** Common-section selectors have explicit priority, independent of JSONB key order. */
export function isCommonLayoutSelector(selector: string): boolean {
  return ['body .tool-topbar', 'body .mp-live-bar'].some((prefix) => selector === prefix || selector.startsWith(`${prefix} > `));
}

export function orderedLayoutEntries(patches: Record<string, LayoutPatch>): [string, LayoutPatch][] {
  const entries = Object.entries(patches);
  return [...entries.filter(([selector]) => !isCommonLayoutSelector(selector)), ...entries.filter(([selector]) => isCommonLayoutSelector(selector))];
}

// A patch targets one direct text node, never replaces descendant markup.
// Do not use instanceof: editor targets may belong to another iframe realm.
const NON_TEXT_ELEMENTS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'INPUT', 'TEXTAREA', 'SELECT', 'OPTION', 'OPTGROUP', 'IFRAME', 'OBJECT', 'EMBED', 'CANVAS', 'AUDIO', 'VIDEO', 'IMG', 'BR', 'HR', 'META', 'LINK', 'BASE', 'HEAD', 'HTML', 'BODY']);
export function getEditableTextNode(el: HTMLElement): Text | null {
  if (el.namespaceURI !== 'http://www.w3.org/1999/xhtml' || NON_TEXT_ELEMENTS.has(el.tagName.toUpperCase())) return null;
  const nodes = Array.from(el.childNodes).filter((node): node is Text => node.nodeType === 3);
  if (nodes.length === 1) return nodes[0];
  if (nodes.length === 0 && el.childNodes.length === 0) {
    const node = el.ownerDocument.createTextNode('');
    el.appendChild(node);
    return node;
  }
  return null;
}

export function applyLayoutPatch(el: HTMLElement, patch: LayoutPatch) {
  if (patch.text !== undefined) {
    const node = getEditableTextNode(el);
    if (node && node.data !== patch.text) node.data = patch.text;
  }
  for (const key of ["color", "backgroundColor", "fontSize", "padding", "width", "left", "top", "order"] as const) {
    if (patch[key] !== undefined && el.style[key] !== (patch[key] || "")) el.style[key] = patch[key] || "";
  }
  if ((patch.left || patch.top) && el.style.position !== "relative") el.style.position = "relative";
  if (patch.hidden && el.style.display !== "none") el.style.display = "none";
}
export function applyPageLayout(doc: Document, changes: LayoutChanges, page: string) {
  const desired = new Map<HTMLElement, LayoutPatch>();
  for (const [selector, patch] of orderedLayoutEntries(changes[page] || {})) {
    try {
      const el = doc.querySelector<HTMLElement>(selector);
      if (el) desired.set(el, { ...desired.get(el), ...patch });
    } catch { /* Ignore selectors from an incompatible older layout. */ }
  }
  // Merge first so explicit false cancels an earlier hidden:true before mutation.
  for (const [el, patch] of desired) applyLayoutPatch(el, patch);
}
