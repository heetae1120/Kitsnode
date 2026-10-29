export type MenuMotionKind = "profit" | "keywords" | "store" | "ads";

/** Decorative menu graphics; the adjacent text remains the accessible label. */
export function MenuMotion({ kind }: { kind: MenuMotionKind }) {
  return (
    <span className={`menu-motion menu-motion-${kind}`} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" focusable="false">
        {kind === "profit" && (
          <>
            <path className="glyph-axis" d="M4 20h16" />
            <rect className="glyph-bar bar-one" x="5" y="12" width="3" height="6" rx="1" />
            <rect className="glyph-bar bar-two" x="10.5" y="8" width="3" height="10" rx="1" />
            <rect className="glyph-bar bar-three" x="16" y="4" width="3" height="14" rx="1" />
          </>
        )}
        {kind === "keywords" && (
          <>
            <circle className="glyph-lens" cx="10" cy="10" r="5.5" />
            <path className="glyph-handle" d="m14 14 5 5" />
            <g className="glyph-orbit"><circle cx="10" cy="4.5" r="2" /></g>
          </>
        )}
        {kind === "store" && (
          <>
            <rect className="glyph-tile tile-one" x="4" y="4" width="6" height="6" rx="1.5" />
            <rect className="glyph-tile tile-two" x="14" y="4" width="6" height="6" rx="1.5" />
            <rect className="glyph-tile tile-three" x="4" y="14" width="6" height="6" rx="1.5" />
            <rect className="glyph-tile tile-four" x="14" y="14" width="6" height="6" rx="1.5" />
          </>
        )}
        {kind === "ads" && (
          <>
            <circle className="glyph-ring" cx="12" cy="12" r="8" />
            <circle className="glyph-target" cx="12" cy="12" r="4" />
            <path className="glyph-arrow" d="m12 12 8-8m-5 0h5v5" />
          </>
        )}
      </svg>
    </span>
  );
}
