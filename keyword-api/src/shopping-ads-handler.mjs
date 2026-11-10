import {collectShoppingAds} from './browser-shopping-ads.mjs';
/** Server-only bridge for a browser-backed collector. Naver Search/OpenAPI results are not ad positions. */
export function createShoppingAdsHandler({fetcher=fetch,browserCollector=collectShoppingAds,maxRequests=5,globalLimit=20,now=()=>Date.now()}={}){
 const rates=new Map();let active=0;let globalWindow={start:0,count:0};
 /** @param {Request} request @param {Record<string,string|undefined>} env @param {string} clientId */
 return async function handle(request,env=process.env,clientId='anonymous'){
  const origin=request.headers.get('origin');
  const allowed=(env.ALLOWED_ORIGINS||'https://heetae1120.github.io').split(',').map(s=>s.trim());
  const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Origin'};
  if(origin&&!allowed.includes(origin))return new Response(JSON.stringify({error:'허용되지 않은 요청이에요.'}),{status:403,headers});
  if(origin)headers['Access-Control-Allow-Origin']=origin;
  headers['Access-Control-Allow-Methods']='GET, OPTIONS';
  const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(request.method!=='GET')return json({error:'GET 요청만 지원해요.'},405);
  const keyword=new URL(request.url).searchParams.get('keyword')?.trim();
  if(!keyword||keyword.length>100||/[\x00-\x1f]/.test(keyword))return json({error:'품목을 확인해 주세요.'},400);
  const placement=new URL(request.url).searchParams.get('placement')||'shopping';
  if(!['shopping','integrated'].includes(placement))return json({error:'조회 지면을 확인해 주세요.'},400);
  const time=now();if(time-globalWindow.start>=60000)globalWindow={start:time,count:0};
  if(rates.size>1000)rates.clear();
  const client=rates.get(clientId)||{start:time,count:0};if(time-client.start>=60000){client.start=time;client.count=0;}
  if(client.count>=maxRequests||globalWindow.count>=globalLimit)return json({error:'잠시 후 다시 확인해 주세요.'},429);
  client.count++;globalWindow.count++;rates.set(clientId,client);
  if(active>=1)return json({error:'다른 조회를 처리 중이에요. 잠시 후 다시 확인해 주세요.'},429);
  active++;
  try{
   if(!env.SHOPPING_ADS_COLLECTOR_URL)return json(await browserCollector(keyword,{placement}));
   const endpoint=new URL(env.SHOPPING_ADS_COLLECTOR_URL);
   if(endpoint.protocol!=='https:'||endpoint.username||endpoint.password)throw Error();
   const response=await fetcher(endpoint,{method:'POST',headers:{'Content-Type':'application/json',...(env.SHOPPING_ADS_COLLECTOR_TOKEN?{'Authorization':`Bearer ${env.SHOPPING_ADS_COLLECTOR_TOKEN}`}:{})},body:JSON.stringify({keyword,device:'PC',limit:3,...(placement==='integrated'?{placement}:{})}),signal:AbortSignal.timeout(10000),redirect:'error'});
   if(!response.ok||!response.body)throw Error();
   const reader=response.body.getReader();const chunks=[];let size=0;
   try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>1200000)throw Error();chunks.push(value);}}finally{void reader.cancel().catch(()=>{});reader.releaseLock();}
   const payload=JSON.parse(Buffer.concat(chunks).toString('utf8'));
   // Only publish allowlisted fields; do not forward collector diagnostics or credentials.
   return json({placement:payload.placement,keyword:payload.keyword,device:payload.device,sourceUrl:payload.sourceUrl,observedAt:payload.observedAt,context:payload.context,complete:payload.complete,items:Array.isArray(payload.items)?payload.items.map(row=>({rank:row.rank,ad:row.ad,title:row.title,mall:row.mall,price:row.price,image:row.image,capture:row.capture,rating:row.rating,reviewCount:row.reviewCount,wishCount:row.wishCount,originalPrice:row.originalPrice,couponPrice:row.couponPrice,promotion:row.promotion,shipping:row.shipping,category:row.category,specifications:row.specifications,registeredAt:row.registeredAt})):null});
  }catch(e){const known=['SHOPPING_PAGE_BLOCKED','SHOPPING_PAGE_UNAVAILABLE','SHOPPING_PAGE_CHANGED','AD_RESULTS_NOT_CONFIRMED','AD_CAPTURE_UNAVAILABLE'];const reason=known.includes(e?.message)?e.message:['ERR_MODULE_NOT_FOUND','ENOENT'].includes(e?.code)?'BROWSER_RUNTIME_UNAVAILABLE':'UPSTREAM_UNAVAILABLE';return json({code:'COLLECTOR_UNAVAILABLE',reason,error:'지금 광고 상품을 확인하지 못했어요.'},502);}finally{active--;}
 };
}
