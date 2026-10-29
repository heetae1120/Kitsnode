"use client";
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
            {adTypeName(type)}
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
