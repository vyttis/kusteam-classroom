import { cn } from "@/lib/utils"

/**
 * The STEAM LT Klaipėda graphic element: five rays, one per field (S, T, E,
 * A, M), after the pulsar map of the Voyager record. Geometry and colours
 * follow the brand style sheet ("Grafinis elementas"): the rays leave a
 * small hub rather than one point, have square ends and run to the edge of
 * an imagined rectangle.
 *
 * Brand rules kept here:
 * - never one colour, never two rays of the same colour;
 * - the ray whose colour equals the background becomes white (`on`);
 * - next to this element the logo is used without its symbol.
 *
 * Decorative only, so hidden from assistive technology. `draw` plays the
 * one deliberate motion of a page: the rays draw themselves once from the
 * hub. Pure CSS, runs once, off under prefers-reduced-motion.
 */
const COLOURS = {
  dark: "#003B4E",
  yellow: "#FFCE4E",
  green: "#00D99B",
  red: "#FF306D",
  blue: "#008CB5",
} as const

type RayColour = keyof typeof COLOURS

const RAYS: readonly { colour: RayColour; x1: number; y1: number; x2: number; y2: number }[] = [
  { colour: "dark", x1: 198, y1: 166, x2: 180, y2: 16 },
  { colour: "yellow", x1: 206, y1: 170, x2: 304, y2: 110 },
  { colour: "green", x1: 193, y1: 175, x2: 16, y2: 160 },
  { colour: "red", x1: 197, y1: 182, x2: 110, y2: 404 },
  { colour: "blue", x1: 205, y1: 179, x2: 304, y2: 270 },
]

export function SteamRays({
  className,
  draw = false,
  on,
  onDark = false,
  weight = 8,
}: {
  className?: string
  /** Draw the rays once when the element appears. */
  draw?: boolean
  /** The brand colour of the surface behind: that ray becomes white. */
  on?: RayColour
  /** Shorthand for `on="dark"`. */
  onDark?: boolean
  /**
   * Line weight in the 320 x 420 drawing. The default suits the element at
   * interface sizes (up to about 200 px); use 5, the style sheet's weight,
   * when it is shown large (the class screen).
   */
  weight?: number
}) {
  const surface = on ?? (onDark ? "dark" : undefined)
  return (
    <svg
      viewBox="0 0 320 420"
      aria-hidden="true"
      focusable="false"
      className={cn("steam-rays", draw && "steam-rays-draw", className)}
    >
      {RAYS.map((ray, i) => (
        <line
          key={ray.colour}
          x1={ray.x1}
          y1={ray.y1}
          x2={ray.x2}
          y2={ray.y2}
          pathLength={1}
          stroke={ray.colour === surface ? "#FFFFFF" : COLOURS[ray.colour]}
          strokeWidth={weight}
          strokeLinecap="butt"
          style={{ animationDelay: `${i * 70}ms` }}
        />
      ))}
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          .steam-rays-draw line {
            stroke-dasharray: 1;
            stroke-dashoffset: 1;
            animation: steam-ray-draw 520ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
          }
        }
        @keyframes steam-ray-draw { to { stroke-dashoffset: 0; } }
      `}</style>
    </svg>
  )
}
