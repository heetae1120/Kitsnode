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
import {marketingPlan,budgetPurchaseCapacity,type MarketingPlanInput} from '@/lib/marketing-plan';
import {plannerExamples} from '@/lib/planner-examples';
import {plannerMarketFees} from '@/lib/planner-market-fees';
import {plannerLiveCosts} from '@/lib/planner-live-costs';
import '@/app/tools/marketing-planner.css';

const basics=[
 ['price','판매가','원 / 개'],
 ['cost','상품 원가','원 / 개'],
 ['quantity','판매수량','개'],
] as const;
const extras=[
 ['packaging','포장·기타 비용','원 / 개'],
 ['logistics','배송·물류비','원 / 개'],
 ['feePercent','판매 수수료','%'],
 ['returnRate','예상 반품률','%'],
] as const;
type Draft={months:string;name:string;available:string;price:string;cost:string;quantity:string;feePercent:string;logistics:string;packaging:string;returnRate:string;returnHandling:string};
const empty:Draft={months:'',name:'',available:'',price:'',cost:'',quantity:'',feePercent:'',logistics:'',packaging:'',returnRate:'',returnHandling:''};
const sampleInput:MarketingPlanInput={price:30000,cost:12000,quantity:100,available:3000000,feePercent:5,logistics:3000,packaging:1000,returns:0,certification:0,fixed:0};
const previewReport={name:'미리보기 예시',months:3,input:sampleInput,result:marketingPlan(sampleInput),examples:[]};
const money=(value:number)=>`${Math.round(value).toLocaleString('ko-KR')}원`;
export function MarketingPlanner({mode='starter'}:{mode?:'starter'|'player'}){
 const [draft,setDraft]=useState<Draft>(empty);
 const [step,setStep]=useState(1);
 const [market,setMarket]=useState('');
 const selectedMarket=plannerMarketFees.find(item=>item.id===market);
 const [direction,setDirection]=useState(1);
 const reducedMotion=useReducedMotion();
 const [error,setError]=useState('');
 const [report,setReport]=useState<{name:string;months:number;input:MarketingPlanInput;result:ReturnType<typeof marketingPlan>;examples:string[]}|null>(null);
 const focus=useRef<HTMLElement>(null);
 const goalDialog=useRef<HTMLDialogElement>(null);
 const previewStage = useDraftPreviewStage('/tools/');
 useEffect(()=>{if(previewStage){const n=Number(previewStage);if(n>=3)setReport(previewReport);setStep(n);}},[previewStage]);
 const update=(key:keyof Draft,value:string)=>{setDraft(previous=>({...previous,[key]:value}));setExampleFields(keys=>keys.filter(field=>field!==key));setError('');};
 const basicReady=basics.every(([key])=>draft[key]!==''&&Number.isFinite(Number(draft[key]))&&Number(draft[key])>=0)&&Number(draft.price)>0&&Number.isSafeInteger(Number(draft.quantity))&&Number(draft.quantity)>0;
 const hasBudget=draft.available!=='';
 const purchaseCapacity=hasBudget&&draft.cost!==''?budgetPurchaseCapacity(Number(draft.available),Number(draft.cost)):null;
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
 function submit(event:FormEvent,goalConfirmed=false){
  event.preventDefault();
  if(step===1){
   if(!draft.name.trim()||!basicReady||!hasBudget||!Number.isFinite(Number(draft.available))||Number(draft.available)<0){setError('품목과 모든 금액·수량을 입력해 주세요. 판매가는 0보다 크게, 수량은 1개 이상의 정수로 입력하세요.');return;}
   move(2);return;
  }
  if(!market){setError('판매 수수료를 계산할 플랫폼을 선택해 주세요.');return;}
  if(missing){setError('비용을 입력하세요. 모르면 참고값을 넣을 수 있어요.');return;}
  if(returnCostMissing){setError('반품 한 건을 처리하는 비용도 입력하세요.');return;}
  if(!live){setError('입력값을 확인해 주세요. 수수료와 반품률은 0~100%여야 합니다.');return;}
  if(!goalConfirmed){goalDialog.current?.showModal();return;}
  if(!Number.isSafeInteger(Number(draft.months))||Number(draft.months)<1||Number(draft.months)>120){setError('목표 개월은 1~120개월의 정수로 입력하세요.');return;}
  try{
   goalDialog.current?.close();
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
    <span>판매수량<b>{draft.quantity?Number(draft.quantity).toLocaleString('ko-KR')+'개':'—'}</b></span>
    <span>한 개당 이익 · 홍보 전<b>{live?money(live.profit):'—'}</b></span>
    <span>남는 예산<b className={live&&hasBudget?(live.remaining<0?'mp-negative':live.remaining>0?'mp-positive':'mp-neutral'):'mp-neutral'}>{live&&hasBudget?money(live.remaining):'—'}</b></span>
   </div>
   {live&&live.profit<0&&<p role="alert"><TriangleAlert size={16}/>한 개 팔 때 {money(-live.profit)} 손해입니다.</p>}
  </aside>}
  <main className="mp-main">
   {step<3&&<header className="mp-intro"><h1>{mode==='player'?'어떤 검색어로 홍보할까요?':'진단 키트로 빠르게 진단해보기'}</h1></header>}
   {step<=3&&<ol className="mp-steps" aria-label="분석 진행 단계">{['상품과 자금','빠뜨린 비용 확인','결과'].map((label,index)=><li key={label} aria-current={step===index+1?'step':undefined} data-complete={step>index+1||undefined}><span className="mp-step-number">{step>index+1?<Check size={24}/>:String(index+1).padStart(2,'0')}</span><div><small>STEP {String(index+1).padStart(2,'0')}</small><b>{label}</b></div></li>)}</ol>}
   <section ref={focus} tabIndex={-1} className={`mp-workspace ${step>=3?'mp-workspace-report':'mp-ipad'}`} aria-label={step>=3?'수익성 평가 보고서':'수익성 분석 입력'}>
    {step<3&&<span className="mp-ipad-camera" aria-hidden="true"/>}
    {step<3?<AnimatePresence mode="wait" initial={false} custom={direction}><motion.form key={step} custom={direction} initial="enter" animate="center" exit="leave" variants={{enter:(d:number)=>({x:reducedMotion?0:d*80,opacity:reducedMotion?1:0,filter:reducedMotion?'none':'blur(4px)'}),center:{x:0,opacity:1,filter:'blur(0px)'},leave:(d:number)=>({x:reducedMotion?0:-d*60,opacity:reducedMotion?1:0,filter:reducedMotion?'none':'blur(3px)',pointerEvents:'none' as const})}} transition={{duration:reducedMotion?0:0.28,ease:[0.22,1,0.36,1]}} onSubmit={submit} noValidate>
     <div className="mp-section-heading"><span>STEP 0{step}</span><h2>{step===1?(mode==='player'?'상품과 자금을 입력하고 검색어·광고를 확인하세요':'간단하게 작성해주시면 빠르게 진단해드려요'):'원가 말고도 이런비용도 있습니다.'}</h2></div>
     {step===1&&<>
      <label className="mp-name">품목<input value={draft.name} onChange={event=>update('name',event.target.value)} placeholder="예: 가습기, 시계, 손난로" maxLength={100}/></label>
      <div className="mp-plan-row mp-plan-budget-only">
       <section className="mp-budget-input" aria-label="사용할 예산"><div className="mp-field"><div className="mp-field-label"><label htmlFor="mp-available">쓸 수 있는 전체 금액</label><PlannerCostHelp field="available" label="쓸 수 있는 전체 금액"/></div><div className="mp-input-wrap"><FormattedNumberInput id="mp-available" value={draft.available} onValueChange={value=>update('available',value)} placeholder="금액 입력"/><span>원</span></div></div></section>
      </div>
     </>}
     <div className={`mp-fields ${step===1?'mp-fields-basic':''}`}>
      {(step===1?basics:extras).map(([key,label,unit])=><div className="mp-field" key={key}>
       <div className="mp-field-label">{key==='feePercent'&&market!=='other'?<span>{label}</span>:<label htmlFor={`mp-${key}`}>{label}</label>}<PlannerCostHelp field={key} label={label}/></div>
       {key==='feePercent'&&<div className="mp-market-options" role="group" aria-label="판매 플랫폼">{plannerMarketFees.map(item=><button type="button" key={item.id} aria-pressed={market===item.id} onClick={()=>{setMarket(item.id);update('feePercent',item.rate);setExampleFields(keys=>[...new Set([...keys,'feePercent'])]);}}><span className={`mp-market-icon mp-market-${item.id}`} aria-hidden="true">{item.mark}</span><b>{item.name}</b><small>참고 {item.rate}%</small></button>)}<button type="button" aria-pressed={market==='other'} onClick={()=>{setMarket('other');update('feePercent','');}}><span className="mp-market-icon" aria-hidden="true">+</span><b>그 외</b><small>직접 입력</small></button></div>}
       {(key!=='feePercent'||market==='other')&&<div className="mp-input-wrap"><FormattedNumberInput id={`mp-${key}`} aria-describedby={key==='quantity'?'mp-quantity-capacity':undefined} value={draft[key]} onValueChange={value=>update(key,value)} placeholder={key==='quantity'?'수량 입력':unit==='%'?'비율 입력':'금액 입력'}/><span>{unit}</span></div>}
       {key==='quantity'&&<p id="mp-quantity-capacity" className="mp-quantity-capacity" aria-live="polite">{purchaseCapacity!==null?<>현재 예산으로 최대 <b>{purchaseCapacity.toLocaleString('ko-KR')}개</b> 구매 가능<small>상품 원가 기준 · 배송 등 추가 비용 제외</small></>:draft.cost!==''&&Number(draft.cost)===0?'원가가 0원이면 최대 구매수량을 계산할 수 없어요.':'예산과 상품 원가를 입력하면 구매 가능 수량을 확인할 수 있어요.'}</p>}
       {key==='feePercent'&&selectedMarket&&<p className="mp-market-applied">{selectedMarket.name} 참고율 <strong>{draft.feePercent}%</strong> 적용</p>}
       {key==='feePercent'&&<details className="mp-market-basis"><summary>참고율 기준</summary><p>계산용 참고값이며 실제 평균 수수료는 아니에요. 상품·판매자·유입 경로에 따라 달라요. 실제 요율은 ‘그 외’에 입력하세요. 월 이용료·물류비 등은 별도예요.</p>{selectedMarket&&<p>{selectedMarket.basis} · <a href={selectedMarket.source} target="_blank" rel="noreferrer">공식 안내</a></p>}</details>}
       {step===2&&key!=='feePercent'&&<div className="mp-quick-costs"><button type="button" onClick={()=>useExample(key as keyof typeof plannerExamples)}>참고값 넣기</button><button type="button" onClick={()=>update(key,'0')}>{key==='returnRate'?'예상수량 없음':'비용 없음 · 0원'}</button>{exampleFields.includes(key)&&<small>참고값 적용</small>}</div>}
       {key==='returnRate'&&Number(draft.returnRate)>0&&<div className="mp-return-handling"><div className="mp-field-label"><label htmlFor="mp-returnHandling">반품 한 건 처리비</label><PlannerCostHelp field="returnHandling" label="반품 한 건 처리비"/></div><div className="mp-input-wrap"><FormattedNumberInput id="mp-returnHandling" value={draft.returnHandling} onValueChange={value=>update('returnHandling',value)} placeholder="처리비 입력"/><span>원 / 건</span></div><p>개당 반품 비용: {returnCostMissing?'처리비 입력 필요':live?money(live.returns):'—'}</p></div>}
      </div>)}
     </div>
     {step===1&&<aside className="mp-sales-summary" aria-live="polite">
      <div><span>총 매출</span><b>{basicReady?money(Number(draft.price)*Number(draft.quantity)):'—'}</b></div><div><span>나에게 남을 이익</span><b className={live&&live.marginTotal<0?'mp-negative':''}>{live?money(live.marginTotal):'—'}</b></div>
      {overBudget&&<p role="alert">상품 구매비가 예산보다 많아요.</p>}
     </aside>}
     {step===2&&<aside className={`mp-actual-cost ${live&&live.profit<0?'is-loss':''}`} aria-live="polite"><div className="mp-cost-change"><span><small>처음 원가</small><b>{money(Number(draft.cost))}</b></span><ArrowRight size={22} aria-label="비용 추가 후"/><span><small>비용 포함 원가</small><strong>{live?money(live.unitCost):'—'}</strong></span><span className="mp-cost-delta"><small>추가되는 비용</small><strong>{live?`${live.unitCost-Number(draft.cost)>0?'+':''}${money(live.unitCost-Number(draft.cost))}`:'—'}</strong></span></div></aside>}
     {error&&<p className="mp-error" role="alert">{error}</p>}
     <div className="mp-actions">{step===2&&<button type="button" className="mp-secondary" onClick={()=>move(1)}>이전 단계</button>}<button type="submit" className="mp-primary">{step===1?'다음 · 비용 확인':'결과 보기'}<ArrowRight size={17}/></button></div>
    </motion.form></AnimatePresence>:report&&(step===4?<SellingPreparation quantity={report.input.quantity} months={report.months} onBack={()=>move(3)}/>:<BeginnerProfitReport initialPage={mode==='player'?1:0} name={report.name} months={report.months} input={report.input} result={report.result} exampleFields={report.examples} onEdit={()=>move(1)} onMoreCosts={()=>move(4)}/>)}
    {step<3&&<span className="mp-ipad-home" aria-hidden="true"/>}
   </section>
  </main>
  <dialog ref={goalDialog} className="mp-goal-dialog" aria-labelledby="mp-goal-title"><button type="button" className="mp-secondary" onClick={()=>goalDialog.current?.close()} aria-label="목표 개월 입력 닫기">닫기</button><form onSubmit={event=>submit(event,true)} noValidate><h2 id="mp-goal-title">목표 판매 개월을 넣어주시면<br/>진단해드리겠습니다</h2><label htmlFor="mp-months">목표 판매 개월</label><div className="mp-input-wrap"><FormattedNumberInput id="mp-months" value={draft.months} onValueChange={value=>update('months',value)} placeholder="개월 입력"/><span>개월</span></div>{error&&<p className="mp-error" role="alert">{error}</p>}<button type="submit" className="mp-primary">진단 결과 확인하기 <ArrowRight size={17}/></button></form></dialog>
 </div>;
}
