import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { FALLBACK_POLL_MS, SAFETY_REFETCH_MS, channelStatusAction } from "@/hooks/live-channel"

describe("channelStatusAction", () => {
  it("reads everything again on the first SUBSCRIBED", () => {
    // A team that joins while the channel is still joining is in neither the
    // first read nor the channel.
    expect(channelStatusAction("SUBSCRIBED", false)).toEqual({ state: "live", polling: "stop", refetch: true })
  })

  it("reads everything again on every later SUBSCRIBED", () => {
    // Solves made while the channel was down never arrive over it.
    expect(channelStatusAction("SUBSCRIBED", true)).toEqual({ state: "live", polling: "stop", refetch: true })
  })

  it.each(["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"])("treats %s as a lost connection", (status) => {
    expect(channelStatusAction(status, true)).toEqual({ state: "degraded", polling: "start", refetch: false })
    expect(channelStatusAction(status, false)).toEqual({ state: "degraded", polling: "start", refetch: false })
  })

  it("ignores statuses it does not know", () => {
    expect(channelStatusAction("JOINING", true)).toEqual({ state: null, polling: null, refetch: false })
  })
})

describe("live board timings", () => {
  it("keeps the safety read slow, between 30 and 60 seconds", () => {
    expect(SAFETY_REFETCH_MS).toBeGreaterThanOrEqual(30_000)
    expect(SAFETY_REFETCH_MS).toBeLessThanOrEqual(60_000)
  })

  it("matches the interval the connection banner tells the facilitator", () => {
    const banner = readFileSync("components/teacher/live-connection-banner.tsx", "utf8")
    expect(banner).toContain(`kas ${FALLBACK_POLL_MS / 1000} s`)
  })
})

describe("useLiveGame wiring", () => {
  const source = readFileSync("hooks/use-live-game.ts", "utf8")

  it("decides through channelStatusAction and refetches when told to", () => {
    expect(source).toContain("channelStatusAction(status, subscribedBefore)")
    expect(source).toContain("if (action.refetch) refetchOrDegrade()")
  })

  it("runs the safety read only while the activity runs and stops it on cleanup", () => {
    expect(source).toMatch(/const safetyInterval = running\s*\?\s*setInterval/)
    expect(source).toContain("if (safetyInterval) clearInterval(safetyInterval)")
  })
})

describe("activity feed wiring", () => {
  it("reads the recent events again once its channel is subscribed", () => {
    const source = readFileSync("components/teacher/live-activity-feed.tsx", "utf8")
    const handler = source.slice(source.indexOf("const handleStatus"), source.indexOf("// New answers, and teams joining"))
    expect(handler).toMatch(/status === "SUBSCRIBED"[\s\S]*loadRecent\(\)/)
  })
})

describe("the gap between joining the channel and the database stream", () => {
  it("recognises the message that the database stream is ready", async () => {
    const { isDatabaseStreamReady } = await import("@/hooks/live-channel")
    expect(isDatabaseStreamReady({ extension: "postgres_changes", status: "ok", message: "Subscribed to PostgreSQL" })).toBe(true)
    expect(isDatabaseStreamReady({ extension: "postgres_changes", status: "error" })).toBe(false)
    expect(isDatabaseStreamReady({ extension: "presence", status: "ok" })).toBe(false)
    expect(isDatabaseStreamReady(null)).toBe(false)
  })

  it("keeps a team that realtime delivered while an older read was on its way", async () => {
    const { mergeRowsAfterRead } = await import("@/hooks/live-channel")
    const beta = { id: "b" }
    const alfa = { id: "a" }
    // The read started at 1000 and holds only Beta; Alfa came over realtime at 1200.
    expect(mergeRowsAfterRead([beta], [{ row: alfa, at: 1200 }], 1000)).toEqual([beta, alfa])
    // A team from before the read that the read does not hold was deleted: not brought back.
    expect(mergeRowsAfterRead([beta], [{ row: alfa, at: 900 }], 1000)).toEqual([beta])
    // A team the read already holds is not doubled.
    const read = [beta, alfa]
    expect(mergeRowsAfterRead(read, [{ row: alfa, at: 1200 }], 1000)).toBe(read)
  })

  it("both live screens read again when the database stream is ready", async () => {
    const { readFileSync } = await import("node:fs")
    for (const file of ["hooks/use-live-game.ts", "components/teacher/live-activity-feed.tsx"]) {
      const src = readFileSync(file, "utf8")
      expect(src).toMatch(/\.on\("system", \{\}, \(payload\) => \{\s*if \(!cancelled && isDatabaseStreamReady\(payload\)\)/)
    }
  })
})
