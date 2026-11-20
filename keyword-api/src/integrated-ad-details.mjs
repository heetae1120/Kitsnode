/** Never convert an undated purchase total or buyer count into unit sales. */
export function readPeriodSales(text){
 const count=period=>{const match=text.match(new RegExp(`(?:^|\\s)(?:최근\\s*)?${period}(?:간)?\\s*(?:동안\\s*)?(?:(?:판매|구매)(?:량|수)?\\s*)?([\\d,]+)\\s*개`));return match?Number(match[1].replaceAll(',','')):null;};
 return {dailySales:count('(?:1일|하루|일간|오늘)'),weeklySales:count('(?:7일|1주일|1주|주간)')};
}
export function readAdCounters(text){
 const count=label=>text.match(new RegExp(`(?:^|\\n)${label}\\s*([\\d,.]+(?:만|천)?(?:\\+)?(?:\\s*[개명건](?:\\s*이상)?)?)\\s*(?=\\n|$)`))?.[1].trim()||'';
 return {wishCount:count('찜'),purchaseCount:count('구매')||text.match(/(?:^|\n)([\d,.]+(?:만|천)?\s*[개명건](?:\s*이상)?)\s*구매\s*(?=\n|$)/)?.[1].trim()||''};
}

/** Runs in the public search document; never follows a paid link. */
export function readIntegratedAdCards(includeOrganic=false){
 const isAd=info=>Array.from(info.querySelectorAll('button')).some(button=>button.textContent.trim()==='광고'&&button.getBoundingClientRect().width>0);
 const products=new Map(),seen=new WeakSet();let visited=0;
 const scan=(value,depth=0)=>{if(!value||typeof value!=='object'||seen.has(value)||depth>16||++visited>10000)return;seen.add(value);if(value.nvMid&&value.productUrl&&!products.has(String(value.nvMid)))products.set(String(value.nvMid),value);for(const item of Object.values(value))if(typeof item==='object')scan(item,depth+1);};
 scan(window.naver?.search?.ext?.newshopping?.shopping?._INITIAL_STATE?.initProps?.pagedSlot);
 return Array.from(document.querySelectorAll('[id^="view_type_guide_"], [id^="view_type_list_finder_"]'))
 .filter(info=>/^view_type_(guide|list_finder)_\d+$/.test(info.id)&&(includeOrganic||isAd(info))).slice(0,includeOrganic?30:3).map(info=>{
  const card=info.closest('li')||info,image=card.querySelector('img[alt]');
  const ratingGroup=Array.from(card.querySelectorAll('span')).find(span=>{
   const values=span.querySelectorAll(':scope > span');return span.querySelector(':scope > svg')&&values.length>=2&&/^[0-5](?:\.\d{1,2})?$/.test(values[0].textContent.trim());
  });
  const values=ratingGroup?.querySelectorAll(':scope > span');
  const rating=values?.[0]?.textContent.trim(),review=values?.[1]?.textContent.replace(/[()\s]/g,'');
  const title=card.querySelector('[data-nlog-area$=".tit"],[data-nlog-area$="superitemtit"]')?.textContent.trim()||image?.getAttribute('alt')?.replace(/<[^>]*>/g,'').trim()||'';
  const link=card.querySelector('[data-nlog-area$=".tit"],[data-nlog-area$="superitemtit"]')||image?.closest('a[href]');
  const counter=label=>{const pattern=new RegExp('^'+label+'\\s*([\\d,.]+(?:만|천)?(?:\\+)?(?:\\s*[개명건](?:\\s*이상)?)?)$');for(const span of card.querySelectorAll('span')){const match=span.textContent.trim().match(pattern);if(match)return match[1];}return '';};
  const seller=card.querySelector('[data-nlog-area$=".mall"],[data-nlog-area$="superitemmall"]')||Array.from(card.querySelectorAll('a[href]')).reverse().find(a=>{const text=a.textContent.trim();return text&&text!==title&&text.length<60&&!/^[\d,.\s]+원?$/.test(text);});
  const nvMid=info.id.match(/_(\d+)$/)?.[1],product=products.get(nvMid);
  const productData=product?{nvMid:product.nvMid,channelProductId:product.channelProductId,productUrl:product.productUrl?.pcUrl,mall:product.mallName,rating:product.averageReviewScore,reviewCount:product.totalReviewCount,purchaseCount:product.purchaseCount,wishCount:product.shoppingExtraInfo?.keepCount}:null;
  return {nvMid,productData,ad:isAd(info),title,url:link?.href||null,image:image?.src||null,mall:seller?.textContent.trim()||'',price:null,rating:rating?Number(rating):null,reviewCount:review&&/^[\d,.]+(?:만|천)?$/.test(review)?review:'',wishCount:counter('찜'),purchaseCount:counter('구매'),periodText:card.innerText||''};
 });
}

