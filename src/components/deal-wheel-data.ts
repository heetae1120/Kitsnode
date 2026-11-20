import {WHEEL_SLOTS} from '@/lib/deal-wheel';

const sources = [
  {image:'/about-gallery/brand-making.webp', label:'브랜드 준비 현장', tone:'photo'},
  {art:'trend', label:'상품 수익 진단', tone:'paper'},
  {image:'/about-gallery/brand-people.webp', label:'고객과 만나는 브랜드 현장', tone:'photo'},
  {art:'bars', label:'검색어 수요 확인', tone:'dark'},
  {art:'steps', label:'브랜드의 다음 단계', tone:'paper'},
  {art:'arrow', label:'광고 운영 방향 점검', tone:'orange'},
] as const;
export type DealWheelCard = {image?:string;video?:string;art?:'trend'|'bars'|'steps'|'compound'|'arrow'|'milestones'|'columns';label:string;tone:string};
export const dealWheelCards: readonly DealWheelCard[] = sources;

export const dealWheelSlots: readonly DealWheelCard[] = Array.from({length:WHEEL_SLOTS}, (_, index) => sources[index % sources.length]);
