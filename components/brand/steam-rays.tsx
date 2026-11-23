import { cn } from "@/lib/utils"

/**
 * The STEAM LT Klaipėda graphic element: five rays from one point
 * (DESIGN-SYSTEM.md, "Prekės ženklas"). Decorative only, so it is hidden
 * from assistive technology.
 *
 * `draw` plays the one deliberate motion of a page: the rays draw
 * themselves once from the centre. It is pure CSS, runs once, and is
 * switched off by prefers-reduced-motion (the rays are then simply there).
 * Use it large on a first screen and small or not at all elsewhere.
 */
const RAYS = [
  { angle: -128, length: 46, color: "#008CB5" },
  { angle: -48, length: 40, color: "#FF306D" },
  { angle: 2, length: 50, color: "#00D99B" },
  { angle: 52, length: 38, color: "#003B4E" },
  { angle: 118, length: 34, color: "#FFCE4E" },
] as const

export function SteamRays({
  className,
  draw = false,
  onDark = false,
}: {
  className?: string
  /** Draw the rays once when the element appears. */
  draw?: boolean
  /** On a dark surface the dark blue ray would vanish: it becomes white. */
  onDark?: boolean
}) {
  return (
    <svg
      viewBox="-60 -60 120 120"
      aria-hidden="true"
      focusable="false"
      className={cn("steam-rays", draw && "steam-rays-draw", className)}
    >
      {RAYS.map((ray, i) => {
        const rad = (ray.angle * Math.PI) / 180
        const x = Math.round(Math.cos(rad) * ray.length * 100) / 100
        const y = Math.round(Math.sin(rad) * ray.length * 100) / 100
        return (
          <line
            key={ray.angle}
            x1={0}
            y1={0}
            x2={x}
            y2={y}
            pathLength={1}
            stroke={onDark && ray.color === "#003B4E" ? "#FFFFFF" : ray.color}
            strokeWidth={7}
            strokeLinecap="round"
            style={{ animationDelay: `${i * 70}ms` }}
          />
        )
      })}
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
