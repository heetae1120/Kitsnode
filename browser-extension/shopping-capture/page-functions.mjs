// Executed only after the user presses Capture on the active Naver shopping tab.
export function findAds(){
 if(document.body.innerText.includes('접속이 일시적으로 제한'))throw Error('네이버쇼핑 접속 제한 화면이에요. 상품 목록이 정상적으로 열린 뒤 다시 실행해 주세요.');
 const cards=Array.from(document.querySelectorAll('[class*="adProduct_item"]')).filter(card=>Array.from(card.querySelectorAll('button')).some(button=>button.textContent.trim()==='광고')&&card.querySelector('[class*="adProduct_title"] a[title]'));
 const outer=cards.filter(card=>!cards.some(other=>other!==card&&other.contains(card))).filter(card=>{const r=card.getBoundingClientRect();return r.width>100&&r.height>30;});
 if(outer.length<3)throw Error('광고 표시가 있는 상품 3개를 확인하지 못했어요. 일반 상품을 광고 순위로 대신 표시하지 않습니다.');
 const rows=outer.slice(0,3).map(card=>({title:card.querySelector('[class*="adProduct_title"] a[title]').textContent.trim().slice(0,300)}));
 return {rows,scroll:{x:scrollX,y:scrollY}};
}
export async function positionAd(index,expectedTitle){
 const cards=Array.from(document.querySelectorAll('[class*="adProduct_item"]')).filter(card=>Array.from(card.querySelectorAll('button')).some(button=>button.textContent.trim()==='광고')&&card.querySelector('[class*="adProduct_title"] a[title]'));
 const outer=cards.filter(card=>!cards.some(other=>other!==card&&other.contains(card))).filter(card=>{const r=card.getBoundingClientRect();return r.width>100&&r.height>30;});
 const card=outer[index];
 if(!card||card.querySelector('[class*="adProduct_title"] a[title]').textContent.trim().slice(0,300)!==expectedTitle)throw Error('상품 순서가 바뀌었어요. 다시 캡처해 주세요.');
 // Keep the card below sticky navigation; never follow a paid product link.
 card.scrollIntoView({block:'center',behavior:'instant'});
 const before=card.getBoundingClientRect();if(before.top<140)scrollBy({top:before.top-140,behavior:'instant'});
 await Promise.all(Array.from(card.querySelectorAll('img')).map(img=>img.complete?Promise.resolve():new Promise(resolve=>{img.addEventListener('load',resolve,{once:true});img.addEventListener('error',resolve,{once:true});setTimeout(resolve,1500);}))); 
 await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
 const r=card.getBoundingClientRect();
 return {rect:{x:r.x,y:r.y,width:r.width,height:r.height},viewport:{width:innerWidth,height:innerHeight}};
}
export function restoreScroll(position){scrollTo({left:position.x,top:position.y,behavior:'instant'});}
