"use client";
import {useRef,useState,type FormEvent} from 'react';
import {ArrowRight,Check,TriangleAlert} from 'lucide-react';
import {ToolsHeader} from './tools-header';
import {FormattedNumberInput} from './formatted-number-input';
import {BeginnerProfitReport} from './beginner-profit-report';
import {PlannerCostHelp} from './planner-cost-help';
import {marketingPlan,type MarketingPlanInput} from '@/lib/marketing-plan';
import {plannerLiveCosts} from '@/lib/planner-live-costs';
import '@/app/tools/marketing-planner.css';

const basics=[
 ['price','판매가','고객이 실제 결제하는 상품 1개 가격','원 / 개'],
 ['cost','상품 원가','상품 1개를 만들거나 매입하는 비용','원 / 개'],
 ['quantity','판매 계획 수량','이번 계획에서 준비하고 판매할 상품 수','개'],
] as const;
const extras=[
 ['feePercent','플랫폼·결제 수수료','판매가에 부과되는 총 수수료율','%'],
 ['logistics','물류·배송비','상품 1개당 입고·보관·출고·판매자 부담 배송비','원 / 개'],
 ['packaging','포장·기타 판매비','포장재, 사은품 등 1개 팔 때마다 드는 비용','원 / 개'],
 ['returnRate','예상 반품률','판매 계획 수량 중 반품될 것으로 예상하는 비율','%'],
] as const;
type Draft={name:string;available:string;price:string;cost:string;quantity:string;feePercent:string;logistics:string;packaging:string;returnRate:string;returnHandling:string};
const empty:Draft={name:'',available:'',price:'',cost:'',quantity:'',feePercent:'',logistics:'',packaging:'',returnRate:'',returnHandling:''};
const money=(value:number)=>`${Math.round(value).toLocaleString('ko-KR')}원`;
export function MarketingPlanner(){
 const [draft,setDraft]=useState<Draft>(empty);
 const [step,setStep]=useState(1);
 const [error,setError]=useState('');
 const [report,setReport]=useState<{name:string;input:MarketingPlanInput;result:ReturnType<typeof marketingPlan>}|null>(null);
 const focus=useRef<HTMLElement>(null);
 const update=(key:keyof Draft,value:string)=>{setDraft(previous=>({...previous,[key]:value}));setError('');};
 const basicReady=basics.every(([key])=>draft[key]!==''&&Number.isFinite(Number(draft[key]))&&Number(draft[key])>=0)&&Number(draft.price)>0&&Number.isSafeInteger(Number(draft.quantity))&&Number(draft.quantity)>0;
 const hasBudget=draft.available!=='';
 const costReady=draft.cost!==''&&draft.quantity!==''&&Number.isSafeInteger(Number(draft.quantity))&&Number(draft.quantity)>0;
 const stockCost=costReady?Number(draft.cost)*Number(draft.quantity):null;
 let live:ReturnType<typeof plannerLiveCosts>|null=null;
 if(basicReady){try{live=plannerLiveCosts({price:Number(draft.price),cost:Number(draft.cost),quantity:Number(draft.quantity),available:Number(draft.available),feePercent:Number(draft.feePercent),logistics:Number(draft.logistics),packaging:Number(draft.packaging),returnRate:Number(draft.returnRate),returnHandling:Number(draft.returnHandling)});}catch{}}
 const unknown=extras.filter(([key])=>draft[key]==='0').map(([,label])=>label);
 const missing=extras.filter(([key])=>draft[key]==='').length;
 const returnCostMissing=Number(draft.returnRate)>0&&draft.returnHandling==='';
 const overBudget=hasBudget&&stockCost!==null&&stockCost>Number(draft.available);
 function move(next:number){setStep(next);setError('');requestAnimationFrame(()=>{focus.current?.focus();focus.current?.scrollIntoView({behavior:'smooth',block:'start'});});}
 function submit(event:FormEvent){
  event.preventDefault();
  if(step===1){
   if(!draft.name.trim()||!basicReady||!hasBudget||!Number.isFinite(Number(draft.available))||Number(draft.available)<0){setError('품목과 모든 금액·수량을 입력해 주세요. 판매가는 0보다 크게, 수량은 1개 이상의 정수로 입력하세요.');return;}
   move(2);return;
  }
  if(missing){setError('모든 비용을 입력하거나 ‘해당 없음 혹은 모름’을 선택해 주세요.');return;}
  if(returnCostMissing){setError('반품률을 비용에 반영하려면 반품 1건당 처리 비용도 입력해 주세요.');return;}
  if(!live){setError('입력값을 확인해 주세요. 수수료와 반품률은 0~100%여야 합니다.');return;}
  try{
   const input:MarketingPlanInput={price:Number(draft.price),cost:Number(draft.cost),quantity:Number(draft.quantity),available:Number(draft.available),feePercent:Number(draft.feePercent),logistics:Number(draft.logistics),packaging:Number(draft.packaging),returns:live.returns,certification:0,fixed:0};
   setReport({name:draft.name.trim(),input,result:marketingPlan(input)});move(3);
  }catch(e){setError(e instanceof Error?e.message:'입력값을 확인해 주세요.');}
 }
 return <div className="finance-dashboard mp-shell"><ToolsHeader active="profit"/>
  {step<3&&<aside className={`mp-live-bar ${live&&live.profit<0?'is-loss':''}`} aria-label="실시간 상품 손익" aria-live="polite"><div className="mp-live-values"><span>판가<b>{basicReady?money(Number(draft.price)):'—'}</b></span><span>현재 반영한 원가<b>{live?money(live.unitCost):'—'}</b></span><span>개당 이익 · 홍보비용 전<b>{live?money(live.profit):'—'}</b></span></div>{live&&live.profit<0?<p role="alert"><TriangleAlert size={16}/>원가가 판가보다 높아요. 1개 팔 때 {money(-live.profit)} 손해입니다.</p>:<p>{step===2?'부가비용을 입력하면 원가와 이익에 바로 반영됩니다.':'상품 정보를 입력하면 판가·원가·이익이 여기에 표시됩니다.'}</p>}</aside>}
  <main className="mp-main">{step<3&&<><header className="mp-intro"><h1>내 상품<br/><em>팔아도 되는걸까요?</em></h1><p>상품 가격부터 내가 빼먹은 비용까지 모두 확인해보세요</p></header><ol className="mp-steps" aria-label="분석 진행 단계">{['상품과 자금','빠뜨린 비용 확인','평가 보고서'].map((label,index)=><li key={label} aria-current={step===index+1?'step':undefined}><span>{step>index+1?<Check size={15}/>:`0${index+1}`}</span>{label}</li>)}</ol></>}
   <section ref={focus} tabIndex={-1} className={`mp-workspace ${step===3?'mp-workspace-report':''}`} aria-label={step===3?'수익성 평가 보고서':'수익성 분석 입력'}>
   {step<3?<form onSubmit={submit} noValidate><div className="mp-section-heading"><span>STEP 0{step}</span><h2>{step===1?'판매할 상품과 쓸 수 있는 금액을 알려주세요':'이런 비용, 안 빼먹으셨나요?'}</h2><p>{step===1?'같은 기간·같은 상품 수량을 기준으로 입력해 주세요.':'비용을 더할 때마다 상단의 원가와 이익이 바뀝니다.'}</p></div>
    {step===1&&<><label className="mp-name">품목<input value={draft.name} onChange={event=>update('name',event.target.value)} placeholder="시계, 보조배터리, 가습기 등 품목을 입력해주세요" maxLength={100}/><small className="mp-product-hint">품목에서 관련 키워드를 자동으로 찾고, 보고서에 홍보비용 분석을 함께 보여드립니다.</small></label><section className="mp-budget-input" aria-label="사용할 예산"><div className="mp-field"><div className="mp-field-label"><label htmlFor="mp-available">총 가용비용</label><PlannerCostHelp field="available" label="총 가용비용"/></div><p>상품 구매·부가비용·홍보비용을 합쳐 쓸 전체 자금</p><div className="mp-input-wrap"><FormattedNumberInput id="mp-available" value={draft.available} onValueChange={value=>update('available',value)} placeholder="금액 입력"/><span>원</span></div></div></section></>}
    <div className="mp-fields">{(step===1?basics:extras).map(([key,label,description,unit])=><div className="mp-field" key={key}><div className="mp-field-label"><label htmlFor={`mp-${key}`}>{label}</label><PlannerCostHelp field={key} label={label}/></div><p id={`mp-help-${key}`}>{description}</p><div className="mp-input-wrap"><FormattedNumberInput id={`mp-${key}`} aria-describedby={`mp-help-${key}`} value={draft[key]} onValueChange={value=>update(key,value)} placeholder={key==='quantity'?'수량 입력':unit==='%'?'비율 입력':'금액 입력'}/><span>{unit}</span></div>{step===2&&<label className="mp-zero"><input type="checkbox" checked={draft[key]==='0'} onChange={event=>update(key,event.target.checked?'0':'')}/>해당 없음 혹은 모름 · 0{unit==='%'?'%':'원'}</label>}{key==='returnRate'&&Number(draft.returnRate)>0&&<div className="mp-return-handling"><div className="mp-field-label"><label htmlFor="mp-returnHandling">반품 1건당 처리 비용</label><PlannerCostHelp field="returnHandling" label="반품 1건당 처리 비용"/></div><div className="mp-input-wrap"><FormattedNumberInput id="mp-returnHandling" value={draft.returnHandling} onValueChange={value=>update('returnHandling',value)} placeholder="반품 1건 처리 금액"/><span>원 / 건</span></div><p>예상 반품 비용: 판매 계획 상품 1개당 {returnCostMissing?'처리 비용 입력 후 계산':live?money(live.returns):'—'}</p></div>}</div>)}
    {step===1&&<aside className={`mp-stock-cost ${overBudget?'is-over':''}`} aria-live="polite"><span>상품 원가 × 판매 계획 수량</span><strong>{stockCost!==null?money(stockCost):'원가와 수량을 입력해 주세요'}</strong><div className="mp-stock-split"><div><span>판매 계획 전체 마진금액</span><b>{live?money(live.marginTotal):'—'}</b><small>홍보비용 전 · 미입력 부가비용 제외</small></div><div><span>남는 예산</span><b>{live&&hasBudget?money(live.remaining):'—'}</b><small>총 가용비용 − 현재 반영한 전체 비용</small></div></div>{overBudget&&<p role="alert">상품 원가 합계가 가용비용을 초과했어요. 입력값을 확인해 주세요.</p>}</aside>}</div>
    {step===2&&<aside className={`mp-actual-cost ${live&&live.profit<0?'is-loss':''}`} aria-live="polite"><span>그래서 원가가 사실은 이 금액입니다.</span><strong>{live?money(live.unitCost):'입력값을 확인해 주세요'}<small> / 개</small></strong><p>상품 원가 + 판매 수수료 + 물류·배송비 + 포장·기타 판매비 + 예상 반품 비용</p><small>홍보비용 전 원가입니다. {missing>0?`아직 입력하지 않은 ${missing}개 항목은 현재 합계에서 제외되어 있습니다. `:''}{returnCostMissing?'반품 1건당 처리 비용을 입력해야 반품 비용이 반영됩니다. ':''}{unknown.length>0?'해당 없음 혹은 모름을 선택한 항목은 0원으로 계산됩니다. 모르는 비용이 있으면 실제 이익이 더 낮아질 수 있어요.':''}</small></aside>}
    {error&&<p className="mp-error" role="alert">{error}</p>}<div className="mp-actions">{step===2&&<button type="button" className="mp-secondary" onClick={()=>move(1)}>이전 단계</button>}<button type="submit" className="mp-primary">{step===1?'다음 · 빠뜨린 비용 확인':'내 상품 평가 보고서 보기'}<ArrowRight size={17}/></button></div>
   </form>:report&&<BeginnerProfitReport name={report.name} input={report.input} result={report.result} onEdit={()=>move(1)}/>}</section><p className="mp-privacy">이전 단계로 돌아가도 입력값은 유지됩니다. 새로고침하면 초기화됩니다.</p>
  </main></div>;
}
