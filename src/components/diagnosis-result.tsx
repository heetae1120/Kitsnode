import {diagnosisOutcome} from '@/lib/diagnosis-outcome';
import type {DiagnosisDocument} from '@/lib/diagnosis-document';
const money=(v:number)=>`${Math.round(v).toLocaleString('ko-KR')}원`;
export function DiagnosisResult({report}:{report:Pick<DiagnosisDocument,'quantity'|'months'|'sales'|'costs'|'profit'|'marketing'|'analysis'>}){
 const o=diagnosisOutcome(report),rows=[{label:'계획 판매금액',value:report.sales,kind:'sales'},{label:'입력한 판매 비용',value:report.costs,kind:'costs'},...(o.adBudget!==null?[{label:'가정한 검색광고비',value:o.adBudget,kind:'ads'},{label:'광고 후 손익 · 계산상',value:o.afterProfit!,kind:o.status}]:[])];
 const scale=Math.max(1,...rows.map(r=>Math.abs(r.value)));
 return <section className="ds-diagnosis-result" data-outcome={o.status} aria-label="네이버 기준 종합 진단">
  <span className="ds-result-eyebrow">DIAGNOSIS / 먼저 보는 결과</span>
  <h2>{o.headline.split('\n').map((line,i)=><span key={line} className={i===1?'ds-outcome-word':undefined}>{line}</span>)}</h2>
  <p className="ds-outcome-summary">{o.summary}</p>
  {o.afterProfit!==null&&<div className="ds-outcome-metrics"><div><span>광고 후 전체 손익 · 계산상</span><strong>{money(o.afterProfit)}</strong></div><div><span>한 개당 남는 금액 · 계산상</span><strong>{money(o.perUnit!)}</strong></div></div>}
  <figure className="ds-outcome-chart"><figcaption>판매금액과 비용을 나란히 보면</figcaption>{rows.map(row=><div className="ds-outcome-bar" data-kind={row.kind} key={row.kind}><div><span>{row.label}</span><b>{money(row.value)}</b></div><div className="ds-bar-track" aria-hidden="true"><i style={{width:Math.abs(row.value)/scale*100+'%'}}/></div></div>)}<small>막대 길이는 금액의 크기를 나타내요. 손익의 +/−는 금액과 색상으로 구분해요.</small></figure>
  {o.scenarios.length>0&&<div className="ds-outcome-scenarios"><h3>클릭 비용이 달라진다면?</h3><p>구매 비율과 판매수량을 그대로 두고 CPC만 바꾼 참고 계산이에요.</p><div>{o.scenarios.map(s=><div key={s.label} data-negative={s.profit<=0}><span>{s.label}</span><b>{money(s.profit)}</b></div>)}</div></div>}
  <div className="ds-outcome-next"><h3>{o.status==='positive'?'플러스 여유를 실제로 확인하는 순서':o.status==='negative'?'마이너스 가능성을 줄이기 위한 점검':'판단을 위해 먼저 확인할 것'}</h3><ol>{o.actions.map(a=><li key={a}>{a}</li>)}</ol></div>
  <details className="ds-outcome-conditions"><summary>판단에 사용한 조건과 자료</summary><ul>{o.conditions.map(c=><li key={c}>{c}</li>)}</ul></details>
 </section>;
}
