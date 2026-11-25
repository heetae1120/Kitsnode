"use client";
import {useId,useState} from 'react';
import {CircleAlert} from 'lucide-react';
import {plannerMarketFees} from '@/lib/planner-market-fees';

const hints:Record<string,{text:string;links?:[string,string][]}>={
 available:{text:'상품 구매, 배송, 홍보에 지금 쓸 수 있는 금액을 입력하세요.'},
 price:{text:'상품 1개를 얼마에 팔고 싶은지 입력하세요.'},
 cost:{text:'상품 1개를 매입하는 데 드는 비용을 입력하세요.'},
 quantity:{text:'판매할 총 수량을 입력하세요.'},
 feePercent:{text:'플랫폼을 선택하면 계산용 참고값이 적용돼요. 실제 요율을 알고 있다면 ‘그 외’에서 직접 입력하세요.',links:[...plannerMarketFees.map(({name,source}):[string,string]=>[name+' 판매 수수료',source]),['네이버 Npay 등급별 수수료','https://help.sell.smartstore.naver.com/faq/content.help?faqId=3713']]},
 logistics:{text:'부담하는 입고·보관·배송비를 상품 1개 기준으로 합산하세요. 참고값은 3,000원이에요.'},
 packaging:{text:'박스, 완충재, 사은품 등을 상품 1개 기준으로 합산하세요. 참고값은 1,000원이에요.'},
 creativeCost:{text:'상세페이지와 썸네일 제작에 쓴 전체 금액이에요. 상품 1개당 이익은 총 제작비를 판매 수량으로 나눠 계산해요.'},
 returnRate:{text:'100개 중 5개가 반품될 것으로 예상하면 5%를 입력하세요. 0%를 넘으면 반품 처리비도 입력해 주세요.'},
 certification:{text:'이번 상품의 인증·시험에 드는 총비용을 입력하세요. 인증비가 없으면 0원을 입력하세요.'},
 returnHandling:{text:'회수, 재포장, 재판매 불가로 생기는 비용을 반품 1건 기준으로 더하세요. 참고값은 5,000원이에요.'},
};
export function PlannerCostHelp({field,label}:{field:string;label:string}){
 const [open,setOpen]=useState(false);const id=useId();const hint=hints[field];if(!hint)return null;
 const feeDetails=field==='feePercent'?plannerMarketFees.map(({name,rate,basis})=>`${name} ${rate}%. ${basis}`):[];
 return <span className="mp-field-help" onMouseEnter={()=>setOpen(true)} onMouseLeave={()=>setOpen(false)} onFocus={()=>setOpen(true)} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node|null))setOpen(false);}} onKeyDown={e=>{if(e.key==='Escape')setOpen(false);}}>
   <span id={`mp-help-${field}`} className="ds-sr-only">{[...feeDetails,hint.text].join(' ')}</span>
   <button type="button" tabIndex={-1} className="mp-hint-button" aria-label={`${label} 입력 안내`} aria-expanded={open} aria-controls={id} onClick={()=>setOpen(true)}><CircleAlert size={16}/></button>
   {open&&<span id={id} role="note" className="mp-help-content"><b>{label}</b>{feeDetails.map(detail=><span className="mp-help-fee-basis" key={detail}>{detail}</span>)}<span>{hint.text}</span>{hint.links&&<span className="mp-help-links">{hint.links.map(([text,href])=><a key={href} tabIndex={-1} href={href} target="_blank" rel="noreferrer">{text} ↗</a>)}</span>}</span>}
 </span>;
}
