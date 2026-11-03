export type KeywordBenchmark = {keyword:string;cpc:number;clicks:number;device:string};
export type KeywordCategory = {id:string;label:string;main:KeywordBenchmark;alternatives:KeywordBenchmark[];shoppingRanks:readonly number[];rankDevice:'PC'|'MOBILE';rankProduct:string};
// Summarized figures read in the advertiser dashboard on 2026-11-03.
// CPC includes VAT; rank estimates exclude VAT. Groups represent targeting themes, not exact search queries.
export const keywordCategories:KeywordCategory[] = [
 {id:'battery',label:'보조배터리',main:{keyword:'보조배터리',cpc:2232,clicks:427,device:'PC'},alternatives:[
 {keyword:'미니보조배터리',cpc:1280,clicks:128,device:'그룹 전체'},
 {keyword:'갤럭시보조배터리',cpc:1433,clicks:229,device:'그룹 전체'},
 {keyword:'아이폰보조배터리',cpc:1649,clicks:317,device:'그룹 전체'},
 {keyword:'보조배터리10000',cpc:1732,clicks:747,device:'그룹 전체'},
 {keyword:'보조배터리추천',cpc:1811,clicks:231,device:'그룹 전체'},
 {keyword:'고속보조배터리',cpc:1939,clicks:412,device:'그룹 전체'}],shoppingRanks:[3470,2450,2140],rankDevice:'PC',rankProduct:'QP1000C'},
 {id:'wireless',label:'무선충전기',main:{keyword:'무선충전기',cpc:1580,clicks:397,device:'모바일'},alternatives:[
 {keyword:'2in1충전기',cpc:1019,clicks:115,device:'그룹 전체'},
 {keyword:'애플워치충전기',cpc:1211,clicks:110,device:'그룹 전체'},
 {keyword:'맥세이프충전기',cpc:1219,clicks:188,device:'그룹 전체'},
 {keyword:'갤럭시워치충전기',cpc:1251,clicks:88,device:'그룹 전체'},
 {keyword:'Qi2충전기',cpc:1332,clicks:146,device:'그룹 전체'},
 {keyword:'아이폰충전기',cpc:1345,clicks:168,device:'그룹 전체'}],shoppingRanks:[1400,1070,960],rankDevice:'MOBILE',rankProduct:'ACONE'}
];
export function normalizeKeyword(value:string){return value.toLowerCase().replace(/\s+/g,'');}
export function matchKeywordCategory(keyword:string){const key=normalizeKeyword(keyword);return keywordCategories.find(c=>[c.main,...c.alternatives].some(k=>normalizeKeyword(k.keyword)===key))??null;}
export function keywordEconomics(cpc:number,cvrPercent:number,perOrder:number,budget:number){
 if(![cpc,cvrPercent,perOrder,budget].every(Number.isFinite)||cpc<=0||cvrPercent<=0||cvrPercent>100||perOrder<0||budget<0)return null;
 const cpa=cpc/(cvrPercent/100);
 return {cpa,contribution:perOrder-cpa,requiredCvr:perOrder>0?cpc/perOrder*100:null,maxClicks:Math.floor(budget/cpc),affordable:perOrder>=cpa};
}

export function inferProductCategory(productName:string){
 const key=normalizeKeyword(productName);
 // An accessory mentioning another product is not that product's CPC benchmark.
 if(/케이스|파우치|커버/.test(key))return null;
 if(key.includes('보조배터리'))return keywordCategories.find(c=>c.id==='battery')!;
 if(/무선충전|맥세이프충전|qi2충전|[23]in1충전|애플워치충전|갤럭시워치충전/.test(key))return keywordCategories.find(c=>c.id==='wireless')!;
 return null;
}
