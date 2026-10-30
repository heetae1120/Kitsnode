import { calculate, validateInput, type ProductInput } from './calculator';

export type Goal = { mode: 'profit' | 'rotation'; targetKind: 'orders' | 'revenue'; target: number; days: number; unitProfit: number; lossLimit: number };
export function diagnose(input: ProductInput, goal: Goal) {
  const error = validateInput(input);
  if (error) throw new Error(error);
  if ([goal.target, goal.days, goal.unitProfit, goal.lossLimit].some(n => !Number.isFinite(n) || n < 0) || !Number.isInteger(goal.days) || goal.days < 1 || goal.days > 366 || goal.target <= 0) throw new Error('목표는 0보다 크게, 기간은 1~366일 정수로 입력하세요. 이익과 허용 손실은 0 이상이어야 합니다.');
  if (goal.target > 1e9 || goal.unitProfit > 1e9 || goal.lossLimit > 1e9) throw new Error('목표·이익·허용 손실은 10억 이내로 입력하세요.');
  const r = calculate(input);
  const rate = input.cvrPercent / 100;
  const targetOrders = Math.ceil(goal.targetKind === 'orders' ? goal.target : goal.target / input.price);
  const targetClicks = rate > 0 && input.cpc > 0 ? Math.ceil(targetOrders / rate) : null;
  if(targetClicks!==null && (!Number.isSafeInteger(targetClicks)||!Number.isFinite(targetClicks*input.cpc))) throw new Error('전환율이 너무 작아 목표 예산을 정확하게 계산할 수 없습니다.');
  const requiredSpend = targetClicks === null ? null : targetClicks * input.cpc;
  const allowance = goal.mode === 'profit' ? r.margin - goal.unitProfit : r.margin;
  const maxCpc = rate > 0 ? Math.max(0, allowance * rate) : null;
  const targetRoas = allowance > 0 ? input.price / allowance * 100 : null;
  const feasible = r.unitProfit !== null && (goal.mode === 'profit' ? r.unitProfit >= goal.unitProfit : r.totalProfit >= -goal.lossLimit);
  // A rotation budget may deliberately spend at a loss, but never beyond the user's loss cap.
  const lossPerClick = input.cpc - rate * r.margin;
  const lossCapSpend = lossPerClick > 0 ? Math.floor(goal.lossLimit / lossPerClick) * input.cpc : input.budget;
  const recommendedBudget = goal.mode === 'profit' && !feasible ? 0 : Math.max(0, Math.min(input.budget, requiredSpend ?? 0, goal.mode === 'rotation' ? lossCapSpend : input.budget));
  const recommended = calculate({ ...input, budget: recommendedBudget });
  return { ...r, targetOrders, requiredSpend, budgetGap: requiredSpend === null ? null : input.budget - requiredSpend, dailyBudget: recommendedBudget / goal.days, maxCpc, targetRoas, feasible, recommendedBudget, recommended, conversionAvailable: input.cpc > 0 && rate > 0 };
}

