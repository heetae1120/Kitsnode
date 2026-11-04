/** Server-only bridge for a browser-backed collector. Naver Search/OpenAPI results are not ad positions. */
export function createShoppingAdsHandler({fetcher=fetch,maxRequests=20,globalLimit=60,now=()=>Date.now()}={}){
 const rates=new Map();let globalWindow={start:0,count:0};
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
  if(!env.SHOPPING_ADS_COLLECTOR_URL)return json({code:'COLLECTOR_NOT_CONFIGURED',error:'광고 순위 자동 수집이 연결되지 않았어요.'},503);
  const time=now();if(time-globalWindow.start>=60000)globalWindow={start:time,count:0};
  if(rates.size>1000)rates.clear();
  const client=rates.get(clientId)||{start:time,count:0};if(time-client.start>=60000){client.start=time;client.count=0;}
  if(client.count>=maxRequests||globalWindow.count>=globalLimit)return json({error:'잠시 후 다시 확인해 주세요.'},429);
  client.count++;globalWindow.count++;rates.set(clientId,client);
  try{
   const endpoint=new URL(env.SHOPPING_ADS_COLLECTOR_URL);
   if(endpoint.protocol!=='https:'||endpoint.username||endpoint.password)throw Error();
   const response=await fetcher(endpoint,{method:'POST',headers:{'Content-Type':'application/json',...(env.SHOPPING_ADS_COLLECTOR_TOKEN?{'Authorization':`Bearer ${env.SHOPPING_ADS_COLLECTOR_TOKEN}`}:{})},body:JSON.stringify({keyword,device:'PC',limit:3}),signal:AbortSignal.timeout(10000),redirect:'error'});
   if(!response.ok||!response.body)throw Error();
   const reader=response.body.getReader();const chunks=[];let size=0;
   try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>65536)throw Error();chunks.push(value);}}finally{void reader.cancel().catch(()=>{});reader.releaseLock();}
   const payload=JSON.parse(Buffer.concat(chunks).toString('utf8'));
   // Only publish allowlisted fields; do not forward collector diagnostics or credentials.
   return json({keyword:payload.keyword,device:payload.device,sourceUrl:payload.sourceUrl,observedAt:payload.observedAt,context:payload.context,complete:payload.complete,items:Array.isArray(payload.items)?payload.items.map(row=>({rank:row.rank,ad:row.ad,title:row.title,mall:row.mall,price:row.price,image:row.image})):null});
  }catch{return json({code:'COLLECTOR_UNAVAILABLE',error:'지금 광고 상품을 확인하지 못했어요.'},502);}
 };
}
