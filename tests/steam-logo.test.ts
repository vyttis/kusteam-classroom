import { describe, expect, it } from "vitest"
import { existsSync, readFileSync } from "node:fs"

describe("the STEAM logo", () => {
  const src = readFileSync("components/steam-logo.tsx", "utf8")

  it("uses the official brand files, not a redrawn symbol", () => {
    for (const file of ["steam-lt-klaipeda.png", "steam-lt-klaipeda-white.png", "steam-lt-klaipeda-wordmark.png"]) {
      expect(src).toContain(`/brand/${file}`)
      expect(existsSync(`public/brand/${file}`), file).toBe(true)
    }
    expect(src).not.toMatch(/<line|<text/)
  })

  it("never renders the full logo below the smallest width the style sheet allows", () => {
    const heights = [...src.matchAll(/(small|default|large): (\d+)/g)].map((m) => Number(m[2]))
    expect(heights).toHaveLength(3)
    for (const h of heights) expect(Math.round((h * 569) / 183)).toBeGreaterThanOrEqual(150)
  })

  it("has a text alternative", () => {
    expect(src).toContain('alt="STEAM LT Klaipėda"')
  })
})
