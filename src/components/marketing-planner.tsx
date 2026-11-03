"use client";
import { useRef, useState, type FormEvent } from 'react';
import { ArrowRight, Check, FileText, Wallet } from 'lucide-react';
import { ToolsHeader } from './tools-header';
import { FormattedNumberInput } from './formatted-number-input';
import { KeywordBudgetReport } from './keyword-budget-report';
import { marketingPlan, resolvePlanBudget, type MarketingPlanInput } from '@/lib/marketing-plan';
import '@/app/tools/marketing-planner.css';

const basics = [
  ['price','판매가','고객이 실제 결제하는 상품 1개 가격','원 / 개'],
  ['cost','상품 원가','상품 1개를 만들거나 매입하는 비용','원 / 개'],
  ['quantity','판매 계획 수량','이번 계획에서 준비하고 판매할 상품 수','개'],
] as const;
const extras = [
  ['feePercent','플랫폼·결제 수수료','판매가에 부과되는 총 수수료율','%'],
  ['logistics','물류·배송비','상품 1개당 입고·보관·출고·판매자 부담 배송비','원 / 개'],
  ['packaging','포장·기타 판매비','포장재, 사은품 등 1개 팔 때마다 드는 비용','원 / 개'],
  ['returns','반품·교환 예상비','예상 반품·교환 비용을 상품 1개당 나눈 금액','원 / 개'],
  ['certification','인증·검사비','이번 판매 계획 전체에 한 번 반영할 비용','원 / 전체'],
  ['fixed','기타 고정비','촬영, 디자인, 임차료 등 이번 계획에 배분할 비용','원 / 전체'],
] as const;
type Draft = {name:string} & Record<keyof MarketingPlanInput,string>;
const empty:Draft={name:'',available:'',purchaseBudget:'',marketingBudget:'',price:'',cost:'',quantity:'',feePercent:'',logistics:'',packaging:'',returns:'',certification:'',fixed:''};
const money=(v:number)=>`${Math.round(v).toLocaleString('ko-KR')}원`;
export function MarketingPlanner(){
  const [draft,setDraft]=useState<Draft>(empty);
  const [step,setStep]=useState(1);
  const [budgetMode,setBudgetMode]=useState<'split'|'total'>('split');
  const [error,setError]=useState('');
  const [report,setReport]=useState<{name:string;input:MarketingPlanInput;result:ReturnType<typeof marketingPlan>}|null>(null);
  const focus=useRef<HTMLElement>(null);
  const update=(key:keyof Draft,value:string)=>{setDraft(d=>({...d,[key]:value}));setError('');};
  function move(next:number){setStep(next);setError('');requestAnimationFrame(()=>{focus.current?.focus();focus.current?.scrollIntoView({behavior:'smooth',block:'start'});});}
  function submit(e:FormEvent){
    e.preventDefault();
    if(step===1){
      try{resolvePlanBudget(budgetMode,draft.purchaseBudget,draft.marketingBudget,draft.available);}catch(e){setError(e instanceof Error?e.message:'예산을 확인하세요.');return;}
      if(!draft.name.trim() || basics.some(([key])=>draft[key].trim()==='' || !Number.isFinite(Number(draft[key])) || Number(draft[key])<0) || Number(draft.price)<=0 || !Number.isSafeInteger(Number(draft.quantity)) || Number(draft.quantity)<1){setError('품목과 모든 기본 정보를 입력해 주세요. 판매가와 수량은 0보다 커야 하며, 수량은 정수여야 합니다.');return;}
      move(2);return;
    }
    if(extras.some(([key])=>draft[key].trim()==='')){setError('모든 부가비용을 확인해 주세요. 비용이 없으면 ‘해당 없음’을 선택하세요.');return;}
    try{
      const input=Object.fromEntries([...basics,...extras].map(([key])=>[key,Number(draft[key])])) as MarketingPlanInput;
      Object.assign(input,resolvePlanBudget(budgetMode,draft.purchaseBudget,draft.marketingBudget,draft.available));
      const result=marketingPlan(input);
      setReport({name:draft.name.trim(),input,result});move(3);
    }catch(e){setError(e instanceof Error?e.message:'입력값을 확인해 주세요.');}
  }
  const r=report?.result;
  const verdict=r ? r.margin<=0?'판매할수록 비용이 더 드는 구조예요':r.profitRoom<0?'판매 계획만으로 고정비를 회수하기 어려워요':r.cashRoom<0?'판매 준비 자금부터 추가 확보가 필요해요':r.marketing===0?'지금은 마케팅에 쓸 여유가 없어요':'마케팅을 검토할 수 있는 여유가 있어요':'';
  return <div className="finance-dashboard mp-shell"><ToolsHeader active="profit"/><main className="mp-main">
    <header className="mp-intro"><span className="mp-eyebrow">MARKETING BUDGET PLANNER</span><h1>이 상품, 마케팅에<br/><em>얼마까지 쓸 수 있을까요?</em></h1><p>상품 가격과 빠뜨리기 쉬운 비용부터 확인하세요.<br/>어려운 광고 지식 없이, 내 상품의 마케팅 한도를 알아봅니다.</p></header>
    <ol className="mp-steps" aria-label="분석 진행 단계">{['상품과 자금','빠뜨린 비용 확인','평가 보고서'].map((label,i)=><li key={label} aria-current={step===i+1?'step':undefined}><span>{step>i+1?<Check size={15}/>:`0${i+1}`}</span>{label}</li>)}</ol>
    <section ref={focus} tabIndex={-1} className="mp-workspace" aria-label={step===3?'수익성 평가 보고서':'수익성 분석 입력'}>
    {step<3?<form onSubmit={submit} noValidate><div className="mp-section-heading"><span>STEP 0{step}</span><h2>{step===1?'판매할 상품과 자금을 알려주세요':'이런 비용, 안 빼먹으셨나요?'}</h2><p>{step===1?'같은 기간·같은 상품 수량을 기준으로 입력해 주세요.':'작은 비용도 모이면 마케팅 예산이 달라집니다. 0원도 직접 확인해 주세요.'}</p></div>
      {step===1&&<label className="mp-name">품목<input value={draft.name} onChange={e=>update('name',e.target.value)} placeholder="예: 보조배터리" maxLength={100}/><small className="mp-product-hint">품목에서 관련 키워드를 자동으로 찾고, 보고서에 광고비 분석을 함께 보여드립니다.</small></label>}
      {step===1&&<section className="mp-budget-input" aria-label="사용할 예산"><div className="mp-budget-modes"><button type="button" className={budgetMode==='split'?'is-active':''} aria-pressed={budgetMode==='split'} onClick={()=>setBudgetMode('split')}>구매·마케팅 비용 나눠 입력</button><button type="button" className={budgetMode==='total'?'is-active':''} aria-pressed={budgetMode==='total'} onClick={()=>setBudgetMode('total')}>총 가용비용 한 칸에 입력</button></div><div className="mp-fields">{(budgetMode==='split'?[['purchaseBudget','구매에 쓸 예정인 비용','상품 매입·구매를 위해 준비한 자금'],['marketingBudget','마케팅에 쓸 예정인 비용','이번 계획에서 마케팅에 쓰려는 최대 금액']]:[['available','총 가용비용','상품 구매·부가비용·마케팅을 합쳐 쓸 전체 자금']]).map(([key,label,help])=><div className="mp-field" key={key}><label htmlFor={`mp-${key}`}>{label}</label><p>{help}</p><div className="mp-input-wrap"><FormattedNumberInput id={`mp-${key}`} value={draft[key as keyof Draft]} onValueChange={value=>update(key as keyof Draft,value)} placeholder="금액 입력"/><span>원</span></div></div>)}</div><p className="mp-product-hint">마케팅에 얼마쓸지 모르겠다면 한칸에 총 가용비용을 기재해주세요.</p></section>}
      <div className="mp-fields">{(step===1?basics:extras).map(([key,label,description,unit])=><div className="mp-field" key={key}><label htmlFor={`mp-${key}`}>{label}</label><p id={`mp-help-${key}`}>{description}</p><div className="mp-input-wrap"><FormattedNumberInput id={`mp-${key}`} aria-describedby={`mp-help-${key}`} value={draft[key]} onValueChange={value=>update(key,value)} placeholder={key==='quantity'?'수량 입력':'금액 입력'}/><span>{unit}</span></div>{step===2&&<label className="mp-zero"><input type="checkbox" checked={draft[key]==='0'} onChange={e=>update(key,e.target.checked?'0':'')}/>해당 없음 · 0{key==='feePercent'?'%':'원'}</label>}</div>)}</div>
      <aside className="mp-note"><Wallet size={20}/><p>{step===1?'구매·마케팅 예정 비용의 합계 또는 총 가용비용을 기준으로 계산합니다. 상품·부가비용을 먼저 확보하고, 마케팅 예정 비용 이내에서 지출 한도를 계산합니다. 아직 발생하지 않은 매출은 더하지 않습니다.':'인증·검사비와 기타 고정비는 전체 금액으로 입력하세요. 계획 수량에 나눠 반영합니다. 세금·할인·추가 비용도 해당 항목에 포함해 주세요.'}</p></aside>
      {error&&<p className="mp-error" role="alert">{error}</p>}<div className="mp-actions">{step===2&&<button type="button" className="mp-secondary" onClick={()=>move(1)}>이전 단계</button>}<button type="submit" className="mp-primary">{step===1?'다음 · 빠뜨린 비용 확인':'내 상품 평가 보고서 보기'}<ArrowRight size={17}/></button></div>
    </form>:report&&r&&<article className="mp-report"><div className="mp-report-top"><span className="mp-eyebrow"><FileText size={16}/> PRODUCT PROFIT REPORT</span><span>입력값 기준 · 계획 수량 {report.input.quantity.toLocaleString()}개</span></div><h2>{report.name} 평가 보고서</h2><p className="mp-verdict">{verdict}</p>
      <section className="mp-bep" aria-label="본전을 위한 최소 판매량"><span className="mp-bep-label">가장 먼저 확인하세요 · 손익분기 판매량</span>{r.breakEvenUnits===null?<h3>현재 가격·비용으로는<br/>본전에 도달할 수 없습니다.</h3>:<><h3>이 광고비를 쓰면 최소</h3><strong>{r.breakEvenUnits.toLocaleString('ko-KR')}<span>개</span></strong><h3>를 팔아야 본전입니다.</h3><div className="mp-bep-context"><span>마케팅 지출 상한 <b>{money(r.marketing)}</b></span><span>판매 계획 <b>{report.input.quantity.toLocaleString('ko-KR')}개 중 {Math.ceil(r.breakEvenUnits/report.input.quantity*100).toLocaleString('ko-KR')}%</b></span></div>{r.breakEvenUnits>report.input.quantity&&<p className="mp-bep-warning">계획 수량을 모두 팔아도 본전에 도달하지 못합니다. 가격·비용·판매 계획을 다시 확인하세요.</p>}</>}<details><summary>계산 근거와 재고 유의사항</summary><p>손익분기 판매량 = (전체 고정비 + 마케팅 지출 상한) ÷ 광고 전 개당 여유 금액, 올림. 상품 원가는 판매된 수량만큼 비용으로 계산합니다. 미판매 재고에 묶인 현금은 회수되지 않습니다.</p></details></section>
      <section className="mp-budget"><span>이번 계획의 마케팅 지출 상한</span><strong>{money(r.marketing)}</strong><p>비용을 모두 확보하고, 계획 수량을 전부 팔았을 때 손실이 나지 않는 범위입니다. {report.input.marketingBudget!==undefined&&'입력한 마케팅 예정 비용을 넘지 않도록 제한했습니다.'}</p><small>목표 예산이나 성과 보장 금액이 아닙니다. 실제 집행은 소액부터 확인하세요.</small></section>
      <div className="mp-metrics"><div><span>1개 팔고 광고 전에 남는 돈</span><strong>{money(r.margin)}</strong><p>판매가 − 상품 원가 − 개당 부가비용</p></div><div><span>고정비까지 반영한 1건당 광고비 한도</span><strong>{money(r.perOrder)}</strong><p>한 번 판매를 만드는 데 이 금액보다 쓰면 손실이 생깁니다.</p></div><div><span>손해를 피하려면 필요한 광고 매출</span><strong>{r.breakEvenRoas===null?'계산 불가':`광고비의 ${(r.breakEvenRoas/100).toLocaleString('ko-KR',{maximumFractionDigits:2})}배`}</strong><p>손익분기 ROAS {r.breakEvenRoas===null?'없음':`${r.breakEvenRoas.toLocaleString('ko-KR',{maximumFractionDigits:1})}%`} · 계획 수량에 고정비 배분</p></div></div>
      <section className="mp-report-section"><h3>01. 돈이 어디에 쓰이나요?</h3><div className="mp-cost-bar" aria-label="상품 1개 비용 구성">{[['상품 원가',report.input.cost],['수수료',r.fee],['물류·포장·반품',report.input.logistics+report.input.packaging+report.input.returns],['광고 전 여유',Math.max(0,r.margin)]].map(([label,value],i)=><span key={label} style={{flex:Math.max(Number(value),0),background:['#172c4f','#6d8ddd','#b7caf3','#2a59f4'][i]}} title={`${label}: ${money(Number(value))}`}/>)}</div><dl className="mp-breakdown">{[['판매가',report.input.price],['상품 원가',report.input.cost],['플랫폼·결제 수수료',r.fee],['물류·배송비',report.input.logistics],['포장·기타 판매비',report.input.packaging],['반품·교환 예상비',report.input.returns],['고정비 배분 (인증비 포함)',r.fixed/report.input.quantity],['1건당 광고비 한도',r.perOrder]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{money(Number(value))}</dd></div>)}</dl></section>
      <section className="mp-report-section"><h3>02. 전체 자금과 손익분기점 (BEP)</h3><dl className="mp-breakdown">{[['총 가용비용',report.input.available],...(report.input.marketingBudget!==undefined?[['구매 예정 비용',report.input.purchaseBudget!],['마케팅 예정 비용',report.input.marketingBudget]]:[]),['먼저 확보할 상품·부가비용',r.reserved],['비용 확보 후 자금 여유',r.cashRoom],['계획 수량 기준 손익상 광고비 한도',r.profitRoom],['최종 마케팅 지출 상한',r.marketing],['전량 판매 시 매출',r.sales],['상한만큼 광고 집행 후 예상 이익',r.profit]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{money(Number(value))}</dd></div>)}</dl></section>
      <KeywordBudgetReport productName={report.name} perOrder={r.perOrder} budget={r.marketing}/>
      <section className="mp-report-section"><h3>04. 다음에 확인할 일</h3><ul><li>{r.margin<=0?'판매가를 올리거나 상품 원가·개당 부가비용을 먼저 줄이세요.':r.profitRoom<0?'고정비를 낮추거나 판매 계획의 실현 가능성을 다시 점검하세요.':r.cashRoom<0?`판매 준비에 ${money(-r.cashRoom)}의 추가 자금이 필요합니다.`:'계산된 상한을 한 번에 쓰지 말고, 작은 금액으로 실제 판매 비용부터 확인하세요.'}</li><li>광고 1건당 판매를 만드는 비용을 ‘1건당 광고비 한도’와 비교하세요.</li><li>가격·수수료·반품률이 바뀌면 보고서를 다시 계산하세요.</li></ul></section>
      <p className="mp-assumptions">이번 계획 수량이 모두 판매되고 판매 1건 = 상품 1개인 경우의 계산입니다. 입력한 비용만 반영하며, 반품·세금·할인 등이 빠졌다면 결과가 높게 나올 수 있습니다. 광고 매출·전환율은 예측하지 않습니다. 금액 표시는 원 단위 반올림, 지출 상한은 내림 처리합니다.</p><div className="mp-actions"><button type="button" className="mp-secondary" onClick={()=>move(1)}>입력 수정</button><button type="button" className="mp-primary" onClick={()=>window.print()}>보고서 인쇄 / PDF 저장</button></div>
    </article>}
    </section><p className="mp-privacy">입력한 내용은 이 화면에서만 계산합니다. 새로고침하면 초기화됩니다.</p>
  </main></div>;
}
