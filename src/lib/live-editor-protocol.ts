import { isPreviewSession } from './layout-preview';

export const LIVE_EDITOR_PROTOCOL = 'kitsnode-live-editor-v1';

/** Authenticates the parent window before any live-editor command is considered. */
export function trustedLiveEditorMessage(event: Pick<MessageEvent, 'origin' | 'source' | 'data'>, parent: unknown, self: unknown, session: unknown, origins: readonly string[]) {
  const m = event.data;
  return isPreviewSession(session) && parent !== self && !!parent && event.source === parent && origins.includes(event.origin)
    && !!m && typeof m === 'object' && !Array.isArray(m) && m.protocol === LIVE_EDITOR_PROTOCOL && m.session === session;
}

/** A selector is never allowed to choose the first of multiple matching nodes. */
export function resolveSingleLiveEditorElement(doc: Pick<Document, 'querySelectorAll'>, selector: unknown): HTMLElement | null {
  if (typeof selector !== 'string' || selector.length > 2000 || !selector.startsWith('body')) return null;
  try { const matches = doc.querySelectorAll<HTMLElement>(selector); return matches.length === 1 ? matches[0] : null; }
  catch { return null; }
}