/** Supplement only an exact title AND seller match; never transfer variant/bundle reviews. */
export function matchingPublicProduct(ad,candidates){
 const key=value=>String(value||'').normalize('NFC').replace(/\s+/g,'').toLowerCase();
 if(!key(ad.title)||!key(ad.mall))return null;
 return candidates.find(item=>!item.ad&&key(item.title)===key(ad.title)&&key(item.mall)===key(ad.mall))||null;
}

export function publicProductUrl(value){
 try{const url=new URL(value);if(url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&/^(?:smartstore|brand)\.naver\.com$/.test(url.hostname)&&/^\/[a-zA-Z0-9_-]+\/products\/\d+\/?$/.test(url.pathname))return url.origin+url.pathname;}catch{}
 return null;
}

/** The public shopping payload binds the merchant URL and counters to the visible ad's exact ID.
 * @returns {{url?:string,rating?:number,reviewCount?:string,purchaseCount?:string,wishCount?:string}}
 */
export function publicAdProductDetails(row){
 const data=row.productData;if(!data||String(data.nvMid)!==String(row.nvMid))return {};
 const url=publicProductUrl(data.productUrl),id=url?.match(/\/products\/(\d+)\/?$/)?.[1];
 if(!url||!id||id!==String(data.channelProductId))return {};
 const result={url};
 if(Number.isFinite(data.rating)&&data.rating>=0&&data.rating<=5)result.rating=data.rating;
 for(const key of ['reviewCount','purchaseCount','wishCount'])if(Number.isSafeInteger(data[key])&&data[key]>=0)result[key]=data[key].toLocaleString('ko-KR');
 return result;
}

/** Runs only on the exact public merchant product, without logging in or crossing a block. */
export function readMerchantProductDetails(expectedId){
 const id=value=>String(value??'');const pathId=location.pathname.match(/\/products\/(\d+)\/?$/)?.[1];if(!/^\d+$/.test(id(expectedId))||pathId!==id(expectedId))return {};
 const result={},seen=new WeakSet();let visited=0;
 const count=value=>/^[\d,]+$/.test(String(value))&&Number.isSafeInteger(Number(String(value).replaceAll(',','')))?Number(String(value).replaceAll(',','')).toLocaleString('ko-KR'):null;
 const read=value=>{const rawRating=value.averageReviewScore??value.reviewAmount?.averageReviewScore??value.aggregateRating?.ratingValue;const rating=Number(rawRating);if(rawRating!==undefined&&rawRating!==null&&rawRating!==''&&Number.isFinite(rating)&&rating>=0&&rating<=5)result.rating=rating;
  for(const [target,raw] of [['reviewCount',value.totalReviewCount??value.reviewCount??value.reviewAmount?.totalReviewCount??value.aggregateRating?.reviewCount],['purchaseCount',value.purchaseCount??value.purchaseQuantity],['wishCount',value.keepCount??value.wishCount]])if(raw!==undefined&&raw!==null&&count(raw)!==null)result[target]=count(raw);};
 const scan=(value,depth=0)=>{if(!value||typeof value!=='object'||seen.has(value)||depth>14||++visited>5000)return;seen.add(value);if([value.id,value.channelProductId,value.channelProductNo,value.productNo].some(v=>id(v)===id(expectedId)))read(value);for(const v of Object.values(value))if(typeof v==='object')scan(v,depth+1);};
 scan(window.__PRELOADED_STATE__);scan(window.__NEXT_DATA__);
 for(const script of document.querySelectorAll('script[type="application/ld+json"]')){try{const value=JSON.parse(script.textContent);for(const product of [value,...(Array.isArray(value['@graph'])?value['@graph']:[])])if(product['@type']==='Product'&&String(product.url||'').match(/\/products\/(\d+)/)?.[1]===id(expectedId))read(product);}catch{}}
 return result;
}
