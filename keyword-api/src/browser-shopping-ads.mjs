/** Read the public shopping page in a browser. No ad clicks, login, proxy or challenge bypass. */
export function normalizeObservedAds(rows){
 if(!Array.isArray(rows)||rows.length===0)throw Error('AD_RESULTS_NOT_CONFIRMED');
 const items=rows.slice(0,3).map((row,index)=>{
  if(row.ad!==true||typeof row.title!=='string'||!row.title.trim())throw Error('AD_RESULTS_NOT_CONFIRMED');
  const text=(key,max=200)=>typeof row[key]==='string'?row[key].trim().slice(0,max):'';
  const amount=key=>Number.isSafeInteger(row[key])&&row[key]>0?row[key]:null;
  return {rating:Number.isFinite(row.rating)&&row.rating>=0&&row.rating<=5?row.rating:null,reviewCount:text('reviewCount',30),wishCount:text('wishCount',30),originalPrice:amount('originalPrice'),couponPrice:amount('couponPrice'),promotion:text('promotion'),shipping:text('shipping'),category:text('category',400),specifications:text('specifications',2000),registeredAt:text('registeredAt',30),rank:index+1,ad:true,title:row.title.trim().slice(0,300),mall:typeof row.mall==='string'?row.mall.trim().slice(0,100):'',price:Number.isSafeInteger(row.price)&&row.price>0?row.price:null,image:typeof row.image==='string'?row.image:null};
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
  const url=new URL('https://search.shopping.naver.com/search/all');url.searchParams.set('query',keyword);url.searchParams.set('frm','NVSCPRO');
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
   const text=s=>card.querySelector(s)?.textContent.trim()||'';
   const number=s=>{const t=text(s).replace(/[^0-9]/g,'');return t?Number(t):null;};
   return {rating:text('[class*="adProduct_rating"]')?Number(text('[class*="adProduct_rating"]')):null,reviewCount:text('[class*="adProduct_review"] em'),wishCount:text('[class*="adProduct_btn_zzim"] em'),originalPrice:number('[class*="price_org_price"]'),couponPrice:number('[class*="price_discount_price__"]'),promotion:text('[class*="adProduct_brand_message"]')||text('[class*="adProduct_membership_message"]'),shipping:[text('[class*="price_delivery_fee"]'),text('[class*="adProduct_delivery_area"]')].filter(Boolean).join(' · '),category:Array.from(card.querySelectorAll('[class*="adProduct_depth"] a')).map(x=>x.textContent).join(' > '),specifications:Array.from(card.querySelectorAll('[class*="adProduct_detail_box"] a')).map(x=>x.textContent).join(' · ').slice(0,1500),registeredAt:text('[class*="adProduct_etc_box"]').match(/등록일\s*(\d{4}\.\d{2}\.)/)?.[1]||'',ad,title:title?.textContent||'',mall:mall?.textContent||'',price:price?Number(price.textContent.replaceAll(',','')):null,image:image?.getAttribute('src')||null};
  }));
  const result=normalizeObservedAds(rows);
  await captureObservedAds(page,result,url.href);
  return {keyword,device:'PC',sourceUrl:url.href,observedAt:new Date().toISOString(),context:'서버 브라우저 · 비로그인 · 네이버 랭킹순 · 첫 페이지',...result};
 }finally{await browser.close();}
}

/** Captures only previously verified ads, on the exact entered-keyword page. */
export async function captureObservedAds(page,result,sourceUrl){
 if(page.url()!==sourceUrl)throw Error('SHOPPING_PAGE_CHANGED');
 const cards=await page.$$('[class*="adProduct_item"]');
 for(let index=0;index<result.items.length;index++){
  const card=cards[index];const item=result.items[index];
  if(!card)throw Error('AD_CAPTURE_UNAVAILABLE');
  const matches=await card.evaluate((element,title)=>Array.from(element.querySelectorAll('button')).some(button=>button.textContent.trim()==='광고')&&element.querySelector('[class*="adProduct_title"] a[title]')?.textContent.trim()===title,item.title);
  if(!matches)throw Error('AD_RESULTS_NOT_CONFIRMED');
  await card.evaluate(element=>element.scrollIntoView({block:'center'}));
  await card.evaluate(async element=>{await Promise.all(Array.from(element.querySelectorAll('img')).map(img=>img.complete?Promise.resolve():new Promise(resolve=>{img.addEventListener('load',resolve,{once:true});img.addEventListener('error',resolve,{once:true});setTimeout(resolve,2000);})));});
  const capture=await card.screenshot({type:'jpeg',quality:75,encoding:'base64'});
  if(capture.length>350000)throw Error('AD_CAPTURE_UNAVAILABLE');
  item.capture='data:image/jpeg;base64,'+capture;
 }
 if(page.url()!==sourceUrl)throw Error('SHOPPING_PAGE_CHANGED');
}
