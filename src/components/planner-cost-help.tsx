"use client";
import {useId,useState} from 'react';
import {CircleAlert} from 'lucide-react';

const hints:Record<string,{text:string;links?:[string,string][]}>={
 available:{text:'구매·배송·홍보에 쓸 전체 돈이에요. 앞으로 생길 매출은 더하지 마세요.'},
 price:{text:'할인·쿠폰을 뺀 최종 판매가예요. 예: 한 개 28,500원.'},
 cost:{text:'한 개를 사거나 만드는 비용이에요. 예: 12,000원. 배송비는 다음 칸에 따로 넣으세요.'},
 quantity:{text:'이번에 준비할 개수예요. 예: 100개. 원가와 곱하면 총 구매비가 나와요.'},
 feePercent:{text:'네이버 7%는 참고용 예시예요. 실제 요율은 내 정산서를 보세요. 쿠팡윙은 상품별 4~10.9%, 로켓그로스도 판매수수료는 같아요. 로켓그로스 물류비는 별도예요. 세금·추가 요금도 확인하세요. 2026.11.04 확인.',links:[['네이버','https://help.sell.smartstore.naver.com/faq/content.help?faqId=3962'],['쿠팡윙','https://marketplace.coupang.com/information-center/almyeon-alsurog-deo-joheun-kupang-susuryo-2'],['로켓그로스','https://marketplace.coupang.com/rocket-growth']]},
 logistics:{text:'참고값은 한 개당 3,000원이에요. 내 계약에 맞게 바꾸세요. 입고·보관·배송비 중 내가 부담하는 돈만 더하세요.'},
 packaging:{text:'참고값은 한 개당 500원이에요. 박스·완충재·사은품 비용을 넣으세요. 월 이용료가 있다면 이번 판매 수량으로 나눠 더하세요.'},
 returnRate:{text:'참고값 5%는 100개 중 5개가 반품된다는 뜻이에요. 실제 평균은 아니에요. 반품 한 건 처리비도 함께 넣어주세요.'},
 returnHandling:{text:'참고값은 한 건당 5,000원이에요. 회수·재포장·다시 팔 수 없는 손실을 더하세요. 반품률 5%라면 한 개당 250원이 비용에 붙어요.'},
};
export function PlannerCostHelp({field,label}:{field:string;label:string}){
 const [open,setOpen]=useState(false);const id=useId();const hint=hints[field];if(!hint)return null;
 return <span className="mp-field-help" onMouseEnter={()=>setOpen(true)} onMouseLeave={()=>setOpen(false)} onFocus={()=>setOpen(true)} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node|null))setOpen(false);}} onKeyDown={e=>{if(e.key==='Escape')setOpen(false);}}>
   <button type="button" className="mp-hint-button" aria-label={`${label} 비용 안내`} aria-expanded={open} aria-controls={id} onClick={()=>setOpen(true)}><CircleAlert size={16}/></button>
   {open&&<span id={id} role="note" className="mp-help-content"><b>{label} · 입력 참고</b><span>{hint.text}</span>{hint.links&&<span className="mp-help-links">{hint.links.map(([text,href])=><a key={href} href={href} target="_blank" rel="noreferrer">{text} ↗</a>)}</span>}</span>}
 </span>;
}
