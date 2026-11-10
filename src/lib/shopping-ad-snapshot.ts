export type ShoppingAdDetails = {rating:number|null;reviewCount:string;wishCount:string;originalPrice:number|null;couponPrice:number|null;promotion:string;shipping:string;category:string;specifications:string;registeredAt:string};
export type ShoppingAd = Partial<ShoppingAdDetails> & {rank:number;ad:true;title:string;mall:string;price:number|null;image:string|null;capture?:string|null};
export type ShoppingAdSnapshot = {keyword:string;device:'PC';sourceUrl:string;observedAt:string;context:string;complete:boolean;items:ShoppingAd[]};
const normalize=(value:string)=>value.replace(/\s+/g,'').toLowerCase();
export const shoppingSearchUrl=(keyword:string)=>`https://search.shopping.naver.com/search/all?query=${encodeURIComponent(keyword)}&frm=NVSCPRO`;

/** Only explicit ad positions on the matching search page qualify. Never infer ranks from organic results. */
export function validateShoppingAdSnapshot(raw:unknown,keyword:string,now=Date.now()):ShoppingAdSnapshot{
 if(!raw||typeof raw!=='object')throw Error('광고 확인 자료가 없어요.');
 const data=raw as Record<string,unknown>;
 if(typeof data.keyword!=='string'||normalize(data.keyword)!==normalize(keyword)||data.device!=='PC'||typeof data.context!=='string'||!data.context.trim()||data.context.length>200||typeof data.complete!=='boolean')throw Error('다른 검색 조건의 자료예요.');
 if(typeof data.observedAt!=='string'||!Number.isFinite(Date.parse(data.observedAt))||Date.parse(data.observedAt)>now+60000)throw Error('확인 시각이 올바르지 않아요.');
 const source=new URL(String(data.sourceUrl));
 if(source.protocol!=='https:'||source.hostname!=='search.shopping.naver.com'||source.pathname!=='/search/all'||source.username||source.password||normalize(source.searchParams.get('query')||'')!==normalize(keyword))throw Error('검색 출처를 확인할 수 없어요.');
 if(!Array.isArray(data.items)||data.items.length>3)throw Error('광고 상품 자료가 올바르지 않아요.');
 const ranks=new Set<number>();
 const items:ShoppingAd[]=data.items.map((item:unknown)=>{
  if(!item||typeof item!=='object')throw Error('상품 자료가 없어요.');
  const row=item as Record<string,unknown>;
  if(row.ad!==true||typeof row.rank!=='number'||!Number.isInteger(row.rank)||row.rank<1||row.rank>3||ranks.has(row.rank))throw Error('광고 순위를 확인할 수 없어요.');
  ranks.add(row.rank);
  if(typeof row.title!=='string'||!row.title.trim()||row.title.length>300||typeof row.mall!=='string'||row.mall.length>100||row.price!==null&&(typeof row.price!=='number'||!Number.isSafeInteger(row.price)||row.price<=0))throw Error('상품명과 가격을 확인할 수 없어요.');
  let image:string|null=null;
  if(typeof row.image==='string'){
   const url=new URL(row.image);
   if(url.protocol==='https:'&&!url.username&&!url.password&&url.hostname.endsWith('.pstatic.net'))image=url.href;
  }
  let capture:string|null=null;
  if(row.capture!==undefined&&row.capture!==null){
   if(typeof row.capture!=='string'||row.capture.length>350023||!/^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]*={0,2}$/.test(row.capture))throw Error('광고 캡처 자료가 올바르지 않아요.');
   const bytes=atob(row.capture.slice('data:image/jpeg;base64,'.length));
   if(bytes.length<4||bytes.charCodeAt(bytes.length-2)!==255||bytes.charCodeAt(bytes.length-1)!==217)throw Error('광고 캡처가 완전하지 않아요.');
   capture=row.capture;
  }
  const text=(key:string,max=200)=>typeof row[key]==='string'?(row[key] as string).trim().slice(0,max):'';
  const amount=(key:string)=>typeof row[key]==='number'&&Number.isSafeInteger(row[key])&&(row[key] as number)>0?row[key] as number:null;
  const rating=typeof row.rating==='number'&&Number.isFinite(row.rating)&&row.rating>=0&&row.rating<=5?row.rating:null;
  return {rating,reviewCount:text('reviewCount',30),wishCount:text('wishCount',30),originalPrice:amount('originalPrice'),couponPrice:amount('couponPrice'),promotion:text('promotion'),shipping:text('shipping'),category:text('category',400),specifications:text('specifications',2000),registeredAt:text('registeredAt',30),rank:row.rank,ad:true,title:row.title.trim(),mall:row.mall.trim(),price:row.price as number|null,image,capture};
 });
 return {keyword:data.keyword,device:'PC',sourceUrl:source.href,observedAt:data.observedAt,context:data.context,complete:data.complete,items:items.sort((a,b)=>a.rank-b.rank)};
}
