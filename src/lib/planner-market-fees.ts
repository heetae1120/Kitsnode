/** Planning references, not measured marketplace averages. Confirmed 2026-11-10. */
export const plannerMarketFees=[
 {id:'smartstore',name:'네이버',mark:'N',rate:'6',source:'https://help.sell.smartstore.naver.com/faq/content.help?faqId=15759',basis:'스마트스토어의 판매 수수료와 Npay 주문관리 수수료를 함께 고려했어요. 실제 요율은 유입 경로와 가맹점 매출 등급에 따라 달라져요.'},
 {id:'coupang',name:'쿠팡',mark:'C',rate:'8.2',source:'https://marketplace.coupang.com/information-center/almyeon-alsurog-deo-joheun-kupang-susuryo-2',basis:'공개된 카테고리별 판매 수수료 범위(4~10.9%)의 중간값에 부가세를 반영했어요. 실제 요율은 판매 카테고리에 따라 달라지며, 물류비와 월 이용료는 별도예요.'},
] as const;
