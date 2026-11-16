export const ANALYTICS_STEPS = ['brandVision', 'audience', 'category', 'stage', 'budget', 'support', 'brandGoal', 'contact'] as const;

type Step = typeof ANALYTICS_STEPS[number];
type Status = 'active' | 'left' | 'completed';
type State = {version:1;attemptId:string;sequence:number;reached:Step[];step:Step;status:Status};
export const SURVEY_ATTEMPT_KEY='kitsnode-survey-attempt-v1';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const validStep=(v:unknown):v is Step=>typeof v==='string' && (ANALYTICS_STEPS as readonly string[]).includes(v);
function read(storage:Storage|null):State|null {
  try {const x=JSON.parse(storage?.getItem(SURVEY_ATTEMPT_KEY)||'null');
    if(!x||x.version!==1||!uuid.test(x.attemptId)||!Number.isSafeInteger(x.sequence)||x.sequence<0||x.sequence>=100000||!Array.isArray(x.reached)||!x.reached.every(validStep)||new Set(x.reached).size!==x.reached.length||!validStep(x.step)||!x.reached.includes(x.step)||!['active','left','completed'].includes(x.status))return null;
    return x as State;
  } catch {return null;}
}
export function clearSurveyAttempt(storage:Storage|null) {try {storage?.removeItem(SURVEY_ATTEMPT_KEY);} catch { /* unavailable */ }}
export function createSurveyFunnel({storage,createId,send,allowed}:{storage:Storage|null;createId:()=>string;send:(event:State)=>void;allowed:()=>boolean}) {
  let state:State|null=read(storage); let dirty=false,needsResume=!!state&&state.status!=='completed',completionRetries=0;
  function persist() {try {if(state)storage?.setItem(SURVEY_ATTEMPT_KEY,JSON.stringify(state));} catch { /* memory-only fallback */ }}
  function emit(status:Status) {if(!state||!allowed()||state.status==='completed'||state.sequence>=100000)return;state={...state,sequence:state.sequence+1,status};persist();send({...state,reached:[...state.reached]});dirty=false;needsResume=false;}
  return {
    step(step:string,done:boolean) {
      if(!allowed()||!validStep(step))return;
      if(state?.status==='completed' && done)return;
      if(!state||state.status==='completed') {if(done)return;const id=createId();if(!uuid.test(id))return;state={version:1,attemptId:id,sequence:0,reached:[step],step,status:'active'};emit('active');return;}
      const changed=state.step!==step||!state.reached.includes(step);
      state={...state,step,reached:state.reached.includes(step)?state.reached:[...state.reached,step]};
      if(done&&step==='contact')emit('completed');else if(changed||state.status==='left'||needsResume)emit('active');
    },
    activity(){if(allowed()&&state&&state.status!=='completed')dirty=true;},
    flush(){if(state?.status==='completed'&&allowed()&&completionRetries<3){send({...state,reached:[...state.reached]});completionRetries++;}else if(dirty)emit('active');},
    leave(){emit('left');},
    resume(){if(state?.status==='left')emit('active');},
  };
}
