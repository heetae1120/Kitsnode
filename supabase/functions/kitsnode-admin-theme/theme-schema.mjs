// Keep the admin copy byte-identical. Only scoped --admin-* variables are emitted.
export const THEME_COLORS = [
  {
    "key": "canvas",
    "label": "canvas",
    "defaultValue": "#f6f7f9"
  },
  {
    "key": "rail",
    "label": "rail",
    "defaultValue": "#f2f4f7"
  },
  {
    "key": "selected",
    "label": "selected",
    "defaultValue": "#eaecef"
  },
  {
    "key": "surface",
    "label": "surface",
    "defaultValue": "#ffffff"
  },
  {
    "key": "surface-subtle",
    "label": "surface-subtle",
    "defaultValue": "#f2f4f6"
  },
  {
    "key": "text",
    "label": "text",
    "defaultValue": "#191f28"
  },
  {
    "key": "text-secondary",
    "label": "text-secondary",
    "defaultValue": "#4e5968"
  },
  {
    "key": "text-muted",
    "label": "text-muted",
    "defaultValue": "#626d7b"
  },
  {
    "key": "border",
    "label": "border",
    "defaultValue": "#d1d6db"
  },
  {
    "key": "control-border",
    "label": "control-border",
    "defaultValue": "#89939f"
  },
  {
    "key": "divider",
    "label": "divider",
    "defaultValue": "#e5e8eb"
  },
  {
    "key": "primary",
    "label": "primary",
    "defaultValue": "#216ee4"
  },
  {
    "key": "primary-hover",
    "label": "primary-hover",
    "defaultValue": "#1b60c9"
  },
  {
    "key": "primary-soft",
    "label": "primary-soft",
    "defaultValue": "#eaf2ff"
  },
  {
    "key": "success",
    "label": "success",
    "defaultValue": "#16794a"
  },
  {
    "key": "success-soft",
    "label": "success-soft",
    "defaultValue": "#edf8f2"
  },
  {
    "key": "warning",
    "label": "warning",
    "defaultValue": "#8a5a00"
  },
  {
    "key": "warning-soft",
    "label": "warning-soft",
    "defaultValue": "#fff5db"
  },
  {
    "key": "danger",
    "label": "danger",
    "defaultValue": "#c43131"
  },
  {
    "key": "danger-soft",
    "label": "danger-soft",
    "defaultValue": "#fff0f0"
  },
  {
    "key": "focus",
    "label": "focus",
    "defaultValue": "#216ee4"
  },
  {
    "key": "caption-color",
    "label": "caption-color",
    "defaultValue": "#68717b"
  },
  {
    "key": "description-color",
    "label": "description-color",
    "defaultValue": "#4f5158"
  }
];
export const THEME_NUMBERS = [
  {
    "key": "text-xs",
    "label": "text-xs",
    "defaultValue": 12,
    "min": 10,
    "max": 24,
    "unit": "px"
  },
  {
    "key": "text-sm",
    "label": "text-sm",
    "defaultValue": 13,
    "min": 10,
    "max": 28,
    "unit": "px"
  },
  {
    "key": "text-md",
    "label": "text-md",
    "defaultValue": 14,
    "min": 10,
    "max": 32,
    "unit": "px"
  },
  {
    "key": "text-base",
    "label": "text-base",
    "defaultValue": 16,
    "min": 10,
    "max": 32,
    "unit": "px"
  },
  {
    "key": "text-description",
    "label": "text-description",
    "defaultValue": 18,
    "min": 10,
    "max": 36,
    "unit": "px"
  },
  {
    "key": "text-lg",
    "label": "text-lg",
    "defaultValue": 17,
    "min": 12,
    "max": 40,
    "unit": "px"
  },
  {
    "key": "text-xl",
    "label": "text-xl",
    "defaultValue": 20,
    "min": 12,
    "max": 48,
    "unit": "px"
  },
  {
    "key": "text-2xl",
    "label": "text-2xl",
    "defaultValue": 24,
    "min": 14,
    "max": 56,
    "unit": "px"
  },
  {
    "key": "text-3xl",
    "label": "text-3xl",
    "defaultValue": 30,
    "min": 16,
    "max": 64,
    "unit": "px"
  },
  {
    "key": "caption-leading",
    "label": "caption-leading",
    "defaultValue": 22.4,
    "min": 12,
    "max": 64,
    "unit": "px"
  },
  {
    "key": "description-leading",
    "label": "description-leading",
    "defaultValue": 28,
    "min": 12,
    "max": 72,
    "unit": "px"
  },
  {
    "key": "weight-regular",
    "label": "weight-regular",
    "defaultValue": 400,
    "min": 100,
    "max": 900,
    "unit": ""
  },
  {
    "key": "weight-medium",
    "label": "weight-medium",
    "defaultValue": 500,
    "min": 100,
    "max": 900,
    "unit": ""
  },
  {
    "key": "weight-semibold",
    "label": "weight-semibold",
    "defaultValue": 600,
    "min": 100,
    "max": 900,
    "unit": ""
  },
  {
    "key": "weight-bold",
    "label": "weight-bold",
    "defaultValue": 700,
    "min": 100,
    "max": 900,
    "unit": ""
  },
  {
    "key": "leading-tight",
    "label": "leading-tight",
    "defaultValue": 1.35,
    "min": 1,
    "max": 2.5,
    "unit": ""
  },
  {
    "key": "leading-body",
    "label": "leading-body",
    "defaultValue": 1.6,
    "min": 1,
    "max": 3,
    "unit": ""
  }
];
for (const spec of [...THEME_COLORS,...THEME_NUMBERS]) Object.freeze(spec);
Object.freeze(THEME_COLORS); Object.freeze(THEME_NUMBERS);
export const DEFAULT_THEME = Object.freeze({font:'pretendard',tokens:Object.freeze({})});
const colors = new Set(THEME_COLORS.map(x=>x.key));
const numbers = new Map(THEME_NUMBERS.map(x=>[x.key,x]));
const object = value => !!value && typeof value === 'object' && !Array.isArray(value) && [Object.prototype,null].includes(Object.getPrototypeOf(value));
export function validateTheme(value) {
  if (!object(value) || Object.keys(value).length !== 2 || !Object.hasOwn(value,'font') || !Object.hasOwn(value,'tokens') || !['pretendard','system'].includes(value.font) || !object(value.tokens)) return false;
  return Object.entries(value.tokens).every(([key,val]) => {
    if (colors.has(key)) return typeof val === 'string' && /^#[0-9a-fA-F]{6}$/.exec(val)?.[0] === val;
    const spec = numbers.get(key);
    return !!spec && typeof val === 'number' && Number.isFinite(val) && val >= spec.min && val <= spec.max && (!key.startsWith('weight-') || (Number.isInteger(val) && val % 100 === 0));
  });
}
export function resolveThemeValues(theme) {
  if (!validateTheme(theme)) throw new TypeError('Invalid admin theme');
  return {...Object.fromEntries([...THEME_COLORS,...THEME_NUMBERS].map(x=>[x.key,x.defaultValue])),...theme.tokens};
}
export function themeToVariables(theme) {
  const values = resolveThemeValues(theme);
  const system = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  return {'--admin-font':theme.font === 'pretendard' ? `var(--font-pretendard), ${system}` : system,
    ...Object.fromEntries(Object.entries(values).map(([key,value])=>[`--admin-${key}`,`${value}${numbers.get(key)?.unit || ''}`]))};
}
// Format validation remains independent so unsafe drafts can be previewed and corrected.
export function contrastIssues(theme) {
  const values = resolveThemeValues(theme);
  const luminance = hex => {
    const rgb = [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(c=>c <= 0.04045 ? c/12.92 : ((c+0.055)/1.055)**2.4);
    return rgb[0]*0.2126 + rgb[1]*0.7152 + rgb[2]*0.0722;
  };
  const issues = [];
  const check = (foreground,background,minimum) => {
    const a=luminance(values[foreground] || foreground), b=luminance(values[background] || background);
    if ((Math.max(a,b)+0.05)/(Math.min(a,b)+0.05) < minimum) issues.push(`${foreground}/${background}: contrast must be at least ${minimum}:1`);
  };
  for (const text of ['text','text-secondary','text-muted','caption-color','description-color']) for (const background of ['surface','canvas']) check(text,background,4.5);
  check('#ffffff','primary',4.5); check('#ffffff','primary-hover',4.5);
  check('control-border','surface',3);
  for (const text of ['text','text-secondary','text-muted']) check(text,'surface-subtle',4.5);
  check('text','selected',4.5); check('primary-hover','primary-soft',4.5);
  check('focus','surface',3); check('focus','canvas',3);
  for (const state of ['success','warning','danger']) check(state,`${state}-soft`,4.5);
  if (values['caption-leading'] < values['text-md']) issues.push('caption-leading must be at least text-md');
  if (values['description-leading'] < values['text-description']) issues.push('description-leading must be at least text-description');
  return issues;
}
