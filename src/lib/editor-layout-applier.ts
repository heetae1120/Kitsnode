import { getEditableTextNode, orderedLayoutEntries, type LayoutChanges, type LayoutPatch } from './layout-edits';

type StyleState = { value: string; priority: string; applied: string; requested: string };
type Applied = {
  patch: LayoutPatch;
  styles: Map<string, StyleState>;
  text?: { node: Text; value: string; applied: string };
};
const styleKeys = ['color', 'backgroundColor', 'fontSize', 'padding', 'width', 'left', 'top', 'order'] as const;
const cssName = (key: string) => key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
const samePatch = (a: LayoutPatch, b: LayoutPatch) => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].every((key) => a[key as keyof LayoutPatch] === b[key as keyof LayoutPatch]);
};

/** Restores patches when stage selectors stop matching without replacing React DOM. */
export function createEditorLayoutApplier(doc: Document, page: string) {
  const applied = new Map<HTMLElement, Applied>();
  let remembered = new WeakMap<HTMLElement, Applied>();
  const remember = (el: HTMLElement) => {
    const styles = new Map<string, StyleState>();
    for (const key of [...styleKeys.map(cssName), 'position', 'display']) styles.set(key, { value: el.style.getPropertyValue(key), priority: el.style.getPropertyPriority(key), applied: el.style.getPropertyValue(key), requested: '' });
    const node = getEditableTextNode(el);
    remembered.set(el, { patch: {}, styles, ...(node ? { text: { node, value: node.data, applied: node.data } } : {}) });
  };
  const restore = (el: HTMLElement, record: Applied) => {
    for (const [key, state] of record.styles) {
      if (el.style.getPropertyValue(key) !== state.applied || el.style.getPropertyPriority(key) !== '') continue;
      if (state.value) el.style.setProperty(key, state.value, state.priority);
      else el.style.removeProperty(key);
    }
    const text = record.text;
    if (text && text.node.parentNode === el && text.node.data === text.applied && text.node.data !== text.value) text.node.data = text.value;
  };
  return {
    remember,
    apply(changes: LayoutChanges) {
      const desired = new Map<HTMLElement, LayoutPatch>();
      for (const [selector, patch] of orderedLayoutEntries(changes[page] || {})) {
        try {
          const el = doc.querySelector<HTMLElement>(selector);
          if (el) desired.set(el, { ...desired.get(el), ...patch });
        } catch { /* Older invalid selectors remain harmless. */ }
      }
      for (const [el, record] of applied) {
        const patch = desired.get(el);
        if (!patch) {
          restore(el, record);
          applied.delete(el);
        } else if (!samePatch(record.patch, patch)) {
          // Inline editing commits its DOM value before committing the patch.
          // Keep the original text baseline when that value is the new patch.
          const text = record.text;
          if (text && text.node.parentNode === el && patch.text !== undefined && text.node.data === patch.text) text.applied = text.node.data;
          const retained = new Set(styleKeys.filter((key) => patch[key] !== undefined).map(cssName));
          if (patch.left || patch.top) retained.add('position');
          if (patch.hidden) retained.add('display');
          const removed: Applied = { patch: {}, styles: new Map([...record.styles].filter(([key]) => !retained.has(key))) };
          if (patch.text === undefined) removed.text = record.text;
          restore(el, removed);
          for (const key of removed.styles.keys()) record.styles.delete(key);
          if (patch.text === undefined) delete record.text;
          record.patch = { ...patch };
        }
      }
      for (const [el, patch] of desired) {
        let record = applied.get(el);
        if (!record) {
          const original = remembered.get(el);
          const node = patch.text !== undefined ? getEditableTextNode(el) : null;
          record = { patch: { ...patch }, styles: new Map() };
          if (node && original?.text?.node === node) record.text = { node, value: original.text.value, applied: node.data };
          const keys = styleKeys.filter((key) => patch[key] !== undefined).map(cssName);
          if (patch.left || patch.top) keys.push('position');
          if (patch.hidden) keys.push('display');
          for (const key of keys) {
            const state = original?.styles.get(key);
            if (state) record.styles.set(key, { ...state, applied: el.style.getPropertyValue(key), requested: '\0' });
          }
          applied.set(el, record);
        }
        const styles = new Map<string, string>();
        for (const key of styleKeys) if (patch[key] !== undefined) styles.set(cssName(key), patch[key] || '');
        if (patch.left || patch.top) styles.set('position', 'relative');
        if (patch.hidden) styles.set('display', 'none');
        for (const [key, value] of styles) {
          const current = el.style.getPropertyValue(key), priority = el.style.getPropertyPriority(key);
          let state = record.styles.get(key);
          if (!state) {
            const beforeEdit = remembered.get(el)?.styles.get(key);
            if (beforeEdit) {
              state = { ...beforeEdit, applied: current, requested: '\0' };
              record.styles.set(key, state);
            }
          }
          // React may have updated the same element while a patch remained active.
          const externallyChanged = !!state && (current !== state.applied || priority !== '');
          const needsApply = !state || externallyChanged || state.requested !== value;
          if (!state || (externallyChanged && current !== value)) {
            state = { value: current, priority, applied: current, requested: value };
            record.styles.set(key, state);
          }
          if (needsApply && (current !== value || priority !== '')) {
            if (value) el.style.setProperty(key, value); else el.style.removeProperty(key);
          }
          state!.applied = el.style.getPropertyValue(key);
          state!.requested = value;
        }
        if (patch.text !== undefined) {
          const node = getEditableTextNode(el);
          if (node) {
            if (!record.text) {
              const beforeEdit = remembered.get(el)?.text;
              record.text = { node, value: beforeEdit?.node === node ? beforeEdit.value : node.data, applied: node.data };
            } else if (record.text.node !== node || node.data !== record.text.applied) record.text = { node, value: node.data, applied: node.data };
            if (node.data !== patch.text) node.data = patch.text;
            record.text.applied = node.data;
          }
        }
        remembered.delete(el);
      }
    },
    dispose() {
      for (const [el, record] of applied) restore(el, record);
      applied.clear();
      remembered = new WeakMap();
    },
  };
}