export type MetricRow = { date: string; productId: string; visits?: number; views?: number; orders?: number; revenue?: number; clicks?: number; adSpend?: number; dwellSeconds?: number; gender?: string; age?: string; channel?: string };
export type Dataset = { kind: 'daily' | 'audience' | 'channels' | 'products'; source: string; rows: MetricRow[] };
const aliases: Record<string, keyof MetricRow> = { 날짜:'date', 상품번호:'productId', 방문수:'visits', 조회수:'views', 상품결제건수:'orders', 판매금액:'revenue', 클릭수:'clicks', 광고비:'adSpend', 체류시간초:'dwellSeconds', 성별:'gender', 연령대:'age', 유입경로:'channel' };
const keys = new Set(['date','productId','visits','views','orders','revenue','clicks','adSpend','dwellSeconds','gender','age','channel']);
const textKeys = new Set(['date','productId','gender','age','channel']);
export function csvRows(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], value = '', quoted = false;
  for (let i=0; i<text.length; i++) { const c=text[i];
    if (c==='"') { if (quoted && text[i+1]==='"') {value+='"';i++;} else quoted=!quoted; }
    else if (c===',' && !quoted) {row.push(value);value='';}
    else if ((c==='\n'||c==='\r')&&!quoted) { if(c==='\r'&&text[i+1]==='\n')i++; row.push(value); if(row.some(v=>v.trim()))rows.push(row); row=[];value=''; }
    else value+=c;
  }
  if(quoted)throw new Error('CSV의 따옴표가 닫히지 않았습니다.');
  row.push(value);if(row.some(v=>v.trim()))rows.push(row); return rows;
}
export function parseDataset(text: string, kind: Dataset['kind'], source: string): Dataset {
  if(text.length>2_000_000)throw new Error('2MB 이하 파일을 사용하세요.');
  let records: Record<string, unknown>[];
  if(text.trimStart().startsWith('[')) {const data:unknown=JSON.parse(text); if(!Array.isArray(data))throw new Error('JSON 배열이 필요합니다.');records=data;}
  else {const [header,...rows]=csvRows(text.replace(/^\uFEFF/,''));if(!header)throw new Error('빈 파일입니다.'); const names=header.map(h=>aliases[h.trim()]||h.trim()); if(new Set(names).size!==names.length)throw new Error('중복 열 이름이 있습니다.'); records=rows.map(r=>{if(r.length!==names.length)throw new Error('열 개수가 다른 행이 있습니다.');return Object.fromEntries(names.map((h,i)=>[h,r[i]]));});}
  if(!records.length||records.length>10000)throw new Error('1~10,000행의 통계가 필요합니다.');
  const rows=records.map((record,i)=>{
    if(!record||typeof record!=='object'||Array.isArray(record))throw new Error(`${i+1}행 형식을 확인하세요.`);
    const clean: Record<string,string|number>={};
    for(const [raw,v]of Object.entries(record)) {const key=aliases[raw]||raw;if(!keys.has(key))throw new Error(`지원하지 않는 열: ${raw}. 통계 열만 남기고 고객 개인정보를 제거하세요.`); if(v==null||v==='')continue;
      if(textKeys.has(key)) { if(typeof v!=='string'&&typeof v!=='number')throw new Error('텍스트 열 형식 오류');clean[key]=String(v).slice(0,150); }
      else {const n=typeof v==='number'?v:Number(String(v).replaceAll(',',''));if(!Number.isFinite(n)||n<0||n>1e12)throw new Error(`${i+1}행 ${raw} 값이 유효하지 않습니다.`); if(key!=='dwellSeconds'&&!Number.isInteger(n))throw new Error(`${raw}은 정수여야 합니다.`);clean[key]=n;}
    }
    if(typeof clean.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(clean.date)||new Date(clean.date).toISOString().slice(0,10)!==clean.date)throw new Error(`${i+1}행 날짜는 YYYY-MM-DD 형식이어야 합니다.`);
    if(!clean.productId)throw new Error(`${i+1}행 상품번호가 필요합니다. 스토어 전체는 ALL로 입력하세요.`);
    if(kind==='audience' && (!clean.gender||!clean.age||clean.visits===undefined))throw new Error('고객 통계에는 성별·연령대·방문수가 필요합니다.');
    if(kind==='channels' && (!clean.channel||clean.visits===undefined))throw new Error('경로 통계에는 유입경로·방문수가 필요합니다.');
    if(kind!=='audience'&&(clean.gender!==undefined||clean.age!==undefined))throw new Error('성별·연령별 행은 고객 통계 파일로 분리하세요.');
    if(kind!=='channels'&&clean.channel!==undefined)throw new Error('경로별 행은 유입 경로 파일로 분리하세요.');
    if(!['visits','views','orders','revenue','clicks','adSpend','dwellSeconds'].some(k=>clean[k]!==undefined))throw new Error('수치 지표가 필요합니다.');
    return clean as MetricRow;
  });
  const ids = new Set(rows.map(r=>r.productId));if(ids.has('ALL')&&ids.size>1)throw new Error('전체 합계와 상품별 행을 섞으면 중복 집계됩니다. 별도 파일로 나누세요.');
  const dimensions = kind==='audience'?['gender','age']:kind==='channels'?['channel']:[];
  const unique=rows.map(r=>[r.date,r.productId,...dimensions.map(k=>r[k as keyof MetricRow])].join('|'));
  if(new Set(unique).size!==unique.length)throw new Error('동일 날짜·상품·분류가 중복됩니다. 합계 또는 중복 행을 제거하세요.');
  return {kind,source:source.slice(0,150),rows};
}
export function summarize(rows: MetricRow[]) {
  const sum=(key:keyof MetricRow)=>rows.length>0 && rows.every(r=>typeof r[key]==='number') ? rows.reduce((s,r)=>s+(r[key] as number),0):null;
  const visits=sum('visits'),orders=sum('orders'),clicks=sum('clicks'),spend=sum('adSpend');
  const dwell=rows.every(r=>r.dwellSeconds!==undefined&&r.visits!==undefined)?rows:[];
  const dwellVisits=dwell.reduce((s,r)=>s+(r.visits??0),0);
  return {visits,orders,clicks,spend,revenue:sum('revenue'),views:sum('views'),cvr:visits&&orders!==null?orders/visits*100:null,cpc:clicks&&spend!==null?spend/clicks:null,dwell:dwellVisits?dwell.reduce((s,r)=>s+r.dwellSeconds! * r.visits!,0)/dwellVisits:null,complete:rows.length>0 && rows.every(r=>r.clicks!==undefined&&r.adSpend!==undefined&&r.orders!==undefined)};
}
export const DATA_TEMPLATES: Record<Dataset['kind'],string> = {
  daily:'date,productId,visits,views,orders,revenue,clicks,adSpend,dwellSeconds\n',
  audience:'date,productId,gender,age,visits\n',
  channels:'date,productId,channel,visits,orders,revenue\n',
  products:'date,productId,views,orders,revenue\n',
};
