/** Planning references, not measured marketplace averages. Confirmed 2026-11-10. */
export const plannerMarketFees=[
 {id:'smartstore',name:'스마트스토어',mark:'N',rate:'6',source:'https://help.sell.smartstore.naver.com/faq/content.help?faqId=15759',basis:'판매·결제 수수료를 함께 고려한 간편 참고값'},
 {id:'coupang',name:'쿠팡',mark:'C',rate:'8.2',source:'https://marketplace.coupang.com/information-center/almyeon-alsurog-deo-joheun-kupang-susuryo-2',basis:'공개 범위 4~10.9%의 중간값에 부가세를 고려한 참고값'},
 {id:'auction',name:'옥션',mark:'A',rate:'13',source:'https://item.esmplus.com/auction-service-fee.html',basis:'여러 일반 상품군의 13% 요율을 이용한 참고값'},
 {id:'gmarket',name:'지마켓',mark:'G',rate:'13',source:'https://item.esmplus.com/gmarket-service-fee.html',basis:'여러 일반 상품군의 13% 요율을 이용한 참고값'},
] as const;
