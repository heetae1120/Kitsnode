"use client";
import { ShoppingBag, MousePointer2, CheckCircle2 } from 'lucide-react';
import './ad-type-switch.css';
export type AdType = "shopping-search" | "powerlink";
export const adTypeName = (type: AdType) =>
  type === "shopping-search" ? "쇼핑검색광고" : "파워링크";
export function AdTypeSwitch({
  value,
  onChange,
}: {
  value: AdType;
  onChange: (value: AdType) => void;
}) {
  return (
    <fieldset className="ad-type-switch">
      <legend>분석할 광고 유형</legend>
      <div>
        {(["shopping-search", "powerlink"] as const).map((type) => (
          <button
            type="button"
            key={type}
            aria-pressed={value === type}
            onClick={() => onChange(type)}
          >
            {type==='shopping-search'?<ShoppingBag size={25}/>:<MousePointer2 size={25}/>}
            <span><b>{adTypeName(type)}</b><small>{type==='shopping-search'?'상품 중심으로 노출하는 광고':'키워드로 고객을 만나는 광고'}</small></span>
            {value===type&&<CheckCircle2 size={20} className="ad-type-selected-icon"/>}
          </button>
        ))}
      </div>
      <p>
        광고 유형별 입찰가와 실적을 구분합니다. 추정 입찰가는 실제 결제 평균
        CPC와 다릅니다.
      </p>
    </fieldset>
  );
}
