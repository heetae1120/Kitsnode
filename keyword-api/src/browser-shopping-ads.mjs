/** Read the public shopping page in a browser. No ad clicks, login, proxy or challenge bypass. */
export function normalizeObservedAds(rows){
 if(!Array.isArray(rows)||rows.length===0)throw Error('AD_RESULTS_NOT_CONFIRMED');
 const items=rows.slice(0,3).map((row,index)=>{
  if(row.ad!==true||typeof row.title!=='string'||!row.title.trim())throw Error('AD_RESULTS_NOT_CONFIRMED');
  return {rank:index+1,ad:true,title:row.title.trim().slice(0,300),mall:typeof row.mall==='string'?row.mall.trim().slice(0,100):'',price:Number.isSafeInteger(row.price)&&row.price>0?row.price:null,image:typeof row.image==='string'?row.image:null};
 });
 return {items,complete:items.length===3};
}

export async function collectShoppingAds(keyword){
 const [{default:chromium},{default:puppeteer}]=await Promise.all([import('@sparticuz/chromium'),import('puppeteer-core')]);
 const browser=await puppeteer.launch({args:chromium.args,executablePath:await chromium.executablePath(),headless:'shell',defaultViewport:{width:1440,height:1000},timeout:15000});
 try{
  const page=await browser.newPage();
  page.setDefaultTimeout(10000);page.setDefaultNavigationTimeout(15000);
  await page.setRequestInterception(true);
  page.on('request',request=>{
   try{const url=new URL(request.url());const host=url.hostname;const permitted=url.protocol==='https:'&&['naver.com','pstatic.net','naver.net'].some(domain=>host===domain||host.endsWith('.'+domain));
    if(!permitted||['media','font'].includes(request.resourceType()))void request.abort().catch(()=>{});else void request.continue().catch(()=>{});
   }catch{void request.abort().catch(()=>{});}
  });
  const url=new URL('https://search.shopping.naver.com/search/all');url.searchParams.set('query',keyword);
  const response=await page.goto(url.href,{waitUntil:'domcontentloaded'});
  if(response&&[403,418,429].includes(response.status()))throw Error('SHOPPING_PAGE_BLOCKED');
  if(!response||!response.ok())throw Error('SHOPPING_PAGE_UNAVAILABLE');
  await page.waitForSelector('[class*="adProduct_item"]');
  // Scroll only to load product thumbnails. Never follow the paid product links.
  for(let index=0;index<3;index++)await page.evaluate(i=>document.querySelectorAll('[class*="adProduct_item"]')[i]?.scrollIntoView({block:'center'}),index);
  const rows=await page.evaluate(()=>Array.from(document.querySelectorAll('[class*="adProduct_item"]')).slice(0,3).map(card=>{
   const ad=Array.from(card.querySelectorAll('button')).some(button=>button.textContent.trim()==='광고');
   const title=card.querySelector('[class*="adProduct_title"] a[title]');
   const image=Array.from(card.querySelectorAll('img')).find(img=>img.alt);
   const price=card.querySelector('[class*="price_num"] em');
   const mall=card.querySelector('a[data-shp-area$=".mall"]');
   return {ad,title:title?.textContent||'',mall:mall?.textContent||'',price:price?Number(price.textContent.replaceAll(',','')):null,image:image?.getAttribute('src')||null};
  }));
  const result=normalizeObservedAds(rows);
  if(new URL(page.url()).origin!==url.origin||new URL(page.url()).pathname!==url.pathname)throw Error('SHOPPING_PAGE_CHANGED');
  return {keyword,device:'PC',sourceUrl:url.href,observedAt:new Date().toISOString(),context:'서버 브라우저 · 비로그인 · 네이버 랭킹순 · 첫 페이지',...result};
 }finally{await browser.close();}
}
