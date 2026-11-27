'use client';
import {useState} from 'react';

const disciplines=[
  {label:'Product', title:'팔리는 상품의 조건을 찾습니다.', description:'검색 수요와 판매 비용을 살펴, 상품의 가격과 판매 방향을 정합니다.'},
  {label:'Pop-up', title:'고객이 브랜드를 만나는 공간.', description:'상품을 직접 경험하고 기억할 수 있는 팝업을 기획합니다.'},
  {label:'Branding', title:'다시 찾는 브랜드를 만듭니다.', description:'상품, 메시지, 디자인에 하나의 방향을 담습니다.'},
] as const;

export function AboutGalleryHero(){
  const [current,setCurrent]=useState(0);
  return <section className="dw-hero" aria-label="키츠노드 프로젝트 분야">
    <div className="dw-landing">
      <div className="dw-landing-scenes">
        {disciplines.map((item,index)=><div key={item.label} id={'about-discipline-'+index} className="dw-landing-scene" data-active={current===index}
          aria-hidden={current!==index}>
          <div className="dw-landing-copy">
            <h2>{item.title}</h2>
            <p>{item.description}</p>
          </div>
        </div>)}
      </div>
      <div className="dw-landing-controls">
        <div className="dw-disciplines" role="group" aria-label="프로젝트 분야 선택">
          {disciplines.map(({label},index)=><button key={label} type="button" className="dw-discipline" aria-controls={'about-discipline-'+index}
            aria-pressed={current===index} onClick={()=>setCurrent(index)}>{label}</button>)}
        </div>
      </div>
    </div>
    <div className="dw-copy">
      <span className="dw-eyebrow">KITSNODE · BRAND GROWTH PARTNER</span>
      <h1>순위 말고,<br/><em>브랜드를 남깁니다.</em></h1>
    </div>
  </section>;
}
