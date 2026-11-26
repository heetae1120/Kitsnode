const modulePath = 'M-80 80V-4a76 76 0 0 1 76-76h84v56H-4a20 20 0 0 0-20 20v84z';

// Each tuple is [x, y, rotation, scale] in the shared SVG view box.
const compositions = [
  [[-65,-65,0,.78],[65,-65,90,.78],[65,65,180,.78],[-65,65,270,.78]],
  [[-80,-58,90,.65],[80,-58,0,.65],[80,58,270,.65],[-80,58,180,.65]],
  [[-84,-78,-24,.86],[76,-86,112,.83],[84,83,155,.83],[-76,82,291,.86]],
  [[-42,-42,0,.52],[42,-42,90,.52],[42,42,180,.52],[-42,42,270,.52]],
] as const;

export function StoryArtwork({scene}:{scene:number}) {
  return (
    <div className="as-story-artwork" aria-hidden="true">
      <svg viewBox="-190 -190 380 380" focusable="false">
        <g className="as-story-composition">
          {compositions[scene].map(([x,y,angle,scale],index)=>(
            <path
              key={index}
              className="as-story-module"
              d={modulePath}
              style={{transform:`translate(${x}px,${y}px) rotate(${angle}deg) scale(${scale})`}}
            />
          ))}
        </g>
      </svg>
    </div>
  );
}
