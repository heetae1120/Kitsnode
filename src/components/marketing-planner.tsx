"use client";
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {AnimatePresence,motion,useReducedMotion} from 'framer-motion';
import { useDraftPreviewStage } from '@/lib/draft-preview-stage';
import Link from 'next/link';
import {ArrowRight,ArrowUpRight,Check,TriangleAlert} from 'lucide-react';
import {FormattedNumberInput} from './formatted-number-input';
import {SellingPreparation} from './selling-preparation';
import {BeginnerProfitReport} from './beginner-profit-report';
import {PlannerCostHelp} from './planner-cost-help';
import {marketingPlan,budgetPurchaseCapacity,type MarketingPlanInput} from '@/lib/marketing-plan';
import {plannerExamples} from '@/lib/planner-examples';
import {plannerMarketFees} from '@/lib/planner-market-fees';
import {plannerLiveCosts} from '@/lib/planner-live-costs';
import {useDiagnosisInputGuide} from './use-diagnosis-input-guide';
import {PlayerIntroduction} from './player-introduction';
import '@/app/tools/marketing-planner.css';
import '@/app/tools/diagnosis-studio.css';

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
export function MarketingPlanner({mode:initialMode}:{mode?:'starter'|'player'}){
 const [selectedMode,setSelectedMode]=useState<'starter'|'player'|null>(initialMode??null);
 const [showPlayerIntro,setShowPlayerIntro]=useState(initialMode==='player');
 const [goalOpen,setGoalOpen]=useState(false);
 const mode=selectedMode??'starter';
 const [draft,setDraft]=useState<Draft>(empty);
 const [step,setStep]=useState(1);
 const [market,setMarket]=useState('');
 const selectedMarket=plannerMarketFees.find(item=>item.id===market);
 const [direction,setDirection]=useState(1);
 const reducedMotion=useReducedMotion();
 const [error,setError]=useState('');
 const [report,setReport]=useState<{name:string;months:number;input:MarketingPlanInput;result:ReturnType<typeof marketingPlan>;examples:string[]}|null>(null);
 const focus=useRef<HTMLElement>(null);
 const choiceHeading=useRef<HTMLHeadingElement>(null);
 const goalDialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{if(goalOpen)goalDialog.current?.querySelector<HTMLInputElement>('#mp-months')?.focus();},[goalOpen]);
 const guideRoot=useRef<HTMLDivElement>(null);
 const guideMessage=useDiagnosisInputGuide(guideRoot,selectedMode!==null&&!showPlayerIntro,JSON.stringify([draft,step,market]));
 const previewStage = useDraftPreviewStage(initialMode === 'player' ? '/tools/player/' : '/tools/');
 useEffect(()=>{if(previewStage&&previewStage!=='choice'){const n=previewStage==='3-keywords'?3:Number(previewStage);if(n>=3)setReport(previewReport);setStep(n);}},[previewStage]);
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
 function move(next:number){setDirection(next>step?1:-1);setStep(next);setError('');requestAnimationFrame(()=>{focus.current?.focus({preventScroll:true});const target=next===3?(focus.current?.querySelector('.mp-scroll-card')??focus.current):focus.current;target?.scrollIntoView({behavior:'smooth',block:'start'});});}
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
  if(!goalConfirmed){setGoalOpen(true);goalDialog.current?.showModal();return;}
  if(!Number.isSafeInteger(Number(draft.months))||Number(draft.months)<1||Number(draft.months)>120){setError('목표 개월은 1~120개월의 정수로 입력하세요.');return;}
  try{
   goalDialog.current?.close();setGoalOpen(false);
   const input:MarketingPlanInput={price:Number(draft.price),cost:Number(draft.cost),quantity:Number(draft.quantity),available:Number(draft.available),feePercent:Number(draft.feePercent),logistics:Number(draft.logistics),packaging:Number(draft.packaging),returns:live.returns,returnRate:Number(draft.returnRate),returnHandling:Number(draft.returnHandling),certification:0,fixed:0};
   setReport({name:draft.name.trim(),months:Number(draft.months),input,result:marketingPlan(input),examples:[...exampleFields]});move(3);
  }catch(e){setError(e instanceof Error?e.message:'입력값을 확인해 주세요.');}
 }

 function chooseMode(next:'starter'|'player'){
  setSelectedMode(next);setShowPlayerIntro(next==='player');setDraft(empty);setStep(1);setMarket('');setReport(null);setExampleFields([]);setError('');
  requestAnimationFrame(()=>{focus.current?.focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});});
 }
 if(selectedMode===null&&(!previewStage||previewStage==='choice'))return <div className="finance-dashboard mp-shell diagnosis-studio" data-preview-stage="choice" data-diagnosis-stage="choose">
  <DiagnosisHeader/>
  <main className="ds-choice" aria-labelledby="ds-choice-title">
   <h1 id="ds-choice-title" ref={choiceHeading} tabIndex={-1}>지금, 어느 단계에<br/><em>서 있나요?</em></h1>
   <div className="ds-choice-grid">
    <button type="button" className="ds-choice-card ds-starter" onClick={()=>chooseMode('starter')}><span className="ds-card-number">01 / 첫 판매 준비</span><span className="ds-choice-art ds-art-target" aria-hidden="true"><i/><b/></span><span className="ds-card-title">스타터</span><strong>판매가 처음이에요.</strong><span className="ds-card-description">판매 전에 필요한 금액과<br/>실제로 남는 이익을 확인하세요.</span><span className="ds-card-action">내 상품 진단하기 <ArrowUpRight size={25}/></span></button>
    <button type="button" className="ds-choice-card ds-player" onClick={()=>chooseMode('player')}><span className="ds-card-number">02 / 다음 성장 준비</span><span className="ds-choice-art ds-art-star" aria-hidden="true">{[0,45,90,135].map(angle=><i key={angle} style={{transform:`rotate(${angle}deg)`}}/>)}</span><span className="ds-card-title">플레이어</span><strong>판매 경험이 있어요.</strong><span className="ds-card-description">상품의 수익 구조를 점검하고<br/>검색어와 광고 방향을 확인하세요.</span><span className="ds-card-action">다음 광고 준비하기 <ArrowUpRight size={25}/></span></button>
   </div>
  </main>
 </div>;
 if(selectedMode==='player'&&showPlayerIntro&&!previewStage)return <div className="finance-dashboard mp-shell diagnosis-studio ds-flow"><DiagnosisHeader mode="player" onChoose={()=>{setSelectedMode(null);setShowPlayerIntro(false);window.scrollTo({top:0,behavior:'instant'});}}/><PlayerIntroduction onStart={()=>{setShowPlayerIntro(false);requestAnimationFrame(()=>{focus.current?.focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});});}}/></div>;
 return <div ref={guideRoot} className="finance-dashboard mp-shell diagnosis-studio ds-flow" data-preview-stage={step===3&&report&&previewStage==='3-keywords'?'3-keywords':String(step)} data-diagnosis-stage={step}>
  <DiagnosisHeader mode={mode} onChoose={()=>{setSelectedMode(null);requestAnimationFrame(()=>{choiceHeading.current?.focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});});}}/>
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
   <p className="ds-input-guide" role="status" aria-live="polite">{guideMessage}</p>
   {step<3&&<header className="mp-intro"><p className="ds-eyebrow">{mode==='player'?'플레이어 / 다음 광고 준비':'스타터 / 첫 판매 준비'}</p><p>입력한 숫자로 살펴보는 내 사업의 현재와 다음.</p></header>}
   {step<=3&&<ol className="mp-steps" aria-label="분석 진행 단계">{['상품과 자금','빠뜨린 비용','진단 결과'].map((label,index)=><li key={label} aria-current={step===index+1?'step':undefined} data-complete={step>index+1||undefined}><span className="mp-step-number">{step>index+1?<Check size={24}/>:String(index+1).padStart(2,'0')}</span><div><small>{String(index+1).padStart(2,'0')} 단계</small><b>{label}</b></div></li>)}</ol>}
   <section ref={focus} tabIndex={-1} className={`mp-workspace ${step>=3?'mp-workspace-report':'mp-ipad'}`} aria-label={step>=3?'수익성 평가 보고서':'수익성 분석 입력'}>
    {step<3&&<span className="mp-ipad-camera" aria-hidden="true"/>}
    {step<3?<AnimatePresence mode="wait" initial={false} custom={direction}><motion.form key={step} custom={direction} initial="enter" animate="center" exit="leave" variants={{enter:(d:number)=>({x:reducedMotion?0:d*80,opacity:reducedMotion?1:0,filter:reducedMotion?'none':'blur(4px)'}),center:{x:0,opacity:1,filter:'blur(0px)'},leave:(d:number)=>({x:reducedMotion?0:-d*60,opacity:reducedMotion?1:0,filter:reducedMotion?'none':'blur(3px)',pointerEvents:'none' as const})}} transition={{duration:reducedMotion?0:0.28,ease:[0.22,1,0.36,1]}} onSubmit={submit} noValidate>
     <div className="mp-section-heading"><div><span>{step===1?'01 / PRODUCT & CAPITAL':'02 / COST STRUCTURE'}</span><motion.h1 initial={reducedMotion?false:{clipPath:'inset(100% 0 0)',y:16}} animate={{clipPath:'inset(0)',y:0}} transition={{duration:.4,ease:[.22,1,.36,1]}}>{step===1?'판매 전, 수익부터 확인하세요.':'놓친 비용도 확인해보세요.'}</motion.h1></div><motion.svg className="ds-flow-symbol" viewBox="0 0 120 120" aria-hidden="true" initial={reducedMotion?false:{rotate:-65,scale:.85}} animate={{rotate:0,scale:1}} transition={{duration:.6,ease:[.22,1,.36,1]}}><circle cx="60" cy="60" r="43" fill="none" stroke="currentColor" strokeWidth="18" strokeDasharray="43 24"/><circle cx="60" cy="60" r="11" fill="currentColor"/></motion.svg></div>
     {step===1&&<>
      <div className="ds-product-capital"><label className="mp-name"><span className="ds-group-index">01 / 상품 기본 정보</span>품목<input value={draft.name} onChange={event=>update('name',event.target.value)} placeholder="예: 가습기, 시계, 손난로" maxLength={100}/></label>
      <div className="mp-plan-row mp-plan-budget-only">
       <section className="mp-budget-input" aria-label="사용할 예산"><span className="ds-group-index">02 / 준비 자금</span><div className="mp-field"><div className="mp-field-label"><label htmlFor="mp-available">쓸 수 있는 전체 금액</label><PlannerCostHelp field="available" label="쓸 수 있는 전체 금액"/></div><div className="mp-input-wrap"><FormattedNumberInput id="mp-available" value={draft.available} onValueChange={value=>update('available',value)} placeholder="금액 입력"/><span>원</span></div></div></section>
      </div></div>
     </>}
     <div className="ds-input-group"><div className="ds-group-heading"><span className="ds-group-index">{step===1?'03 / 판매 조건':'COST CHECKLIST'}</span><p>{step===1?'가격과 수량을 함께 확인하세요.':'실제 비용을 알면 입력하고, 모르면 참고값으로 시작하세요.'}</p></div><div className={`mp-fields ${step===1?'mp-fields-basic':''}`}>
      {(step===1?basics:extras).map(([key,label,unit])=><div className="mp-field" key={key} data-guide-field={key==='feePercent'?'판매 수수료':undefined} data-guide-complete={key==='feePercent'?Boolean(market&&draft.feePercent!==''):undefined}>
       <div className="mp-field-label">{key==='feePercent'&&market!=='other'?<span>{label}</span>:<label htmlFor={`mp-${key}`}>{label}</label>}<PlannerCostHelp field={key} label={label}/></div>
       {key==='feePercent'&&<div className="mp-market-options" role="group" aria-label="판매 플랫폼">{plannerMarketFees.map(item=><button type="button" key={item.id} aria-pressed={market===item.id} onClick={()=>{setMarket(item.id);update('feePercent',item.rate);setExampleFields(keys=>[...new Set([...keys,'feePercent'])]);}}><span className={`mp-market-icon mp-market-${item.id}`} aria-hidden="true">{item.mark}</span><b>{item.name}</b><small>참고 {item.rate}%</small></button>)}<button type="button" aria-pressed={market==='other'} onClick={()=>{setMarket('other');update('feePercent','');}}><span className="mp-market-icon" aria-hidden="true">+</span><b>그 외</b><small>직접 입력</small></button></div>}
       {(key!=='feePercent'||market==='other')&&<div className="mp-input-wrap"><FormattedNumberInput id={`mp-${key}`} aria-describedby={key==='quantity'?'mp-quantity-capacity':undefined} value={draft[key]} onValueChange={value=>update(key,value)} placeholder={key==='quantity'?'수량 입력':unit==='%'?'비율 입력':'금액 입력'}/><span>{unit}</span></div>}
       {key==='quantity'&&<p id="mp-quantity-capacity" className="mp-quantity-capacity" aria-live="polite">{purchaseCapacity!==null?<>현재 예산으로 최대 <b>{purchaseCapacity.toLocaleString('ko-KR')}개</b> 구매 가능<small>상품 원가 기준 · 배송 등 추가 비용 제외</small></>:draft.cost!==''&&Number(draft.cost)===0?'원가가 0원이면 최대 구매수량을 계산할 수 없어요.':'예산과 상품 원가를 입력하면 구매 가능 수량을 확인할 수 있어요.'}</p>}
       {key==='feePercent'&&selectedMarket&&<p className="mp-market-applied">{selectedMarket.name} 참고율 <strong>{draft.feePercent}%</strong> 적용</p>}
       {step===2&&key==='feePercent'&&<div className="mp-quick-costs"><button type="button" data-guide-example onClick={()=>{setMarket('other');useExample('feePercent');}}>참고값 넣기</button><small>간편 계산용 7% · 실제 수수료와 다를 수 있어요.</small></div>}
       {step===2&&key!=='feePercent'&&<div className="mp-quick-costs"><button type="button" onClick={()=>useExample(key as keyof typeof plannerExamples)}>참고값 넣기</button><button type="button" onClick={()=>update(key,'0')}>{key==='returnRate'?'예상수량 없음':'비용 없음 · 0원'}</button>{exampleFields.includes(key)&&<small>참고값 적용</small>}</div>}
       {key==='returnRate'&&Number(draft.returnRate)>0&&<div className="mp-return-handling"><div className="mp-field-label"><label htmlFor="mp-returnHandling">반품 한 건 처리비</label><PlannerCostHelp field="returnHandling" label="반품 한 건 처리비"/></div><div className="mp-input-wrap"><FormattedNumberInput id="mp-returnHandling" value={draft.returnHandling} onValueChange={value=>update('returnHandling',value)} placeholder="처리비 입력"/><span>원 / 건</span></div><div className="mp-quick-costs"><button type="button" data-guide-example onClick={()=>useExample('returnHandling')}>참고값 넣기</button><button type="button" onClick={()=>update('returnHandling','0')}>비용 없음 · 0원</button></div><p>개당 반품 비용: {returnCostMissing?'처리비 입력 필요':live?money(live.returns):'—'}</p></div>}
      </div>)}
     </div>
     </div>
     {step===1&&<aside className="mp-sales-summary" aria-live="polite">
      <div><span>총 매출</span><b>{basicReady?money(Number(draft.price)*Number(draft.quantity)):'—'}</b></div><div><span>나에게 남을 이익</span><b className={live&&live.marginTotal<0?'mp-negative':''}>{live?money(live.marginTotal):'—'}</b></div>
      {overBudget&&<p role="alert">상품 구매비가 예산보다 많아요.</p>}
     </aside>}
     {step===2&&<aside className={`mp-actual-cost ${live&&live.profit<0?'is-loss':''}`} aria-live="polite"><div className="mp-cost-change"><span><small>처음 원가</small><b>{money(Number(draft.cost))}</b></span><ArrowRight size={22} aria-label="비용 추가 후"/><span><small>비용 포함 원가</small><strong>{live?money(live.unitCost):'—'}</strong></span><span className="mp-cost-delta"><small>추가되는 비용</small><strong>{live?`${live.unitCost-Number(draft.cost)>0?'+':''}${money(live.unitCost-Number(draft.cost))}`:'—'}</strong></span></div></aside>}
     {error&&<p className="mp-error" role="alert">{error}</p>}
     <div className="mp-actions">{step===2&&<button type="button" className="mp-secondary" onClick={()=>move(1)}>이전 단계</button>}<button type="submit" className="mp-primary">{step===1?'다음 단계 · 비용 확인':'진단 결과 확인하기'}<ArrowRight size={17}/></button></div>
    </motion.form></AnimatePresence>:report&&(step===4?<SellingPreparation quantity={report.input.quantity} months={report.months} onBack={()=>move(3)}/>:<BeginnerProfitReport key={previewStage||'visitor'} initialPage={previewStage==='3-keywords'?1:previewStage==='3'?0:mode==='player'?1:0} name={report.name} months={report.months} input={report.input} result={report.result} exampleFields={report.examples} onEdit={()=>move(1)} onMoreCosts={()=>move(4)}/>)}
    {step<3&&<span className="mp-ipad-home" aria-hidden="true"/>}
   </section>
  </main>
  <dialog ref={goalDialog} className="mp-goal-dialog ds-goal-overlay" aria-labelledby="mp-goal-title" onClose={()=>setGoalOpen(false)} onClick={event=>{if(event.target===event.currentTarget)goalDialog.current?.close();}}><AnimatePresence>{goalOpen&&<motion.form key="goal" initial={reducedMotion?false:{opacity:0,y:36,scale:.97}} animate={{opacity:1,y:0,scale:1}} transition={{duration:reducedMotion?0:.45,ease:[.22,1,.36,1]}} onSubmit={event=>submit(event,true)} noValidate><h2 id="mp-goal-title">목표 판매 개월을 넣어주시면<br/>진단해드리겠습니다</h2><label htmlFor="mp-months" className="ds-sr-only">목표 판매 개월</label><div className="mp-input-wrap"><FormattedNumberInput id="mp-months" value={draft.months} onValueChange={value=>update('months',value)} placeholder="개월 입력"/><span>개월</span></div>{error&&<p className="mp-error" role="alert">{error}</p>}<button type="submit" className="mp-primary">진단 결과 확인하기 <ArrowRight size={20}/></button></motion.form>}</AnimatePresence></dialog>
 </div>;
}

function DiagnosisHeader({mode,onChoose}:{mode?:'starter'|'player';onChoose?:()=>void}){
 return <header className="ds-header"><Link href="/tools/start/" className="ds-wordmark" aria-label="키츠노드 홈">kitsnode<span>®</span></Link><span className="ds-header-note">감이 아닌 숫자로,<br/>다음 판매를 준비합니다.</span><nav aria-label="진단 메뉴">{mode&&<><span className="ds-mode-label">{mode==='starter'?'스타터':'플레이어'}</span><button type="button" onClick={onChoose}>유형 바꾸기 <ArrowUpRight size={16}/></button></>}<Link href="/tools/start/">홈으로 <ArrowUpRight size={16}/></Link></nav></header>;
}
