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
export function readIntegratedAdCards(){
 return Array.from(document.querySelectorAll('[id^="view_type_guide_"], [id^="view_type_list_finder_"]'))
 .filter(info=>/^view_type_(guide|list_finder)_\d+$/.test(info.id)&&Array.from(info.querySelectorAll('button')).some(button=>button.textContent.trim()==='광고'&&button.getBoundingClientRect().width>0)).slice(0,3).map(info=>{
  const card=info.closest('li')||info,image=card.querySelector('img[alt]');
  const ratingGroup=Array.from(card.querySelectorAll('span')).find(span=>{
   const values=span.querySelectorAll(':scope > span');return span.querySelector(':scope > svg')&&values.length>=2&&/^[0-5](?:\.\d{1,2})?$/.test(values[0].textContent.trim());
  });
  const values=ratingGroup?.querySelectorAll(':scope > span');
  const rating=values?.[0]?.textContent.trim(),review=values?.[1]?.textContent.replace(/[()\s]/g,'');
  const title=card.querySelector('[data-nlog-area$=".tit"],[data-nlog-area$="superitemtit"]')?.textContent.trim()||image?.getAttribute('alt')?.replace(/<[^>]*>/g,'').trim()||'';
  const link=card.querySelector('[data-nlog-area$=".tit"],[data-nlog-area$="superitemtit"]')||image?.closest('a[href]');
  const counter=label=>{const pattern=new RegExp('^'+label+'\\s*([\\d,.]+(?:만|천)?(?:\\+)?(?:\\s*[개명건](?:\\s*이상)?)?)$');for(const span of card.querySelectorAll('span')){const match=span.textContent.trim().match(pattern);if(match)return match[1];}return '';};
  return {ad:true,title,url:link?.href||null,image:image?.src||null,mall:card.querySelector('[data-nlog-area$=".mall"],[data-nlog-area$="superitemmall"]')?.textContent.trim()||'',price:null,rating:rating?Number(rating):null,reviewCount:review&&/^[\d,]+$/.test(review)?review:'',wishCount:counter('찜'),purchaseCount:counter('구매'),periodText:card.innerText||''};
 });
}
