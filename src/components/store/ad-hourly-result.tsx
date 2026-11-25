import type {HourlyResult,HourlyRow} from '@/lib/ad-performance-client.mjs';

const number=(value:number|null,unit:string)=>value===null?'—':`${new Intl.NumberFormat('ko-KR',{maximumFractionDigits:2}).format(value)}${unit}`;
function total(rows:HourlyRow[],key:'impressions'|'clicks'|'cost'|'purchases'|'revenue'){
 if(!rows.length||rows.some(row=>row[key]===null))return null;
 return rows.reduce((sum,row)=>sum+(row[key]??0),0);
}
export function AdHourlyResult({result,start,end}:{result:HourlyResult;start:number;end:number}){
 if(result.status==='unavailable')return <section role="status"><h3>시간대별 성과</h3><p>시간대별 성과를 확인하지 못했습니다. 조회 기간과 연결 상태를 확인해 주세요.</p></section>;
 if(result.status==='no_data')return <section role="status"><h3>시간대별 성과</h3><p>해당 날짜에 반환된 시간대별 통계가 없습니다.</p></section>;
 const rows=result.hours.filter(row=>row.hour>=start&&row.hour<end).sort((a,b)=>a.hour-b.hour);
 const views=total(rows,'impressions'),clicks=total(rows,'clicks'),cost=total(rows,'cost'),purchases=total(rows,'purchases'),revenue=total(rows,'revenue');
 const cpc=clicks!==null&&clicks>0&&cost!==null?cost/clicks:null;
 return <section className="ad-performance-result" aria-label="시간대별 성과 결과" role="status"><h3>시간대별 성과</h3><p>{result.day} · {start}:00~{end}:00 (한국 시간)</p>
 {rows.length===0?<p>선택한 시간에 반환된 통계가 없습니다.</p>:<>
 <dl className="store-metrics ad-performance-metrics"><div><dt>노출수</dt><dd>{number(views,'회')}</dd></div><div><dt>클릭수</dt><dd>{number(clicks,'회')}</dd></div><div><dt>광고비</dt><dd>{number(cost,'원')}</dd></div><div><dt>평균 CPC</dt><dd>{number(cpc,'원')}</dd></div><div><dt>구매 전환</dt><dd>{number(purchases,'건')}</dd></div><div><dt>구매 전환매출</dt><dd>{number(revenue,'원')}</dd></div></dl>
 <div className="store-table-scroll" role="region" aria-label="시간대별 성과 표" tabIndex={0}><table><thead><tr><th scope="col">시간</th><th scope="col">노출</th><th scope="col">클릭</th><th scope="col">광고비</th><th scope="col">평균 CPC</th><th scope="col">구매 전환</th><th scope="col">구매 전환매출</th></tr></thead><tbody>{rows.map(row=><tr key={row.hour}><th scope="row">{row.hour}:00~{row.hour+1}:00</th><td>{number(row.impressions,'회')}</td><td>{number(row.clicks,'회')}</td><td>{number(row.cost,'원')}</td><td>{number(row.averageCpc,'원')}</td><td>{number(row.purchases,'건')}</td><td>{number(row.revenue,'원')}</td></tr>)}</tbody></table></div>
 <p>합계는 반환된 시간대의 합계입니다. {rows.length<end-start?'선택한 구간 중 반환되지 않은 시간대가 있습니다.':''} 클릭이 없거나 지표가 없으면 —로 표시합니다.</p>
 </>}<p>네이버 통계는 반영이 지연될 수 있습니다. 시간대별 표시 금액의 합과 기간 합계에 차이가 있을 수 있습니다.</p></section>;
}
