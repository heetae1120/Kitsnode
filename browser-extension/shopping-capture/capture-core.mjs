export function shoppingContext(raw){
 const url=new URL(raw);
 if(url.origin!=='https://search.shopping.naver.com'||url.pathname!=='/search/all'||url.username||url.password)throw Error('네이버쇼핑 검색 결과 탭에서 실행해 주세요.');
 if(url.searchParams.has('pagingIndex')&&url.searchParams.get('pagingIndex')!=='1')throw Error('검색 결과 첫 페이지에서 캡처해 주세요.');
 const keyword=url.searchParams.get('query')?.trim();
 if(!keyword||keyword.length>100)throw Error('검색어가 있는 네이버쇼핑 페이지를 열어 주세요.');
 return {keyword,sourceUrl:url.href};
}
export function reportContext(raw){try{const u=new URL(raw);return u.origin==='https://heetae1120.github.io'&&u.pathname.startsWith('/Kitsnode/tools/');}catch{return false;}}
export function cropGeometry(rect,viewport,image){
 if(![rect.x,rect.y,rect.width,rect.height,viewport.width,viewport.height,image.width,image.height].every(Number.isFinite)||rect.width<1||rect.height<1||viewport.width<1||viewport.height<1||image.width<1||image.height<1||rect.x<0||rect.y<0||rect.x+rect.width>viewport.width+1||rect.y+rect.height>viewport.height+1)throw Error('광고 전체가 화면에 들어오도록 브라우저 창을 넓히거나 축소한 뒤 다시 실행해 주세요.');
 const sx=image.width/viewport.width,sy=image.height/viewport.height;
 return {x:Math.round(rect.x*sx),y:Math.round(rect.y*sy),width:Math.min(image.width-Math.round(rect.x*sx),Math.round(rect.width*sx)),height:Math.min(image.height-Math.round(rect.y*sy),Math.round(rect.height*sy))};
}
