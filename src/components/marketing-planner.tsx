"use client";
import {useEffect,useRef,useState,type FormEvent} from 'react';
import { useDraftPreviewStage } from '@/lib/draft-preview-stage';
import {ArrowRight,Check,TriangleAlert} from 'lucide-react';
import {ToolsHeader} from './tools-header';
import {FormattedNumberInput} from './formatted-number-input';
import {SellingPreparation} from './selling-preparation';
import {BeginnerProfitReport} from './beginner-profit-report';
import {PlannerCostHelp} from './planner-cost-help';
import {marketingPlan,type MarketingPlanInput} from '@/lib/marketing-plan';
import {plannerExamples} from '@/lib/planner-examples';
import {activePlannerExamples,setPlannerExample,setPlannerInput} from '@/lib/planner-example-state';
import {plannerLiveCosts} from '@/lib/planner-live-costs';
import '@/app/tools/marketing-planner.css';

const basics=[
 ['price','판매가','고객이 내는 한 개 가격','원 / 개'],
 ['cost','상품 원가','한 개를 사거나 만드는 비용','원 / 개'],
 ['quantity','팔려는 수량','이번에 준비할 개수','개'],
] as const;
const extras=[
 ['feePercent','판매 수수료','판매할 때 플랫폼에 내는 비율','%'],
 ['logistics','배송·물류비','내가 부담하는 한 개당 배송·보관비','원 / 개'],
 ['packaging','포장·기타 비용','박스·사은품 등 한 개당 비용','원 / 개'],
 ['returnRate','예상 반품률','100개 중 몇 개가 반품될까요?','%'],
] as const;
type Draft={months:string;name:string;available:string;price:string;cost:string;quantity:string;feePercent:string;logistics:string;packaging:string;returnRate:string;returnHandling:string};
const empty:Draft={months:'',name:'',available:'',price:'',cost:'',quantity:'',feePercent:'',logistics:'',packaging:'',returnRate:'',returnHandling:''};
const sampleInput:MarketingPlanInput={price:30000,cost:12000,quantity:100,available:3000000,feePercent:5,logistics:3000,packaging:1000,returns:0,certification:0,fixed:0};
const previewReport={name:'미리보기 예시',months:3,input:sampleInput,result:marketingPlan(sampleInput),examples:[]};
const money=(value:number)=>`${Math.round(value).toLocaleString('ko-KR')}원`;
export function MarketingPlanner(){
 const [inputs,setInputs]=useState<{draft:Draft;exampleFields:string[]}>({draft:empty,exampleFields:[]});
 const {draft,exampleFields}=inputs;
 const [step,setStep]=useState(1);
 const [error,setError]=useState('');
 const [report,setReport]=useState<{name:string;months:number;input:MarketingPlanInput;result:ReturnType<typeof marketingPlan>;examples:string[]}|null>(null);
 const focus=useRef<HTMLElement>(null);
 const previewStage = useDraftPreviewStage('/tools/');
 useEffect(()=>{if(previewStage){const n=Number(previewStage);if(n>=3)setReport(previewReport);setStep(n);}},[previewStage]);
 const update=(key:keyof Draft,value:string)=>{setInputs(current=>setPlannerInput(current,key,value));setError('');};
 const basicReady=basics.every(([key])=>draft[key]!==''&&Number.isFinite(Number(draft[key]))&&Number(draft[key])>=0)&&Number(draft.price)>0&&Number.isSafeInteger(Number(draft.quantity))&&Number(draft.quantity)>0;
 const hasBudget=draft.available!=='';
 const costReady=draft.cost!==''&&draft.quantity!==''&&Number.isSafeInteger(Number(draft.quantity))&&Number(draft.quantity)>0;
 const stockCost=costReady?Number(draft.cost)*Number(draft.quantity):null;
 let live:ReturnType<typeof plannerLiveCosts>|null=null;
 if(basicReady){try{live=plannerLiveCosts({price:Number(draft.price),cost:Number(draft.cost),quantity:Number(draft.quantity),available:Number(draft.available),feePercent:Number(draft.feePercent),logistics:Number(draft.logistics),packaging:Number(draft.packaging),returnRate:Number(draft.returnRate),returnHandling:Number(draft.returnHandling)});}catch{}}
 const useExample=(key:keyof typeof plannerExamples)=>{setInputs(current=>setPlannerExample(current,key));setError('');};
 const activeExamples=activePlannerExamples(draft,exampleFields);
 const missing=extras.filter(([key])=>draft[key]==='').length;
 const returnCostMissing=Number(draft.returnRate)>0&&draft.returnHandling==='';
 const overBudget=hasBudget&&stockCost!==null&&stockCost>Number(draft.available);
 function move(next:number){setStep(next);setError('');requestAnimationFrame(()=>{focus.current?.focus();focus.current?.scrollIntoView({behavior:'smooth',block:'start'});});}
 function submit(event:FormEvent){
  event.preventDefault();
  if(step===1){
   if(!Number.isSafeInteger(Number(draft.months))||Number(draft.months)<1||Number(draft.months)>120){setError('판매 목표는 1~120개월의 정수로 입력하세요.');return;}
   if(!draft.name.trim()||!basicReady||!hasBudget||!Number.isFinite(Number(draft.available))||Number(draft.available)<0){setError('품목과 모든 금액·수량을 입력해 주세요. 판매가는 0보다 크게, 수량은 1개 이상의 정수로 입력하세요.');return;}
   move(2);return;
  }
  if(missing){setError('비용을 입력하세요. 모르면 참고값을 넣을 수 있어요.');return;}
  if(returnCostMissing){setError('반품 한 건을 처리하는 비용도 입력하세요.');return;}
  if(!live){setError('입력값을 확인해 주세요. 수수료와 반품률은 0~100%여야 합니다.');return;}
  try{
   const input:MarketingPlanInput={price:Number(draft.price),cost:Number(draft.cost),quantity:Number(draft.quantity),available:Number(draft.available),feePercent:Number(draft.feePercent),logistics:Number(draft.logistics),packaging:Number(draft.packaging),returns:live.returns,certification:0,fixed:0};
   setReport({name:draft.name.trim(),months:Number(draft.months),input,result:marketingPlan(input),examples:[...activeExamples]});move(3);
  }catch(e){setError(e instanceof Error?e.message:'입력값을 확인해 주세요.');}
 }
 return <div className="finance-dashboard mp-shell" data-preview-stage={String(step)}><ToolsHeader active="profit"/>
  {step<3&&<aside className={`mp-live-bar ${live&&live.profit<0?'is-loss':''}`} aria-label="실시간 상품 손익" aria-live="polite"><div className="mp-live-values"><span>판매가<b>{basicReady?money(Number(draft.price)):'—'}</b></span><span>비용 포함 원가<b>{live?money(live.unitCost):'—'}</b></span><span>한 개당 이익 · 홍보 전<b>{live?money(live.profit):'—'}</b></span><span>남는 예산<b className={live&&hasBudget?(live.remaining<0?'mp-negative':live.remaining>0?'mp-positive':'mp-neutral'):'mp-neutral'}>{live&&hasBudget?money(live.remaining):'—'}</b></span></div>{live&&live.profit<0?<p role="alert"><TriangleAlert size={16}/>비용이 더 커요. 한 개 팔 때 {money(-live.profit)} 손해입니다.</p>:<p>{step===2?'비용을 넣으면 바로 계산해요.':'입력하면 이익이 바로 보여요.'}</p>}</aside>}
  <main className="mp-main">{step<3&&<><header className="mp-intro"><h1>내 상품<br/><em>팔아도 되는걸까요?</em></h1><p>가격과 비용을 넣고, 남는 돈을 확인하세요.</p></header><ol className="mp-steps" aria-label="분석 진행 단계">{['상품과 자금','빠뜨린 비용 확인','결과'].map((label,index)=><li key={label} aria-current={step===index+1?'step':undefined}><span>{step>index+1?<Check size={15}/>:`0${index+1}`}</span>{label}</li>)}</ol></>}
   <section ref={focus} tabIndex={-1} className={`mp-workspace ${step>=3?'mp-workspace-report':''}`} aria-label={step>=3?'수익성 평가 보고서':'수익성 분석 입력'}>
   {step<3?<form onSubmit={submit} noValidate><div className="mp-section-heading"><span>STEP 0{step}</span><h2>{step===1?'상품과 예산을 알려주세요':'이런 비용, 안 빼먹으셨나요?'}</h2><p>{step===1?'이번에 팔 상품을 기준으로 적어주세요.':'빠진 비용을 더해보세요.'}</p></div>
    {step===1&&<><label className="mp-name">품목<input value={draft.name} onChange={event=>update('name',event.target.value)} placeholder="시계, 보조배터리, 가습기 등 품목을 입력해주세요" maxLength={100}/><small className="mp-product-hint">관련 검색어도 함께 찾아드려요.</small></label><section className="mp-budget-input" aria-label="사용할 예산"><div className="mp-field"><div className="mp-field-label"><label htmlFor="mp-available">쓸 수 있는 전체 돈</label><PlannerCostHelp field="available" label="쓸 수 있는 전체 돈"/></div><p>상품 구매부터 홍보까지 쓸 돈</p><div className="mp-input-wrap"><FormattedNumberInput id="mp-available" value={draft.available} onValueChange={value=>update('available',value)} placeholder="금액 입력"/><span>원</span></div></div></section></>}
    {step===1&&<section className="mp-target-input"><label htmlFor="mp-months">판매 목표</label><p>몇 개월 안에 전부 팔고 싶나요?</p><div className="mp-input-wrap"><FormattedNumberInput id="mp-months" value={draft.months} onValueChange={value=>update('months',value)} placeholder="예: 3"/><span>개월 이내</span></div></section>}
    <div className="mp-fields">{(step===1?basics:extras).map(([key,label,description,unit])=><div className="mp-field" key={key}><div className="mp-field-label"><label htmlFor={`mp-${key}`}>{label}</label><PlannerCostHelp field={key} label={label}/></div><p id={`mp-help-${key}`}>{description}</p><div className="mp-input-wrap"><FormattedNumberInput id={`mp-${key}`} aria-describedby={`mp-help-${key}`} value={draft[key]} onValueChange={value=>update(key,value)} placeholder={key==='quantity'?'수량 입력':unit==='%'?'비율 입력':'금액 입력'}/><span>{unit}</span></div>{step===2&&<div className="mp-quick-costs"><button type="button" onClick={()=>useExample(key as keyof typeof plannerExamples)}>모르면 참고값 넣기</button><button type="button" onClick={()=>update(key,'0')}>비용 없음 · 0{unit==='%'?'%':'원'}</button>{exampleFields.includes(key)&&<small>참고값이에요. 실제 비용으로 바꿀 수 있어요.</small>}</div>}{key==='returnRate'&&Number(draft.returnRate)>0&&<div className="mp-return-handling"><div className="mp-field-label"><label htmlFor="mp-returnHandling">반품 한 건 처리비</label><PlannerCostHelp field="returnHandling" label="반품 한 건 처리비"/></div><div className="mp-input-wrap"><FormattedNumberInput id="mp-returnHandling" value={draft.returnHandling} onValueChange={value=>update('returnHandling',value)} placeholder="반품 1건 처리 금액"/><span>원 / 건</span></div><p>한 개당 반품 예상 비용: {returnCostMissing?'처리 비용 입력 후 계산':live?money(live.returns):'—'}</p></div>}</div>)}
    {step===1&&<aside className={`mp-stock-cost ${overBudget?'is-over':''}`} aria-live="polite"><div className="mp-stock-top"><div><span>총 상품 원가</span><b>{stockCost!==null?money(stockCost):'—'}</b><small>상품 원가 × 판매 수량</small></div><div><span>모두 팔면 남는 이익</span><b>{live?money(live.marginTotal):'—'}</b><small>홍보비·미입력 비용 제외</small></div></div><div className="mp-stock-bottom"><span>남는 예산</span><strong className={live&&hasBudget?(live.remaining<0?'mp-negative':live.remaining>0?'mp-positive':'mp-neutral'):'mp-neutral'}>{live&&hasBudget?money(live.remaining):'—'}</strong><small>쓸 수 있는 돈 − 현재 전체 비용</small></div>{overBudget&&<p role="alert">상품 구매비가 예산보다 많아요.</p>}</aside>}</div>
    {step===2&&<aside className={`mp-actual-cost ${live&&live.profit<0?'is-loss':''}`} aria-live="polite"><span>비용을 더하면 원가가 달라져요</span><div className="mp-cost-change"><span><small>처음 원가</small><b>{money(Number(draft.cost))}</b></span><ArrowRight size={22} aria-label="비용 추가 후"/><span><small>비용 포함 원가</small><strong>{live?money(live.unitCost):'—'}</strong></span></div><p>구매비 + 수수료 + 배송 + 포장 + 반품</p><small>홍보비는 아직 빼지 않았어요. {missing>0?`아직 안 넣은 비용 ${missing}개는 제외했어요. `:''}{returnCostMissing?'반품 한 건 처리비을 입력해야 반품 비용이 반영됩니다. ':''}{activeExamples.length>0?'참고값이 포함돼 있어요. 실제 금액과 다를 수 있어요.':''}</small></aside>}
    {error&&<p className="mp-error" role="alert">{error}</p>}<div className="mp-actions">{step===2&&<button type="button" className="mp-secondary" onClick={()=>move(1)}>이전 단계</button>}<button type="submit" className="mp-primary">{step===1?'다음 · 비용 확인':'결과 보기'}<ArrowRight size={17}/></button></div>
   </form>:report&&(step===4?<SellingPreparation quantity={report.input.quantity} months={report.months} onBack={()=>move(3)}/>:<BeginnerProfitReport name={report.name} months={report.months} input={report.input} result={report.result} exampleFields={report.examples} onEdit={()=>move(1)} onMoreCosts={()=>move(4)}/>)}</section><p className="mp-privacy">뒤로 가도 값은 남아요. 새로고침하면 지워져요.</p>
  </main></div>;
}
