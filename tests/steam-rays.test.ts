import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"

describe("the STEAM rays element", () => {
  const src = readFileSync("components/brand/steam-rays.tsx", "utf8")

  it("uses the five brand colours, each once", () => {
    const colours = [...src.matchAll(/: "(#[0-9A-F]{6})"/g)].map((m) => m[1]).sort()
    expect(colours).toEqual(["#003B4E", "#008CB5", "#00D99B", "#FF306D", "#FFCE4E"])
    const rays = [...src.matchAll(/\{ colour: "(\w+)", x1/g)].map((m) => m[1])
    expect(rays).toHaveLength(5)
    expect(new Set(rays).size).toBe(5)
  })

  it("turns only the ray that matches the surface white", () => {
    expect(src).toContain('ray.colour === surface ? "#FFFFFF" : COLOURS[ray.colour]')
  })

  it("is decorative and moves only when motion is allowed", () => {
    expect(src).toContain('aria-hidden="true"')
    expect(src).toContain("prefers-reduced-motion: no-preference")
    expect(src).not.toMatch(/infinite/)
  })
})
