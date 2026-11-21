// Display only: a trusted server must authorize and supply the response.
// This component does not fetch, store, or modify advertising data.
const metrics = [
  ['impressions', '노출수', '회'],
  ['clicks', '클릭수', '회'],
  ['cost', '광고비', '원'],
  ['clickThroughRate', '클릭률', '%'],
  ['averageClickCost', '평균 CPC', '원'],
] as const;

function metric(value: unknown, unit: string) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return '자료 없음';
  return `${new Intl.NumberFormat('ko-KR', {maximumFractionDigits: 2}).format(value)}${unit}`;
}
function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function AdPerformanceResult({result}: {result: unknown}) {
  const data = result && typeof result === 'object' ? result as Record<string, unknown> : {};
  const period = data.period && typeof data.period === 'object' ? data.period as Record<string, unknown> : {};
  const timesValid = typeof data.observedAt === 'string' && Number.isFinite(Date.parse(data.observedAt));
  const valid = data.source === 'naver_stats' && validDate(period.since) && validDate(period.until) && period.since <= period.until && timesValid;
  const observed = valid && data.status === 'observed' && data.metrics && typeof data.metrics === 'object' && !Array.isArray(data.metrics);
  const values = observed ? data.metrics as Record<string, unknown> : {};
  const noData = valid && data.status === 'no_data' && data.reason === 'empty_response';
  return <section className="ad-performance-result" aria-label="광고 성과 조회 결과" role="status">
    <h3>광고 성과 조회 결과</h3>
    {!observed && !noData ? <p>광고 성과를 확인하지 못했습니다.</p> : <>
      <p>조회 기간: {period.since as string} ~ {period.until as string}</p>
      <p>조회 시각: <time dateTime={data.observedAt as string}>{new Date(data.observedAt as string).toLocaleString('ko-KR', {timeZone:'Asia/Seoul'})} (한국 시간)</time></p>
      {noData ? <p>조회 기간에 반환된 통계가 없습니다.</p> : <dl className="store-metrics ad-performance-metrics">{metrics.map(([key, label, unit]) => <div key={key}><dt>{label}</dt><dd>{metric(values[key], unit)}</dd></div>)}</dl>}
      {observed && typeof values.impressions === 'number' && Number.isFinite(values.impressions) && values.impressions >= 0 && typeof values.clicks === 'number' && Number.isFinite(values.clicks) && values.clicks >= 0 && <div className="ad-performance-chart" aria-label="노출수와 클릭수 비교"><h4>노출과 클릭</h4><p>선택한 기간의 합계입니다.</p>{(['impressions','clicks'] as const).map(key=>{const value=values[key] as number, max=Math.max(values.impressions as number,values.clicks as number);return <div key={key}><span>{key==='impressions'?'노출수':'클릭수'}: {metric(value,'회')}</span><div aria-hidden="true" style={{height:8,background:'#3a3a3a',borderRadius:4,overflow:'hidden'}}><div style={{height:'100%',width:`${max===0?0:value/max*100}%`,background:key==='impressions'?'#ff7746':'#d9b59f'}}/></div></div>;})}</div>}
      <p>네이버 통계는 반영이 지연될 수 있습니다.</p>
    </>}
  </section>;
}
