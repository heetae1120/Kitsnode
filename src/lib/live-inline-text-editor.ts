import { getEditableTextNode } from './layout-edits';

export type InlineTextSession = { element: HTMLElement; finish: (cancel?: boolean) => void };

/** Parent snapshots supersede an unfinished inline edit, including during undo. */
export function applyAuthoritativeSnapshot(session: InlineTextSession | null, apply: () => void): void {
  session?.finish(true);
  apply();
}

/** A temporary span edits a single Text node, leaving children and their handlers intact. */
export function beginInlineText(el: HTMLElement, onCommit: (value: string) => void, onEnd: (cancelled: boolean) => void, onDraft?: (value: string) => void): InlineTextSession | null {
  const node = getEditableTextNode(el);
  if (!node) return null;
  const doc = el.ownerDocument;
  const original = node.data;
  const editor = doc.createElement('span');
  editor.contentEditable = 'plaintext-only';
  editor.setAttribute('role', 'textbox');
  editor.setAttribute('aria-label', '텍스트 수정');
  editor.setAttribute('data-kits-inline', '');
  editor.style.cssText = 'display:inline-block;min-width:1ch;min-height:1em;white-space:pre-wrap;outline:2px solid #779e61;cursor:text;user-select:text';
  node.replaceWith(editor);
  editor.appendChild(node);
  let ended = false, composing = false, lastDraft = original;
  const emitDraft = () => {
    if (ended) return;
    const value = (editor.textContent || '').slice(0, 4000);
    if (value === lastDraft) return;
    lastDraft = value;
    onDraft?.(value);
  };
  // Some programmatic text edits do not emit input. Observe only this
  // temporary editor, never other fields or the surrounding page.
  const observer = new MutationObserver(emitDraft);
  observer.observe(editor, { childList: true, subtree: true, characterData: true });
  const finish = (cancel = false) => {
    if (ended) return;
    ended = true;
    observer.disconnect();
    const attached = el.isConnected && editor.parentNode === el;
    const value = (editor.textContent || '').slice(0, 4000);
    node.data = cancel ? original : value;
    if (editor.parentNode === el) editor.replaceWith(node);
    try { if (!cancel && attached && value !== original) onCommit(value); }
    finally { onEnd(cancel || !attached); }
  };
  const insertText = (text: string) => {
    const selection = doc.getSelection();
    if (!selection?.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) return;
    range.deleteContents();
    const inserted = doc.createTextNode(text);
    range.insertNode(inserted); range.setStart(inserted, inserted.length); range.collapse(true);
    selection.removeAllRanges(); selection.addRange(range);
    // Range mutations do not dispatch an input event in all browsers.
    emitDraft();
  };
  editor.addEventListener('compositionstart', () => { composing = true; });
  editor.addEventListener('compositionend', () => { composing = false; });
  editor.addEventListener('input', emitDraft);
  editor.addEventListener('keydown', (event) => {
    event.stopPropagation();
    if (composing || event.isComposing || event.keyCode === 229) return;
    if (event.key === 'Escape') { event.preventDefault(); finish(true); }
    else if (event.key === 'Enter') { event.preventDefault(); if (event.shiftKey) insertText('\n'); else finish(); }
  });
  editor.addEventListener('paste', (event) => {
    event.preventDefault();
    const text = (event.clipboardData?.getData('text/plain') || '').slice(0, 4000);
    insertText(text);
  });
  editor.addEventListener('beforeinput', (event) => { if (!composing && ['insertLineBreak', 'insertParagraph'].includes(event.inputType)) { event.preventDefault(); insertText('\n'); } });
  editor.addEventListener('drop', (event) => event.preventDefault());
  editor.addEventListener('blur', () => finish());
  editor.focus({ preventScroll: true });
  const range = doc.createRange(); range.selectNodeContents(editor);
  const selection = doc.getSelection(); selection?.removeAllRanges(); selection?.addRange(range);
  return { element: el, finish };
}
