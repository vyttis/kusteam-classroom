/**
 * STEAM LT Klaipėda logo, drawn from the official files of the brand style
 * sheet (public/brand). The style sheet does not allow changing the shape of
 * the symbol, the wordmark or their arrangement, so nothing here is redrawn:
 *
 * - colour: on a white or light surface;
 * - `tone="white"`: the one-colour white version for dark surfaces;
 * - `symbol={false}`: the wordmark alone, used next to a large ray element
 *   so the rays are not shown twice (white on dark by inversion, as the
 *   style sheet itself shows it).
 *
 * Smallest allowed size (style sheet): 150 px wide with the symbol, 68 px
 * without. The sizes below respect it.
 */
const FILES = {
  colour: { src: "/brand/steam-lt-klaipeda.png", w: 569, h: 183 },
  white: { src: "/brand/steam-lt-klaipeda-white.png", w: 569, h: 183 },
  wordmark: { src: "/brand/steam-lt-klaipeda-wordmark.png", w: 569, h: 85 },
} as const

/** Rendered height of the full logo, per size. */
const HEIGHTS = { small: 50, default: 60, large: 76 } as const

export function SteamLogo({
  className = "",
  size = "default",
  symbol = true,
  tone = "colour",
}: {
  className?: string
  size?: "small" | "default" | "large"
  symbol?: boolean
  tone?: "colour" | "white"
}) {
  const file = symbol ? FILES[tone] : FILES.wordmark
  // The wordmark keeps the height it has inside the full logo.
  const height = symbol ? HEIGHTS[size] : Math.round((HEIGHTS[size] * FILES.wordmark.h) / FILES.colour.h)
  const width = Math.round((height * file.w) / file.h)
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a small static brand file; no optimisation needed
    <img
      src={file.src}
      alt="STEAM LT Klaipėda"
      width={width}
      height={height}
      className={`${!symbol && tone === "white" ? "brightness-0 invert " : ""}${className}`}
      decoding="async"
    />
  )
}
