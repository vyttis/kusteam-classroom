const WORDMARK_FONT = "var(--font-metropolis), system-ui, -apple-system, sans-serif"

/**
 * STEAM LT Klaipėda logo. `symbol={false}` draws the wordmark alone: the
 * brand book asks for that next to a large ray element, so the rays are
 * not shown twice.
 */
export function SteamLogo({
  className = "",
  size = "default",
  symbol = true,
}: {
  className?: string
  size?: "small" | "default" | "large"
  symbol?: boolean
}) {
  const sizes = {
    small: { width: 174, height: 48 },
    default: { width: 232, height: 64 },
    large: { width: 290, height: 80 },
  }

  const { width, height } = sizes[size]
  // Without the symbol the box is cropped to the wordmark, at the same scale.
  const box = symbol ? { x: 0, y: 0, w: 290, h: 80 } : { x: 70, y: 16, w: 200, h: 38 }
  const scale = width / 290

  return (
    <svg
      viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}
      width={box.w * scale}
      height={box.h * scale}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ overflow: "visible" }}
      role="img"
      aria-label="STEAM LT Klaipėda"
    >
      {symbol && (
        <g transform="translate(10, 10)">
          {/* Blue line (top-left to center) */}
          <line x1="0" y1="10" x2="25" y2="35" stroke="#008CB5" strokeWidth="4" strokeLinecap="round" />
          {/* Dark line (center going down-right) */}
          <line x1="15" y1="20" x2="40" y2="55" stroke="#003B4E" strokeWidth="4" strokeLinecap="round" />
          {/* Green line (horizontal through center) */}
          <line x1="5" y1="35" x2="55" y2="35" stroke="#00D99B" strokeWidth="4" strokeLinecap="round" />
          {/* Pink line (going up-right from center) */}
          <line x1="25" y1="35" x2="45" y2="15" stroke="#FF306D" strokeWidth="4" strokeLinecap="round" />
          {/* Yellow line (going down-left from center) */}
          <line x1="15" y1="40" x2="5" y2="58" stroke="#FFCE4E" strokeWidth="4" strokeLinecap="round" />
        </g>
      )}
      {/* STEAM text: textLength pins the width, whatever font has loaded */}
      <text x="72" y="48" style={{ fontFamily: WORDMARK_FONT }} fontSize="37" fontWeight="700" fill="#003B4E" textLength="128" lengthAdjust="spacingAndGlyphs">
        STEAM
      </text>
      {/* LT Klaipeda */}
      <text x="208" y="30" style={{ fontFamily: WORDMARK_FONT }} fontSize="13" fontWeight="600" fill="#003B4E" letterSpacing="0.3">
        LT
      </text>
      <text x="208" y="48" style={{ fontFamily: WORDMARK_FONT }} fontSize="13" fontWeight="600" fill="#003B4E" letterSpacing="0.3">
        Klaipėda
      </text>
    </svg>
  )
}
