"use client";
import {BrandWordmark} from './brand-wordmark';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {AnimatePresence,motion,useReducedMotion} from 'framer-motion';
import { useDraftPreviewStage } from '@/lib/draft-preview-stage';
import Link from 'next/link';
import {saveMemberReturn} from '@/lib/member-return';
import {ArrowRight,ArrowUpRight,Check,TriangleAlert} from 'lucide-react';
import {FormattedNumberInput} from './formatted-number-input';
import {SellingPreparation} from './selling-preparation';
import {BeginnerProfitReport} from './beginner-profit-report';
import {useDiagnosisBack} from './use-diagnosis-back';
import {KeywordBudgetReport} from './keyword-budget-report';
import {DiagnosisDownload} from './diagnosis-download';
import {PlannerCostHelp} from './planner-cost-help';
import {marketingPlan,budgetPurchaseCapacity,type MarketingPlanInput} from '@/lib/marketing-plan';
import {plannerExamples} from '@/lib/planner-examples';
import {plannerMarketFees} from '@/lib/planner-market-fees';
import {plannerLiveCosts} from '@/lib/planner-live-costs';
import {useDiagnosisInputGuide} from './use-diagnosis-input-guide';
import {PlayerIntroduction} from './player-introduction';
import {PlayerPurposeDialog,type PlayerPurpose} from './player-purpose-dialog';
import '@/app/tools/marketing-planner.css';
import '@/app/tools/diagnosis-studio.css';

