const KEY = 'kitsnode-login-return-v1';
const MAX_AGE = 30 * 60 * 1000;
export function validMemberReturn(path: unknown, basePath = ''): path is string {
  if (typeof path !== 'string' || path.length > 1000 || !path.startsWith('/') || path.startsWith('//') || /[\\?#\u0000-\u001f]/.test(path)) return false;
  let normalized: string;
  try { normalized = new URL(path, 'https://return.invalid').pathname; } catch { return false; }
  if (normalized !== path) return false;
  if (basePath && path !== basePath && !path.startsWith(basePath + '/')) return false;
  const relative = path.slice(basePath.length).replace(/\/+$/, '') || '/';
  return relative !== '/store/login' && relative !== '/store/signup';
}
export function saveMemberReturn() {
  try {
    const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
    const path = window.location.pathname;
    if (validMemberReturn(path,base) && !/(?:kits_editor|kits_preview|kits_live_editor)/.test(window.location.search)) sessionStorage.setItem(KEY,JSON.stringify({path,at:Date.now()}));
  } catch { /* Storage can be disabled. */ }
}
export function takeMemberReturn(): string | null {
  try {
    const raw=sessionStorage.getItem(KEY); sessionStorage.removeItem(KEY);
    if (!raw) return null;
    const value=JSON.parse(raw); const age=Date.now()-value.at;
    return Number.isFinite(age) && age >= 0 && age <= MAX_AGE && validMemberReturn(value.path,process.env.NEXT_PUBLIC_BASE_PATH || '') ? value.path : null;
  } catch { return null; }
}
