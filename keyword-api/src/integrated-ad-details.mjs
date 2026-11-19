/** Never convert an undated purchase total or buyer count into unit sales. */
export function readPeriodSales(text){
 const count=period=>{const match=text.match(new RegExp(`(?:^|\\s)(?:최근\\s*)?${period}(?:간)?\\s*(?:동안\\s*)?(?:(?:판매|구매)(?:량|수)?\\s*)?([\\d,]+)\\s*개`));return match?Number(match[1].replaceAll(',','')):null;};
 return {dailySales:count('(?:1일|하루|일간|오늘)'),weeklySales:count('(?:7일|1주일|1주|주간)')};
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
  return {ad:true,title,image:image?.src||null,mall:card.querySelector('[data-nlog-area$=".mall"],[data-nlog-area$="superitemmall"]')?.textContent.trim()||'',price:null,rating:rating?Number(rating):null,reviewCount:review&&/^[\d,]+$/.test(review)?review:'',periodText:card.innerText||''};
 });
}
