import { isAuthLayoutPage, isAuthLayoutSelector, validAuthLayoutPatch, type LayoutChanges } from './layout-edits';

export const FAST_LAYOUT_URL = 'https://mftuybvbieoepemilzyi.supabase.co/functions/v1/kitsnode-layout';
export const FAST_LAYOUT_CACHE = 'kitsnode-published-layout-v1';
const fields = new Set(['text','color','backgroundColor','fontSize','padding','width','left','top','order','hidden']);
export function isLayoutChanges(value: unknown): value is LayoutChanges {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.entries(value).every(([page, entries]) => (page.startsWith('/tools/') || isAuthLayoutPage(page)) && !!entries && typeof entries === 'object' && !Array.isArray(entries) && Object.entries(entries).every(([selector, patch]) => isAuthLayoutPage(page) ? isAuthLayoutSelector(selector) && validAuthLayoutPatch(selector,patch) : selector.startsWith('body') && !!patch && typeof patch === 'object' && !Array.isArray(patch) && Object.entries(patch).every(([key, item]) => fields.has(key) && (key === 'hidden' ? typeof item === 'boolean' : typeof item === 'string'))));
}
