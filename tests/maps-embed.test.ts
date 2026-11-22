import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

// Participants' devices must not contact Google before the person asks for
// the map (audit R-03): the privacy notice names Google for facilitator
// sign-in only.
describe("MapsEmbed", () => {
  const source = readFileSync("components/shared/maps-embed.tsx", "utf8")

  it("renders the Google iframe only after the person asks for the map", () => {
    const iframe = source.indexOf("<iframe")
    expect(iframe).toBeGreaterThan(-1)
    expect(source.lastIndexOf("{shown ? (", iframe)).toBeGreaterThan(-1)
    expect(source).toContain("useState(false)")
    expect(source).toContain("Rodyti žemėlapį")
  })

  it("has a single iframe, so no path loads the map on its own", () => {
    expect(source.match(/<iframe/g)).toHaveLength(1)
  })
})
