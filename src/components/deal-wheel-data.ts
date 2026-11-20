const sources = [
  {image:'/about-gallery/brand-making.webp', label:'브랜드 준비 현장', href:'#proof', tone:'photo'},
  {art:'trend', label:'상품 수익 진단', href:'/tools/', tone:'paper'},
  {image:'/about-gallery/brand-people.webp', label:'고객과 만나는 브랜드 현장', href:'#proof', tone:'photo'},
  {art:'bars', label:'검색어 수요 확인', href:'/tools/keywords/', tone:'dark'},
  {art:'steps', label:'브랜드의 다음 단계', href:'/tools/survey/', tone:'paper'},
  {art:'arrow', label:'광고 운영 방향 점검', href:'/tools/', tone:'orange'},
  {art:'compound', label:'꾸준한 성장을 위한 상담', href:'/tools/consultation/', tone:'paper'},
  {art:'milestones', label:'브랜드 성장 사례', href:'#proof', tone:'dark'},
  {art:'columns', label:'판매 계획 살펴보기', href:'/tools/', tone:'orange'},
] as const;
export type DealWheelCard = {image?:string;video?:string;art?:'trend'|'bars'|'steps'|'compound'|'arrow'|'milestones'|'columns';label:string;href:string;tone:string};
export const dealWheelCards: DealWheelCard[] = Array.from({length:34}, (_, index) => sources[index % sources.length]);
