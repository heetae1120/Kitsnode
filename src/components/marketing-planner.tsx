"use client";
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {AnimatePresence,motion,useReducedMotion} from 'framer-motion';
import { useDraftPreviewStage } from '@/lib/draft-preview-stage';
import {ArrowRight,Check,TriangleAlert} from 'lucide-react';
import {ToolsHeader} from './tools-header';
import {FormattedNumberInput} from './formatted-number-input';
import {SellingPreparation} from './selling-preparation';
import {BeginnerProfitReport} from './beginner-profit-report';
import {PlannerCostHelp} from './planner-cost-help';
import {marketingPlan,type MarketingPlanInput} from '@/lib/marketing-plan';
import {plannerExamples} from '@/lib/planner-examples';
import {plannerLiveCosts} from '@/lib/planner-live-costs';
import '@/app/tools/marketing-planner.css';

const basics=[
 ['price','판매가','원 / 개'],
 ['cost','상품 원가','원 / 개'],
 ['quantity','팔려는 수량','개'],
] as const;
const extras=[
 ['feePercent','판매 수수료','%'],
 ['logistics','배송·물류비','원 / 개'],
 ['packaging','포장·기타 비용','원 / 개'],
 ['returnRate','예상 반품률','%'],
] as const;
type Draft={months:string;name:string;available:string;price:string;cost:string;quantity:string;feePercent:string;logistics:string;packaging:string;returnRate:string;returnHandling:string};
const empty:Draft={months:'',name:'',available:'',price:'',cost:'',quantity:'',feePercent:'',logistics:'',packaging:'',returnRate:'',returnHandling:''};
const sampleInput:MarketingPlanInput={price:30000,cost:12000,quantity:100,available:3000000,feePercent:5,logistics:3000,packaging:1000,returns:0,certification:0,fixed:0};
const previewReport={name:'미리보기 예시',months:3,input:sampleInput,result:marketingPlan(sampleInput),examples:[]};
const money=(value:number)=>`${Math.round(value).toLocaleString('ko-KR')}원`;
export function MarketingPlanner(){
 const [draft,setDraft]=useState<Draft>(empty);
 const [step,setStep]=useState(1);
 const [direction,setDirection]=useState(1);
 const reducedMotion=useReducedMotion();
 const [error,setError]=useState('');
 const [report,setReport]=useState<{name:string;months:number;input:MarketingPlanInput;result:ReturnType<typeof marketingPlan>;examples:string[]}|null>(null);
 const focus=useRef<HTMLElement>(null);
 const previewStage = useDraftPreviewStage('/tools/');
 useEffect(()=>{if(previewStage){const n=Number(previewStage);if(n>=3)setReport(previewReport);setStep(n);}},[previewStage]);
 const update=(key:keyof Draft,value:string)=>{setDraft(previous=>({...previous,[key]:value}));setExampleFields(keys=>keys.filter(field=>field!==key));setError('');};
 const basicReady=basics.every(([key])=>draft[key]!==''&&Number.isFinite(Number(draft[key]))&&Number(draft[key])>=0)&&Number(draft.price)>0&&Number.isSafeInteger(Number(draft.quantity))&&Number(draft.quantity)>0;
 const hasBudget=draft.available!=='';
 const costReady=draft.cost!==''&&draft.quantity!==''&&Number.isSafeInteger(Number(draft.quantity))&&Number(draft.quantity)>0;
 const stockCost=costReady?Number(draft.cost)*Number(draft.quantity):null;
 let live:ReturnType<typeof plannerLiveCosts>|null=null;
 if(basicReady){try{live=plannerLiveCosts({price:Number(draft.price),cost:Number(draft.cost),quantity:Number(draft.quantity),available:Number(draft.available),feePercent:Number(draft.feePercent),logistics:Number(draft.logistics),packaging:Number(draft.packaging),returnRate:Number(draft.returnRate),returnHandling:Number(draft.returnHandling)});}catch{}}
 const [exampleFields,setExampleFields]=useState<string[]>([]);
 const useExample=(key:keyof typeof plannerExamples)=>{setDraft(d=>({...d,[key]:plannerExamples[key],...(key==='returnRate'&&d.returnHandling===''?{returnHandling:plannerExamples.returnHandling}:{})}));setExampleFields(keys=>[...new Set([...keys,key,...(key==='returnRate'?['returnHandling']:[])])]);setError('');};
 const missing=extras.filter(([key])=>draft[key]==='').length;
 const returnCostMissing=Number(draft.returnRate)>0&&draft.returnHandling==='';
 const overBudget=hasBudget&&stockCost!==null&&stockCost>Number(draft.available);
 function move(next:number){setDirection(next>step?1:-1);setStep(next);setError('');requestAnimationFrame(()=>{focus.current?.focus();focus.current?.scrollIntoView({behavior:'smooth',block:'start'});});}
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
   setReport({name:draft.name.trim(),months:Number(draft.months),input,result:marketingPlan(input),examples:[...exampleFields]});move(3);
  }catch(e){setError(e instanceof Error?e.message:'입력값을 확인해 주세요.');}
 }

 return <div className="finance-dashboard mp-shell" data-preview-stage={String(step)}>
  <ToolsHeader active="profit"/>
  {step<3&&<aside className={`mp-live-bar ${live&&live.profit<0?'is-loss':''}`} aria-label="실시간 상품 손익" aria-live="polite">
   <div className="mp-live-values">
    <span>판매가<b>{basicReady?money(Number(draft.price)):'—'}</b></span>
    <span>비용 포함 원가<b>{live?money(live.unitCost):'—'}</b></span>
    <span>한 개당 이익 · 홍보 전<b>{live?money(live.profit):'—'}</b></span>
    <span>남는 예산<b className={live&&hasBudget?(live.remaining<0?'mp-negative':live.remaining>0?'mp-positive':'mp-neutral'):'mp-neutral'}>{live&&hasBudget?money(live.remaining):'—'}</b></span>
   </div>
   {live&&live.profit<0&&<p role="alert"><TriangleAlert size={16}/>한 개 팔 때 {money(-live.profit)} 손해입니다.</p>}
  </aside>}
  <main className="mp-main">
   {step<3&&<header className="mp-intro"><h1>진단 키트로 빠르게 진단해보기</h1></header>}
   {step<=3&&<ol className="mp-steps" aria-label="분석 진행 단계">{['상품과 자금','빠뜨린 비용 확인','결과'].map((label,index)=><li key={label} aria-current={step===index+1?'step':undefined} data-complete={step>index+1||undefined}><span className="mp-step-number">{step>index+1?<Check size={24}/>:String(index+1).padStart(2,'0')}</span><div><small>STEP {String(index+1).padStart(2,'0')}</small><b>{label}</b></div></li>)}</ol>}
   <section ref={focus} tabIndex={-1} className={`mp-workspace ${step>=3?'mp-workspace-report':'mp-ipad'}`} aria-label={step>=3?'수익성 평가 보고서':'수익성 분석 입력'}>
    {step<3&&<span className="mp-ipad-camera" aria-hidden="true"/>}
    {step<3?<AnimatePresence mode="wait" initial={false} custom={direction}><motion.form key={step} custom={direction} initial="enter" animate="center" exit="leave" variants={{enter:(d:number)=>({x:reducedMotion?0:d*80,opacity:reducedMotion?1:0,filter:reducedMotion?'none':'blur(4px)'}),center:{x:0,opacity:1,filter:'blur(0px)'},leave:(d:number)=>({x:reducedMotion?0:-d*60,opacity:reducedMotion?1:0,filter:reducedMotion?'none':'blur(3px)',pointerEvents:'none' as const})}} transition={{duration:reducedMotion?0:0.28,ease:[0.22,1,0.36,1]}} onSubmit={submit} noValidate>
     <div className="mp-section-heading"><span>STEP 0{step}</span><h2>{step===1?'간단하게 작성해주시면 빠르게 진단해드려요':'원가 말고도 이런비용도 있습니다.'}</h2></div>
     {step===1&&<>
      <label className="mp-name">품목<input value={draft.name} onChange={event=>update('name',event.target.value)} placeholder="예: 보조배터리" maxLength={100}/></label>
      <div className="mp-plan-row">
       <section className="mp-budget-input" aria-label="사용할 예산"><div className="mp-field"><div className="mp-field-label"><label htmlFor="mp-available">쓸 수 있는 전체 돈</label><PlannerCostHelp field="available" label="쓸 수 있는 전체 돈"/></div><div className="mp-input-wrap"><FormattedNumberInput id="mp-available" value={draft.available} onValueChange={value=>update('available',value)} placeholder="금액 입력"/><span>원</span></div></div></section>
       <section className="mp-target-input"><label htmlFor="mp-months">몇달안에 팔아보고 싶으신가요</label><div className="mp-input-wrap"><FormattedNumberInput id="mp-months" value={draft.months} onValueChange={value=>update('months',value)} placeholder="개월 입력"/><span>개월 이내</span></div></section>
      </div>
     </>}
     <div className={`mp-fields ${step===1?'mp-fields-basic':''}`}>
      {(step===1?basics:extras).map(([key,label,unit])=><div className="mp-field" key={key}>
       <div className="mp-field-label"><label htmlFor={`mp-${key}`}>{label}</label><PlannerCostHelp field={key} label={label}/></div>
       <div className="mp-input-wrap"><FormattedNumberInput id={`mp-${key}`} value={draft[key]} onValueChange={value=>update(key,value)} placeholder={key==='quantity'?'수량 입력':unit==='%'?'비율 입력':'금액 입력'}/><span>{unit}</span></div>
       {step===2&&<div className="mp-quick-costs"><button type="button" onClick={()=>useExample(key as keyof typeof plannerExamples)}>참고값 넣기</button><button type="button" onClick={()=>update(key,'0')}>비용 없음 · 0{unit==='%'?'%':'원'}</button>{exampleFields.includes(key)&&<small>참고값 적용</small>}</div>}
       {key==='returnRate'&&Number(draft.returnRate)>0&&<div className="mp-return-handling"><div className="mp-field-label"><label htmlFor="mp-returnHandling">반품 한 건 처리비</label><PlannerCostHelp field="returnHandling" label="반품 한 건 처리비"/></div><div className="mp-input-wrap"><FormattedNumberInput id="mp-returnHandling" value={draft.returnHandling} onValueChange={value=>update('returnHandling',value)} placeholder="처리비 입력"/><span>원 / 건</span></div><p>개당 반품 비용: {returnCostMissing?'처리비 입력 필요':live?money(live.returns):'—'}</p></div>}
      </div>)}
     </div>
     {step===1&&<aside className={`mp-stock-cost ${overBudget?'is-over':''}`} aria-live="polite">
      <div className="mp-stock-top"><div><span>총 상품 원가</span><b>{stockCost!==null?money(stockCost):'—'}</b></div><div><span>홍보 전 전체 이익</span><b>{live?money(live.marginTotal):'—'}</b></div><div><span>남는 예산</span><b className={live&&hasBudget?(live.remaining<0?'mp-negative':live.remaining>0?'mp-positive':'mp-neutral'):'mp-neutral'}>{live&&hasBudget?money(live.remaining):'—'}</b></div></div>
      {overBudget&&<p role="alert">상품 구매비가 예산보다 많아요.</p>}
     </aside>}
     {step===2&&<aside className={`mp-actual-cost ${live&&live.profit<0?'is-loss':''}`} aria-live="polite"><div className="mp-cost-change"><span><small>처음 원가</small><b>{money(Number(draft.cost))}</b></span><ArrowRight size={22} aria-label="비용 추가 후"/><span><small>비용 포함 원가</small><strong>{live?money(live.unitCost):'—'}</strong></span></div><small>홍보 전 기준{missing>0?` · 미입력 비용 ${missing}개 제외`:''}{returnCostMissing?' · 반품 처리비 입력 필요':''}{exampleFields.length>0?' · 참고값 포함':''}</small></aside>}
     {error&&<p className="mp-error" role="alert">{error}</p>}
     <div className="mp-actions">{step===2&&<button type="button" className="mp-secondary" onClick={()=>move(1)}>이전 단계</button>}<button type="submit" className="mp-primary">{step===1?'다음 · 비용 확인':'결과 보기'}<ArrowRight size={17}/></button></div>
    </motion.form></AnimatePresence>:report&&(step===4?<SellingPreparation quantity={report.input.quantity} months={report.months} onBack={()=>move(3)}/>:<BeginnerProfitReport name={report.name} months={report.months} input={report.input} result={report.result} exampleFields={report.examples} onEdit={()=>move(1)} onMoreCosts={()=>move(4)}/>)}
    {step<3&&<span className="mp-ipad-home" aria-hidden="true"/>}
   </section>
  </main>
 </div>;
}
