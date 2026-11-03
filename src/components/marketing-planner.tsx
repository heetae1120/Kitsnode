"use client";
import { useRef, useState, type FormEvent } from 'react';
import { ArrowRight, Check, Wallet } from 'lucide-react';
import { ToolsHeader } from './tools-header';
import { FormattedNumberInput } from './formatted-number-input';
import { BeginnerProfitReport } from './beginner-profit-report';
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
  return <div className="finance-dashboard mp-shell"><ToolsHeader active="profit"/><main className="mp-main">
    {step<3&&<><header className="mp-intro"><span className="mp-eyebrow">MARKETING BUDGET PLANNER</span><h1>이 상품, 마케팅에<br/><em>얼마까지 쓸 수 있을까요?</em></h1><p>상품 가격과 빠뜨리기 쉬운 비용부터 확인하세요.<br/>어려운 광고 지식 없이, 내 상품의 마케팅 한도를 알아봅니다.</p></header>
    <ol className="mp-steps" aria-label="분석 진행 단계">{['상품과 자금','빠뜨린 비용 확인','평가 보고서'].map((label,i)=><li key={label} aria-current={step===i+1?'step':undefined}><span>{step>i+1?<Check size={15}/>:`0${i+1}`}</span>{label}</li>)}</ol></>}
    <section ref={focus} tabIndex={-1} className={`mp-workspace ${step===3?'mp-workspace-report':''}`} aria-label={step===3?'수익성 평가 보고서':'수익성 분석 입력'}>
    {step<3?<form onSubmit={submit} noValidate><div className="mp-section-heading"><span>STEP 0{step}</span><h2>{step===1?'판매할 상품과 자금을 알려주세요':'이런 비용, 안 빼먹으셨나요?'}</h2><p>{step===1?'같은 기간·같은 상품 수량을 기준으로 입력해 주세요.':'작은 비용도 모이면 마케팅 예산이 달라집니다. 0원도 직접 확인해 주세요.'}</p></div>
      {step===1&&<label className="mp-name">품목<input value={draft.name} onChange={e=>update('name',e.target.value)} placeholder="예: 보조배터리" maxLength={100}/><small className="mp-product-hint">품목에서 관련 키워드를 자동으로 찾고, 보고서에 광고비 분석을 함께 보여드립니다.</small></label>}
      {step===1&&<section className="mp-budget-input" aria-label="사용할 예산"><div className="mp-budget-modes"><button type="button" className={budgetMode==='split'?'is-active':''} aria-pressed={budgetMode==='split'} onClick={()=>setBudgetMode('split')}>구매·마케팅 비용 나눠 입력</button><button type="button" className={budgetMode==='total'?'is-active':''} aria-pressed={budgetMode==='total'} onClick={()=>setBudgetMode('total')}>총 가용비용 한 칸에 입력</button></div><div className="mp-fields">{(budgetMode==='split'?[['purchaseBudget','구매에 쓸 예정인 비용','상품 매입·구매를 위해 준비한 자금'],['marketingBudget','마케팅에 쓸 예정인 비용','이번 계획에서 마케팅에 쓰려는 최대 금액']]:[['available','총 가용비용','상품 구매·부가비용·마케팅을 합쳐 쓸 전체 자금']]).map(([key,label,help])=><div className="mp-field" key={key}><label htmlFor={`mp-${key}`}>{label}</label><p>{help}</p><div className="mp-input-wrap"><FormattedNumberInput id={`mp-${key}`} value={draft[key as keyof Draft]} onValueChange={value=>update(key as keyof Draft,value)} placeholder="금액 입력"/><span>원</span></div></div>)}</div><p className="mp-product-hint">마케팅에 얼마쓸지 모르겠다면 한칸에 총 가용비용을 기재해주세요.</p></section>}
      <div className="mp-fields">{(step===1?basics:extras).map(([key,label,description,unit])=><div className="mp-field" key={key}><label htmlFor={`mp-${key}`}>{label}</label><p id={`mp-help-${key}`}>{description}</p><div className="mp-input-wrap"><FormattedNumberInput id={`mp-${key}`} aria-describedby={`mp-help-${key}`} value={draft[key]} onValueChange={value=>update(key,value)} placeholder={key==='quantity'?'수량 입력':'금액 입력'}/><span>{unit}</span></div>{step===2&&<label className="mp-zero"><input type="checkbox" checked={draft[key]==='0'} onChange={e=>update(key,e.target.checked?'0':'')}/>해당 없음 · 0{key==='feePercent'?'%':'원'}</label>}</div>)}</div>
      <aside className="mp-note"><Wallet size={20}/><p>{step===1?'구매·마케팅 예정 비용의 합계 또는 총 가용비용을 기준으로 계산합니다. 상품·부가비용을 먼저 확보하고, 마케팅 예정 비용 이내에서 지출 한도를 계산합니다. 아직 발생하지 않은 매출은 더하지 않습니다.':'인증·검사비와 기타 고정비는 전체 금액으로 입력하세요. 계획 수량에 나눠 반영합니다. 세금·할인·추가 비용도 해당 항목에 포함해 주세요.'}</p></aside>
      {error&&<p className="mp-error" role="alert">{error}</p>}<div className="mp-actions">{step===2&&<button type="button" className="mp-secondary" onClick={()=>move(1)}>이전 단계</button>}<button type="submit" className="mp-primary">{step===1?'다음 · 빠뜨린 비용 확인':'내 상품 평가 보고서 보기'}<ArrowRight size={17}/></button></div>
    </form>:report&&<BeginnerProfitReport name={report.name} input={report.input} result={report.result} onEdit={()=>move(1)}/>}
    </section><p className="mp-privacy">입력한 내용은 이 화면에서만 계산합니다. 새로고침하면 초기화됩니다.</p>
  </main></div>;
}