const basics=[
 ['price','판매가','원 / 개'],
 ['cost','상품 원가','원 / 개'],
 ['quantity','재고','개'],
] as const;
const extras=[
 ['packaging','포장·기타 비용','원 / 개'],
 ['logistics','배송·물류비','원 / 개'],
 ['feePercent','판매 수수료','%'],
 ['returnRate','예상 반품률','%'],
 ['creativeCost','상세페이지 및 썸네일 비용','원 / 전체'],
] as const;
type Draft={months:string;name:string;available:string;price:string;cost:string;quantity:string;feePercent:string;logistics:string;packaging:string;returnRate:string;returnHandling:string;creativeCost:string};
const empty:Draft={months:'',name:'',available:'',price:'',cost:'',quantity:'',feePercent:'',logistics:'',packaging:'',returnRate:'',returnHandling:'',creativeCost:''};
const sampleInput:MarketingPlanInput={price:30000,cost:12000,quantity:100,available:3000000,feePercent:5,logistics:3000,packaging:1000,returns:0,certification:0,fixed:0};
const previewReport={name:'미리보기 예시',months:3,input:sampleInput,result:marketingPlan(sampleInput),examples:[]};
const money=(value:number)=>`${Math.round(value).toLocaleString('ko-KR')}원`;
const enteredNumber=(value:string)=>value!==''&&Number.isFinite(Number(value))?Number(value):null;
export function MarketingPlanner({mode:initialMode}:{mode?:'starter'|'player'}){
 const [selectedMode,setSelectedMode]=useState<'starter'|'player'|null>(initialMode??null);
 const [showPlayerIntro,setShowPlayerIntro]=useState(initialMode==='player');
 const [playerPurpose,setPlayerPurpose]=useState<PlayerPurpose|null>(null);
 const [libraryOpen,setLibraryOpen]=useState(false);
 const [adCheck,setAdCheck]=useState(false);
 const [keywordInput,setKeywordInput]=useState('');
 const [adKeyword,setAdKeyword]=useState('');
 const [returnToKeywords,setReturnToKeywords]=useState(false);
 const stickySummary=useRef<HTMLDivElement>(null);
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
 const goalContinuation=useRef<(()=>void)|null>(null);
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
 if(basicReady){try{live=plannerLiveCosts({price:Number(draft.price),cost:Number(draft.cost),quantity:Number(draft.quantity),available:Number(draft.available),feePercent:Number(draft.feePercent),logistics:Number(draft.logistics),packaging:Number(draft.packaging),returnRate:Number(draft.returnRate),returnHandling:Number(draft.returnHandling),fixed:Number(draft.creativeCost)});}catch{}}
 const [exampleFields,setExampleFields]=useState<string[]>([]);
 const useExample=(key:keyof typeof plannerExamples)=>{setDraft(d=>({...d,[key]:plannerExamples[key],...(key==='returnRate'&&d.returnHandling===''?{returnHandling:plannerExamples.returnHandling}:{})}));setExampleFields(keys=>[...new Set([...keys,key,...(key==='returnRate'?['returnHandling']:[])])]);setError('');};
 const missing=extras.filter(([key])=>draft[key]==='').length;
 const returnCostMissing=Number(draft.returnRate)>0&&draft.returnHandling==='';
 const overBudget=hasBudget&&stockCost!==null&&stockCost>Number(draft.available);
 function move(next:number){if(next===3)setReturnToKeywords(step===4);setDirection(next>step?1:-1);setStep(next);setError('');requestAnimationFrame(()=>{focus.current?.focus({preventScroll:true});const target=next===3?(focus.current?.querySelector('.mp-scroll-card')??focus.current):focus.current;target?.scrollIntoView({behavior:'smooth',block:'start'});});}
 function submit(event:FormEvent){
  event.preventDefault();
  if(step===1){
   if(!draft.name.trim()||!basicReady||!hasBudget||!Number.isFinite(Number(draft.available))||Number(draft.available)<0){setError('품목과 모든 금액·수량을 입력해 주세요. 판매가는 0보다 크게, 수량은 1개 이상의 정수로 입력하세요.');return;}
   move(2);return;
  }
  if(!market){setError('판매 수수료를 계산할 플랫폼을 선택해 주세요.');return;}
  if(missing){setError('비용을 입력하세요. 모르면 참고값을 넣을 수 있어요.');return;}
  if(returnCostMissing){setError('반품 한 건을 처리하는 비용도 입력하세요.');return;}
  if(!live){setError('입력값을 확인해 주세요. 수수료와 반품률은 0~100%여야 합니다.');return;}
  try{
   goalDialog.current?.close();setGoalOpen(false);
   const input:MarketingPlanInput={price:Number(draft.price),cost:Number(draft.cost),quantity:Number(draft.quantity),available:Number(draft.available),feePercent:Number(draft.feePercent),logistics:Number(draft.logistics),packaging:Number(draft.packaging),returns:live.returns,returnRate:Number(draft.returnRate),returnHandling:Number(draft.returnHandling),certification:0,fixed:Number(draft.creativeCost)};
   setReport({name:draft.name.trim(),months:0,input,result:marketingPlan(input),examples:[...exampleFields]});move(3);
  }catch(e){setError(e instanceof Error?e.message:'입력값을 확인해 주세요.');}
 }

 function requestMonths(proceed:()=>void){
  goalContinuation.current=proceed;setError('');setGoalOpen(true);goalDialog.current?.showModal();
 }
 function confirmMonths(event:FormEvent){
  event.preventDefault();const months=Number(draft.months);
  if(!Number.isSafeInteger(months)||months<1||months>120){setError('목표 개월은 1~120개월의 정수로 입력하세요.');return;}
  setReport(previous=>previous?{...previous,months}:previous);setError('');
  const proceed=goalContinuation.current;goalContinuation.current=null;
  goalDialog.current?.close();setGoalOpen(false);proceed?.();
 }
 function chooseMode(next:'starter'|'player'){
  setPlayerPurpose(null);
  setSelectedMode(next);setShowPlayerIntro(next==='player');setDraft(empty);setStep(1);setMarket('');setReport(null);setExampleFields([]);setError('');
  requestAnimationFrame(()=>{focus.current?.focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});});
 }
 function backToChoice(){
  setSelectedMode(null);setShowPlayerIntro(false);setPlayerPurpose(null);
  requestAnimationFrame(()=>{choiceHeading.current?.focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});});
 }
 function closeAdCheck(){
  setAdCheck(false);setAdKeyword('');
  requestAnimationFrame(()=>choiceHeading.current?.focus());
 }
 useDiagnosisBack(libraryOpen||adCheck||selectedMode!==null,()=>{
  if(adCheck){
   if(adKeyword){setAdKeyword('');document.getElementById('ds-ad-keyword')?.focus();}
   else closeAdCheck();
   return;
  }
  if(showPlayerIntro&&playerPurpose){setPlayerPurpose(null);return;}
  if(step>1){move(step-1);return;}
  if(selectedMode==='player'&&!showPlayerIntro){setShowPlayerIntro(true);return;}
  backToChoice();
 },!previewStage);
 useEffect(()=>{
  const bar=stickySummary.current;
  const shell=bar?.parentElement;
  if(!bar||!shell)return;
  const sync=()=>shell.style.setProperty('--ds-sticky-offset',bar.offsetHeight+16+'px');
  sync();
  const observer=new ResizeObserver(sync);
  observer.observe(bar);
  return ()=>observer.disconnect();
 },[selectedMode,showPlayerIntro,previewStage]);
 if(adCheck)return <div className="finance-dashboard mp-shell diagnosis-studio ds-flow ds-ad-check">
  <DiagnosisHeader/>
  <main className="mp-main">
   <button type="button" className="mp-secondary" onClick={closeAdCheck}>이전 · 진단 메뉴</button>
   <h1>광고 체크하기</h1>
   <form className="ds-ad-check-form" onSubmit={event=>{event.preventDefault();setAdKeyword(keywordInput.trim());}}>
    <label htmlFor="ds-ad-keyword">키워드를 입력하세요</label>
    <div><input id="ds-ad-keyword" required maxLength={100} value={keywordInput} onChange={event=>setKeywordInput(event.target.value)}/><button type="submit" className="mp-primary" disabled={!keywordInput.trim()}>분석하기</button></div>
   </form>
   {adKeyword&&<article className="mp-story"><KeywordBudgetReport key={adKeyword} productName={adKeyword} keywordOnly/></article>}
  </main>
 </div>;
 if(selectedMode===null&&(!previewStage||previewStage==='choice'))return <div className="finance-dashboard mp-shell diagnosis-studio" data-preview-stage="choice" data-diagnosis-stage="choose">
  <DiagnosisHeader/>
  <main className="ds-choice" aria-labelledby="ds-choice-title">
   <h1 id="ds-choice-title" ref={choiceHeading} tabIndex={-1}>지금, 어느 단계에<br/><em>서 있나요?</em></h1>
   <div className="ds-choice-grid">
    <button type="button" className="ds-choice-card ds-starter" onClick={()=>chooseMode('starter')}><span className="ds-card-number">01 / 첫 판매 준비</span><span className="ds-choice-art ds-art-target" aria-hidden="true"><i/><b/></span><span className="ds-card-title">스타터</span><strong>판매가 처음이에요.</strong><span className="ds-card-description">판매 전에 필요한 금액과<br/>실제로 남는 이익을 확인하세요.</span><span className="ds-card-action">내 상품 진단하기 <ArrowUpRight size={25}/></span></button>
    <button type="button" className="ds-choice-card ds-player" onClick={()=>chooseMode('player')}><span className="ds-card-number">02 / 다음 성장 준비</span><span className="ds-choice-art ds-art-star" aria-hidden="true">{[0,45,90,135].map(angle=><i key={angle} style={{transform:`rotate(${angle}deg)`}}/>)}</span><span className="ds-card-title">플레이어</span><strong>판매 경험이 있어요.</strong><span className="ds-card-description">상품의 수익 구조를 점검하고<br/>앞으로의 판매 방향을 함께 정리하세요.</span><span className="ds-card-action">현 상태 진단하기 <ArrowUpRight size={25}/></span></button>
    <button type="button" className="ds-choice-card ds-shortcut-card" aria-label="광고 체크하기" onClick={()=>{setAdCheck(true);requestAnimationFrame(()=>document.getElementById('ds-ad-keyword')?.focus());}}>
     <span className="ds-card-number">키워드 광고 분석</span>
     <span className="ds-choice-art ds-art-keyword" aria-hidden="true"><i/><i/><i/></span>
     <span className="ds-card-title">광고 체크</span>
     <strong>검색어와 클릭 비용을 확인해요.</strong>
     <span className="ds-card-description">키워드를 입력해 CPC와 관련 검색어를 살펴보세요.</span>
     <span className="ds-card-action">광고 체크하기 <ArrowUpRight size={25}/></span>
    </button>
    <DiagnosisDownload onLibraryOpenChange={setLibraryOpen} libraryTrigger={<>
     <span className="ds-card-number">저장한 진단 결과</span>
     <span className="ds-choice-art ds-art-library" aria-hidden="true"><i/><i/><i/></span>
     <span className="ds-card-title">내 진단서</span>
     <strong>저장한 진단을 다시 확인해요.</strong>
     <span className="ds-card-description">지난 결과를 열고 진단서를 내려받으세요.</span>
     <span className="ds-card-action">내 진단서 보러가기 <ArrowUpRight size={25}/></span>
    </>}/>
   </div>
  </main>
 </div>;
 if(selectedMode==='player'&&showPlayerIntro&&!previewStage){
  return <div className="finance-dashboard mp-shell diagnosis-studio ds-flow"><DiagnosisHeader mode="player" onChoose={backToChoice}/>{playerPurpose?<PlayerIntroduction onStart={()=>{setShowPlayerIntro(false);requestAnimationFrame(()=>{focus.current?.focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});});}}/>:<PlayerPurposeDialog onSelect={setPlayerPurpose} onBack={backToChoice}/>}</div>;
 }
 const completedReport=step>=3?report:null;
 const summaryInput=completedReport?.input;
 const price=summaryInput?.price??enteredNumber(draft.price);
 const originalCost=summaryInput?.cost??enteredNumber(draft.cost);
 const quantity=summaryInput?.quantity??enteredNumber(draft.quantity);
 const budget=summaryInput?.available??enteredNumber(draft.available);
 const unitCost=completedReport
  ?completedReport.result.variable+completedReport.result.fixed/completedReport.input.quantity
  :live?.unitCost??(step===1?originalCost:null);
 const unitProfit=price!==null&&unitCost!==null?price-unitCost:null;
 const itemName=completedReport?.name??draft.name.trim();
 const hasLoss=unitProfit!==null&&unitProfit<0;
 return <div ref={guideRoot} className="finance-dashboard mp-shell diagnosis-studio ds-flow" data-preview-stage={step===3&&report&&previewStage==='3-keywords'?'3-keywords':String(step)} data-diagnosis-stage={step}>
  <div className="ds-sticky-summary" ref={stickySummary}>
  <DiagnosisHeader mode={mode} onChoose={()=>{setSelectedMode(null);requestAnimationFrame(()=>{choiceHeading.current?.focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});});}}/>
  {(step<3||mode==='starter')&&<aside className={`mp-live-bar ${hasLoss?'is-loss':''}`} aria-label="실시간 상품 손익" aria-live="polite">
   <div className="mp-live-values">
    <span className="ds-live-item">품목<b title={itemName||undefined}>{itemName||'—'}</b></span>
    <span>판매가<b>{price===null?'—':money(price)}</b></span>
    <span>원가<b>{unitCost===null?'—':money(unitCost)}</b>{step>=2&&unitCost!==null&&originalCost!==null&&<small className="ds-live-cost-delta">추가 된 비용 +{money(Math.max(0,unitCost-originalCost))}</small>}</span>
    <span>재고<b>{quantity===null?'—':quantity.toLocaleString('ko-KR')+'개'}</b></span>
    <span>예산<b>{budget===null?'—':money(budget)}</b></span>
    <span>개당 이익<b className={unitProfit===null?undefined:hasLoss?'mp-negative':unitProfit>0?'ds-profit-positive':'mp-neutral'}>{unitProfit===null?'—':money(unitProfit)}</b></span>
   </div>
   {unitProfit!==null&&hasLoss&&<p role="alert"><TriangleAlert size={16}/>한 개 팔 때 {money(-unitProfit)} 손해입니다.</p>}
  </aside>}
  </div>
  <main className="mp-main">
   <p className="ds-input-guide" role="status" aria-live="polite">{guideMessage}</p>
   {step<=3&&<ol className="mp-steps" aria-label="분석 진행 단계">{['상품과 자금','빠뜨린 비용','진단 결과'].map((label,index)=><li key={label} aria-current={step===index+1?'step':undefined} data-complete={step>index+1||undefined}><span className="mp-step-number">{step>index+1?<Check size={24}/>:String(index+1).padStart(2,'0')}</span><div><small>{String(index+1).padStart(2,'0')} 단계</small><b>{label}</b></div></li>)}</ol>}
   <section ref={focus} tabIndex={-1} className={`mp-workspace ${step>=3?'mp-workspace-report':'mp-ipad'}`} aria-label={step>=3?'수익성 평가 보고서':'수익성 분석 입력'}>
    {step<3&&<span className="mp-ipad-camera" aria-hidden="true"/>}
    {step<3?<AnimatePresence mode="wait" initial={false} custom={direction}><motion.form key={step} custom={direction} initial="enter" animate="center" exit="leave" variants={{enter:(d:number)=>({x:reducedMotion?0:d*80,opacity:reducedMotion?1:0,filter:reducedMotion?'none':'blur(4px)'}),center:{x:0,opacity:1,filter:'blur(0px)'},leave:(d:number)=>({x:reducedMotion?0:-d*60,opacity:reducedMotion?1:0,filter:reducedMotion?'none':'blur(3px)',pointerEvents:'none' as const})}} transition={{duration:reducedMotion?0:0.28,ease:[0.22,1,0.36,1]}} onSubmit={submit} noValidate>
     <div className="mp-section-heading"><div><span>{step===1?'01 / PRODUCT & CAPITAL':'02 / COST STRUCTURE'}</span><motion.h1 initial={reducedMotion?false:{clipPath:'inset(100% 0 0)',y:16}} animate={{clipPath:'inset(0)',y:0}} transition={{duration:.4,ease:[.22,1,.36,1]}}>{step===1?'판매 전, 수익부터 확인하세요.':'놓친 비용도 확인해보세요.'}</motion.h1></div><motion.svg className="ds-flow-symbol" viewBox="0 0 120 120" aria-hidden="true" initial={reducedMotion?false:{rotate:-65,scale:.85}} animate={{rotate:0,scale:1}} transition={{duration:.6,ease:[.22,1,.36,1]}}><circle cx="60" cy="60" r="43" fill="none" stroke="currentColor" strokeWidth="18" strokeDasharray="43 24"/><circle cx="60" cy="60" r="11" fill="currentColor"/></motion.svg></div>
     {step===1&&<>
      <div className="ds-product-capital"><label className="mp-name"><span className="ds-group-index">01 / 상품 기본 정보</span>품목<input value={draft.name} onChange={event=>update('name',event.target.value)} placeholder="예: 가습기, 시계, 손난로" maxLength={100}/></label>
      <div className="mp-plan-row mp-plan-budget-only">
       <section className="mp-budget-input" aria-label="사용할 예산"><span className="ds-group-index">02 / 예산</span><div className="mp-field"><div className="mp-field-label"><label htmlFor="mp-available">이번 상품에 사용할 금액</label><PlannerCostHelp field="available" label="이번 상품에 사용할 금액"/></div><div className="mp-input-wrap"><FormattedNumberInput aria-describedby="mp-help-available" id="mp-available" value={draft.available} onValueChange={value=>update('available',value)} placeholder="금액 입력"/><span>원</span></div></div></section>
      </div></div>
     </>}
     <div className="ds-input-group"><div className="ds-group-heading"><span className="ds-group-index">{step===1?'03 / 판매 조건':'COST CHECKLIST'}</span><p>{step===1?'가격과 수량을 함께 확인하세요.':'실제 비용을 알면 입력하고, 모르면 참고값으로 시작하세요.'}</p></div><div className={`mp-fields ${step===1?'mp-fields-basic':''}`}>
      {(step===1?basics:extras).map(([key,label,unit])=><div className={`mp-field ${key==='feePercent'?'mp-fee-field':''}`} key={key} data-guide-field={key==='feePercent'?'판매 수수료':undefined} data-guide-complete={key==='feePercent'?Boolean(market&&draft.feePercent!==''):undefined}>
       <div className="mp-field-label"><label htmlFor={`mp-${key}`}>{label}</label><PlannerCostHelp field={key} label={label}/></div>
       {key==='feePercent'&&<div className="mp-fee-control"><div className="mp-market-options" role="group" aria-label="판매 플랫폼">{plannerMarketFees.map(item=><button type="button" key={item.id} aria-pressed={market===item.id} onClick={()=>{setMarket(item.id);update('feePercent',item.rate);setExampleFields(keys=>[...new Set([...keys,'feePercent'])]);}}><span className={`mp-market-icon mp-market-${item.id}`} aria-hidden="true">{item.id==='coupang'?<img src={(process.env.NEXT_PUBLIC_BASE_PATH||'')+'/brand/coupang-official.jpg'} width={72} height={72} alt=""/>:item.mark}</span><b>{item.name}</b></button>)}<button type="button" aria-pressed={market==='other'} onClick={()=>{setMarket('other');update('feePercent','');}}><span className="mp-market-icon" aria-hidden="true">+</span><b>그 외</b></button></div><div className="mp-input-wrap"><FormattedNumberInput id="mp-feePercent" aria-describedby="mp-help-feePercent" value={draft.feePercent} readOnly={market!=='other'} onValueChange={value=>update('feePercent',value)} placeholder="수수료"/><span>%</span></div></div>}
       {key!=='feePercent'&&key!=='creativeCost'&&<div className="mp-input-wrap"><FormattedNumberInput id={`mp-${key}`} aria-describedby={`mp-help-${key}${key==='quantity'?' mp-quantity-capacity':''}`} value={draft[key]} onValueChange={value=>update(key,value)} placeholder={key==='quantity'?'수량 입력':unit==='%'?'비율 입력':'금액 입력'}/><span>{unit}</span></div>}
       {key==='creativeCost'&&<div className="mp-creative-input-row"><div className="mp-input-wrap"><FormattedNumberInput id="mp-creativeCost" aria-describedby="mp-help-creativeCost mp-creative-unit" value={draft.creativeCost} onValueChange={value=>update('creativeCost',value)} placeholder="총 제작비 입력"/><span>원 / 전체</span></div><output id="mp-creative-unit" aria-live="polite"><span>원가에 나누면</span><b>{draft.creativeCost!==''&&Number(draft.quantity)>0?money(Number(draft.creativeCost)/Number(draft.quantity)):'—'}<small> / 개</small></b></output></div>}
       {key==='quantity'&&<p id="mp-quantity-capacity" className="mp-quantity-capacity" aria-live="polite">{purchaseCapacity!==null?<>현재 예산으로 최대 <b>{purchaseCapacity.toLocaleString('ko-KR')}개</b> 구매 가능<small>상품 원가 기준 · 배송 등 추가 비용 제외</small></>:draft.cost!==''&&Number(draft.cost)===0?'원가가 0원이면 최대 구매수량을 계산할 수 없어요.':'예산과 상품 원가를 입력하면 구매 가능 수량을 확인할 수 있어요.'}</p>}
       {step===2&&key==='feePercent'&&<div className="mp-quick-costs"><button type="button" data-guide-example onClick={()=>{setMarket('other');useExample('feePercent');}}>참고값 넣기</button><small className="mp-market-applied">{selectedMarket?<>{selectedMarket.name} 참고율 <strong>{draft.feePercent}%</strong> 적용</>:'간편 계산용 7% · 실제 수수료와 다를 수 있어요.'}</small></div>}
       {step===2&&key!=='feePercent'&&key!=='creativeCost'&&<div className="mp-quick-costs"><button type="button" onClick={()=>useExample(key as keyof typeof plannerExamples)}>참고값 넣기</button><button type="button" onClick={()=>update(key,'0')}>{key==='returnRate'?'예상수량 없음':'비용 없음 · 0원'}</button>{exampleFields.includes(key)&&<small>참고값 적용</small>}</div>}
       {step===2&&key==='creativeCost'&&<div className="mp-creative-actions"><button type="button" className="mp-secondary" onClick={()=>update('creativeCost','0')}>제작비 없음 · 0원</button><small>총 제작비를 판매수량으로 나눠 반영해요.</small></div>}
      </div>)}
       {step===2&&Number(draft.returnRate)>0&&<div className="mp-field mp-return-cost"><div className="mp-field-label"><label htmlFor="mp-returnHandling">반품 한 건 처리비</label><PlannerCostHelp field="returnHandling" label="반품 한 건 처리비"/></div><div className="mp-input-wrap"><FormattedNumberInput aria-describedby="mp-help-returnHandling" id="mp-returnHandling" value={draft.returnHandling} onValueChange={value=>update('returnHandling',value)} placeholder="처리비 입력"/><span>원 / 건</span></div><div className="mp-quick-costs"><button type="button" data-guide-example onClick={()=>useExample('returnHandling')}>참고값 넣기</button><button type="button" onClick={()=>update('returnHandling','0')}>비용 없음 · 0원</button></div><p>개당 반품 비용: {returnCostMissing?'처리비 입력 필요':live?money(live.returns):'—'}</p></div>}
     </div>
     </div>
     {step===1&&overBudget&&<p className="mp-error" role="alert">상품 구매비가 예산보다 많아요.</p>}
     {error&&<p className="mp-error" role="alert">{error}</p>}
     <div className="mp-actions">{step===2&&<button type="button" className="mp-secondary" onClick={()=>move(1)}>이전 단계</button>}<button type="submit" className="mp-primary">{step===1?'다음 단계 · 비용 확인':'진단 결과 확인하기'}<ArrowRight size={17}/></button></div>
    </motion.form></AnimatePresence>:report&&(step===4?<SellingPreparation quantity={report.input.quantity} months={report.months} onBack={()=>move(3)}/>:<BeginnerProfitReport key={previewStage||'visitor'} initialPage={previewStage==='3-keywords'||returnToKeywords?1:0} onRequestMonths={requestMonths} name={report.name} months={report.months} input={report.input} result={report.result} exampleFields={report.examples} onEdit={()=>move(2)} onMoreCosts={()=>move(4)}/>)}
    {step<3&&<span className="mp-ipad-home" aria-hidden="true"/>}
   </section>
  </main>
  <dialog ref={goalDialog} className="mp-goal-dialog ds-goal-overlay" aria-labelledby="mp-goal-title" onClose={()=>setGoalOpen(false)} onClick={event=>{if(event.target===event.currentTarget)goalDialog.current?.close();}}><AnimatePresence>{goalOpen&&<motion.form key="goal" initial={reducedMotion?false:{opacity:0,y:36,scale:.97}} animate={{opacity:1,y:0,scale:1}} transition={{duration:reducedMotion?0:.45,ease:[.22,1,.36,1]}} onSubmit={confirmMonths} noValidate><h2 id="mp-goal-title">{report&&<><strong className="ds-goal-quantity">{report.input.quantity.toLocaleString('ko-KR')}개</strong>를<br/></>}몇 개월 동안 판매할 계획인가요?</h2><label htmlFor="mp-months" className="ds-sr-only">목표 판매 개월</label><div className="mp-input-wrap"><FormattedNumberInput id="mp-months" value={draft.months} onValueChange={value=>update('months',value)} placeholder="개월 입력"/><span>개월</span></div>{error&&<p className="mp-error" role="alert">{error}</p>}<button type="submit" className="mp-primary">판매 계획 이어보기 <ArrowRight size={20}/></button></motion.form>}</AnimatePresence></dialog>
 </div>;
}

function DiagnosisHeader({mode,onChoose}:{mode?:'starter'|'player';onChoose?:()=>void}){
 return <header className="ds-header"><Link href="/tools/start/" className="ds-wordmark" aria-label="키츠노드 홈"><BrandWordmark/></Link><span className="ds-header-note">감이 아닌 숫자로,<br/>다음 판매를 준비합니다.</span><nav aria-label="진단 메뉴">{mode&&<><span className="ds-mode-label">{mode==='starter'?'스타터':'플레이어'}</span><button type="button" onClick={onChoose}>유형 바꾸기 <ArrowUpRight size={16}/></button></>}<Link href="/tools/start/">홈으로 <ArrowUpRight size={16}/></Link><Link href="/store/login/" className="ds-header-login" onClick={saveMemberReturn}>로그인하기</Link></nav></header>;
}
