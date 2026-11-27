/**
 * A small disc lit from one side. The shadow edge slides across it as the stage's
 * --kn-hero-shade value falls, so the same form reads as sun by day and moon by night.
 */
export function DaylightMark(){
  return <svg className="kn-daylight" viewBox="0 0 100 100" aria-hidden="true">
    <defs><clipPath id="kn-daylight-disc"><circle cx="50" cy="50" r="40"/></clipPath></defs>
    <g clipPath="url(#kn-daylight-disc)">
      <circle className="kn-daylight-body" cx="50" cy="50" r="40"/>
      <circle className="kn-daylight-shade" cx="50" cy="50" r="40"/>
    </g>
  </svg>;
}
