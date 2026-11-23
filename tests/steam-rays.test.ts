import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"

describe("the STEAM rays element", () => {
  const src = readFileSync("components/brand/steam-rays.tsx", "utf8")

  it("uses the five brand colours and nothing else", () => {
    const colours = [...src.matchAll(/color: "(#[0-9A-F]{6})"/g)].map((m) => m[1])
    expect(colours).toEqual(["#008CB5", "#FF306D", "#00D99B", "#003B4E", "#FFCE4E"])
  })

  it("is decorative and moves only when motion is allowed", () => {
    expect(src).toContain('aria-hidden="true"')
    expect(src).toContain("prefers-reduced-motion: no-preference")
    expect(src).not.toMatch(/infinite/)
  })
})
