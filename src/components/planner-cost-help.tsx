"use client";
import {useId,useState} from 'react';
import {CircleAlert} from 'lucide-react';

const hints:Record<string,{text:string;links?:[string,string][]}>={
 available:{text:'상품 구매, 배송·포장, 수수료, 홍보비용에 사용할 전체 금액입니다. 예: 5,000,000원. 평균값이 아니라 실제 쓸 수 있는 돈을 입력하세요.'},
 price:{text:'상품 1개를 고객에게 판매할 가격입니다. 예: 28,500원. 할인·쿠폰을 적용한다면 고객의 최종 결제 가격으로 입력하세요.'},
 cost:{text:'상품 1개를 구매하거나 제조하는 데 든 금액입니다. 예: 12,000원. 해외 구매라면 원화로 환산하고, 다음 단계의 배송비와 중복하지 마세요.'},
 quantity:{text:'이번에 준비하고 판매할 개수입니다. 예: 100개. 원가 × 수량이 구매에 필요한 금액이며, 아직 발생하지 않은 매출을 가용비용에 더하지 않습니다.'},
 feePercent:{text:'플랫폼마다 달라 공통 평균은 없습니다. 네이버 7%는 계산 예시이며 고정 요율이 아닙니다. Npay 수수료와 유입·판매 수수료 등 내 정산 조건을 합쳐 입력하세요. 쿠팡윙 판매자배송은 공식 안내상 카테고리별 4~10.9%. 로켓그로스 판매수수료는 판매자배송과 같고 입출고·배송·보관 등 물류비는 별도입니다. 부가세와 부가 요금을 포함한 실제 부담률을 정산서에서 확인하세요. 확인일 2026.11.04.',links:[['네이버 수수료 안내','https://help.sell.smartstore.naver.com/faq/content.help?faqId=3962'],['쿠팡 판매수수료','https://marketplace.coupang.com/information-center/almyeon-alsurog-deo-joheun-kupang-susuryo-2'],['로켓그로스 비용','https://marketplace.coupang.com/rocket-growth']]},
 logistics:{text:'예시: 상품 1개당 3,000원. 공통 평균이 아닌 입력 예시입니다. 실제 입고·보관·출고·판매자 부담 배송비를 합쳐 주세요. 고객이 전액 부담하면 판매자 부담분만 입력합니다. 로켓그로스도 판매수수료 외의 물류비를 이곳에 넣으세요.'},
 packaging:{text:'예시: 상품 1개당 500원. 공통 평균은 없으므로 박스·완충재·사은품의 실제 비용을 더하세요. 월 서비스 이용료 등 다른 판매비가 있다면 이번 계획에 해당하는 금액을 판매 계획 수량으로 나눠 포함하세요.'},
 returnRate:{text:'예시: 100개 중 5개가 반품된다면 5%. 업종·상품별 차이가 커 공통 평균을 적용하지 않습니다. 내 예상 반품률을 입력하고, 0%보다 크면 반품 1건당 처리 비용도 입력하세요. 반품률 × 처리 비용을 개당 비용에 반영합니다. 회수하지 못하는 상품 대금은 처리 비용에 포함하고 다른 칸과 중복하지 마세요.'},
 returnHandling:{text:'반품 1건에서 판매자가 부담하는 회수·재배송·검수·재포장·양품 전환·폐기 손실을 합친 금액입니다. 예: 5,000원. 반품률 5%라면 판매 계획 상품 1개당 250원을 비용으로 잡습니다. 계약·상품별 실제 금액을 확인하세요.'},
};
export function PlannerCostHelp({field,label}:{field:string;label:string}){
 const [open,setOpen]=useState(false);const id=useId();const hint=hints[field];if(!hint)return null;
 return <span className="mp-field-help" onMouseEnter={()=>setOpen(true)} onMouseLeave={()=>setOpen(false)} onFocus={()=>setOpen(true)} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node|null))setOpen(false);}} onKeyDown={e=>{if(e.key==='Escape')setOpen(false);}}>
   <button type="button" className="mp-hint-button" aria-label={`${label} 비용 안내`} aria-expanded={open} aria-controls={id} onClick={()=>setOpen(true)}><CircleAlert size={16}/></button>
   {open&&<span id={id} role="note" className="mp-help-content"><b>{label} · 입력 참고</b><span>{hint.text}</span>{hint.links&&<span className="mp-help-links">{hint.links.map(([text,href])=><a key={href} href={href} target="_blank" rel="noreferrer">{text} ↗</a>)}</span>}</span>}
 </span>;
}
