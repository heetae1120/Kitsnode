import { randomUUID } from 'node:crypto';
const rates=new Map();
// Survey answers from /tools/survey/: known keys only, short strings, short lists.
const ANSWER_KEYS=['status','category','categoryOther','revenue','adMode','adSpend','pains','goal','brandVision','audience','stage','budget','support','brandGoal'];
export function cleanAnswers(a){
 if(a===undefined)return {};
 if(!a||typeof a!=='object'||Array.isArray(a))return null;
 const out={};
 for(const [k,v]of Object.entries(a)){
  if(!ANSWER_KEYS.includes(k))return null;
  if(typeof v==='string'){if(v.length>500)return null;if(v.trim())out[k]=v.trim();}
  else if(Array.isArray(v)){if(v.length>10||v.some(x=>typeof x!=='string'||x.length>100))return null;if(v.length)out[k]=v.map(x=>x.trim()).filter(Boolean);}
  else return null;
 }
 return out;
}
export function createConsultationHandler({fetcher=fetch,now=()=>Date.now()}={}){
/** @param {Request} req @param {Record<string,string|undefined>} env @param {string} client */
return async function(req,env=process.env,client='anonymous'){
 const origin=req.headers.get('origin');const allowed=(env.ALLOWED_ORIGINS||'https://heetae1120.github.io').split(',').map(s=>s.trim());
 const headers={'Cache-Control':'no-store',Vary:'Origin',...(origin&&allowed.includes(origin)?{'Access-Control-Allow-Origin':origin}:{})};
 const json=(data,status=200)=>Response.json(data,{status,headers});
 if(origin&&!allowed.includes(origin))return json({error:'허용되지 않은 사이트입니다.'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:{...headers,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization'}});
 const base=env.SUPABASE_URL?.replace(/\/$/,'');const service=env.SUPABASE_SERVICE_ROLE_KEY;const anon=env.SUPABASE_ANON_KEY;
 if(!base||!service||!anon)return json({error:'상담 접수 서버 연결 준비 중입니다. 아직 신청이 접수되지 않았습니다.'},503);
 if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(base))return json({error:'상담 서버 설정을 확인해 주세요.'},503);
 if(req.method==='GET'&&new URL(req.url).searchParams.get('mode')==='config')return json({url:base,anonKey:anon});
 if(req.method==='GET'){
  const token=req.headers.get('authorization')||'';if(!/^Bearer \S+$/.test(token))return json({error:'관리자 로그인이 필요합니다.'},401);
  const userResponse=await fetcher(`${base}/auth/v1/user`,{headers:{apikey:anon,Authorization:token},signal:AbortSignal.timeout(8000)});
  if(!userResponse.ok)return json({error:'관리자 세션이 만료되었습니다.'},401);
  const user=await userResponse.json();const admins=(env.CONSULTATION_ADMIN_EMAILS||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
  if(!user.email_confirmed_at||!admins.includes(String(user.email||'').toLowerCase()))return json({error:'관리자 계정만 신청 내역을 볼 수 있습니다.'},403);
  const response=await fetcher(`${base}/rest/v1/consultation_requests?select=id,created_at,store,company,name_role,phone,answers&order=created_at.desc&limit=200`,{headers:{apikey:service,Authorization:`Bearer ${service}`},signal:AbortSignal.timeout(8000)});
  if(!response.ok)return json({error:'신청 내역을 불러오지 못했습니다.'},502);
  return json({requests:await response.json()});
 }
 if(req.method!=='POST')return json({error:'지원하지 않는 요청입니다.'},405);
 if(!req.headers.get('content-type')?.includes('application/json'))return json({error:'입력 형식을 확인해 주세요.'},415);
 const body=await req.text();if(body.length>5000)return json({error:'입력 내용이 너무 깁니다.'},413);
 let p;try{p=JSON.parse(body);}catch{return json({error:'입력 내용을 확인해 주세요.'},400);}
 if(!p||typeof p!=='object'||Array.isArray(p)||Object.keys(p).some(k=>!['store','company','nameRole','phone','consent','answers'].includes(k)))return json({error:'입력 내용을 확인해 주세요.'},400);
 if(['store','company','nameRole','phone'].some(k=>typeof p[k]!=='string')||!p.company.trim()||!p.nameRole.trim()||p.company.length>100||p.nameRole.length>100||!/^\+?[\d\s()\-]{7,25}$/.test(p.phone)||p.store.length>1000||p.consent!==true)return json({error:'필수 입력값과 개인정보 수집 동의를 확인해 주세요.'},400);
 const answers=cleanAnswers(p.answers);if(answers===null)return json({error:'설문 답변 형식을 확인해 주세요.'},400);
 if(p.store.trim()){try{const u=new URL(p.store);if(!['http:','https:'].includes(u.protocol)||u.username||u.password)throw Error();}catch{return json({error:'올바른 스토어 링크를 입력하세요.'},400);}}
 const current=now();for(const [k,v]of rates)if(current-v.start>3600000)rates.delete(k);const rate=rates.get(client)||{start:current,count:0};if(rate.count>=5)return json({error:'잠시 후 다시 신청해 주세요.'},429);if(rates.size>10000)return json({error:'요청이 많습니다. 잠시 후 시도해 주세요.'},429);rate.count++;rates.set(client,rate);
 const id=randomUUID();const response=await fetcher(`${base}/rest/v1/consultation_requests`,{method:'POST',headers:{apikey:service,Authorization:`Bearer ${service}`,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify({id,store:p.store.trim(),company:p.company.trim(),name_role:p.nameRole.trim(),phone:p.phone.trim(),...(Object.keys(answers).length?{answers}:{}),consented_at:new Date(current).toISOString()}),signal:AbortSignal.timeout(8000)});
 if(!response.ok)return json({error:'신청을 저장하지 못했습니다. 아직 접수되지 않았습니다. 다시 시도해 주세요.'},502);
 return json({id,message:'상담 신청이 접수되었습니다.'},201);
};}
const handler=createConsultationHandler();
export default async function(req,res){try{const headers=new Headers();for(const[k,v]of Object.entries(req.headers))if(typeof v==='string')headers.set(k,v);let body='';if(req.method==='POST'){for await(const chunk of req){body+=chunk;if(body.length>5000){res.statusCode=413;res.end();return;}}}const request=new Request(new URL(req.url,'https://localhost'),{method:req.method,headers,...(req.method==='POST'?{body}:{})});const response=await handler(request,process.env,String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'anonymous').split(',')[0]);res.statusCode=response.status;response.headers.forEach((v,k)=>res.setHeader(k,v));res.end(await response.text());}catch{res.statusCode=502;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({error:'서버 응답을 확인하지 못했습니다. 중복 신청 전에 관리자에게 접수 여부를 확인해 주세요.'}));}}
