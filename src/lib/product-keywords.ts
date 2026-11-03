import {normalizeKeyword} from './keyword-budget';
import {rowVolume,type KeywordRow} from './naver-keywords';
export function productKeywordSeed(productName:string){
 const words=productName.trim().split(/[^a-zA-Z0-9가-힣]+/).filter(word=>/[가-힣]{2}/.test(word)&&word.length<=50);
 const candidate=words.at(-1)||productName.replace(/[^a-zA-Z0-9가-힣]/g,'').slice(0,50);
 if(!candidate)throw Error('품목명에서 검색할 단어를 찾지 못했습니다. 상품 종류가 포함된 품목명을 입력하세요.');
 return candidate;
}
export function selectProductKeywords(seed:string,rows:KeywordRow[]){
 const key=normalizeKeyword(seed);
 const related=rows.filter(row=>normalizeKeyword(row.keyword).includes(key)&&normalizeKeyword(row.keyword).length<=50);
 related.sort((a,b)=>(rowVolume(b,'all')?.min??0)-(rowVolume(a,'all')?.min??0));
 const main=related.find(row=>normalizeKeyword(row.keyword)===key)??related[0];
 if(!main)return [];
 return [main,...related.filter(row=>row!==main&&normalizeKeyword(row.keyword).length>key.length).slice(0,3)];
}
