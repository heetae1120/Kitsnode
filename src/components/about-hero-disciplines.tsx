const disciplines = ['프로덕트', '팝업', '브랜딩'];

/** Media slots are intentionally empty until project photos or videos are selected. */
export function AboutHeroDisciplines() {
  return <div className="dw-disciplines" role="group" aria-label="프로젝트 분야">
    {disciplines.map((label, index) => <button type="button" key={label} className="dw-discipline" aria-label={label}>
      <span className="dw-discipline-name">{label}</span><sup>0{index + 1}</sup>
      <span className="dw-discipline-preview" data-media-slot={index} aria-hidden="true">
        <span>0{index + 1}</span><span>{label}</span>
      </span>
    </button>)}
  </div>;
}
