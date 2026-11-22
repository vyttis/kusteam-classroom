import { readFileSync } from "fs"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  CONNECTED,
  LOAD_RETRY_DELAYS_MS,
  OFFLINE_TEXT,
  isOffline,
  loadRetryDelayMs,
  nextConnection,
  type ConnectionEvent,
} from "@/components/player/connection"
import {
  announcementTime,
  closedAnnouncementKey,
  rememberAnnouncementClosed,
  wasAnnouncementClosed,
} from "@/components/player/announcement-banner"
import {
  STORAGE_BLOCKED_MESSAGE,
  canStorePlayerSession,
  clearPlayerSession,
  getPlayerSession,
  readStored,
  savePlayerSession,
  writeStored,
} from "@/lib/game/session"

const read = (file: string) => readFileSync(file, "utf8")

function memoryStorage() {
  const items = new Map<string, string>()
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
    items,
  }
}

function blockedStorage() {
  const refuse = () => {
    throw new DOMException("The operation is insecure.", "SecurityError")
  }
  return { getItem: refuse, setItem: refuse, removeItem: refuse }
}

afterEach(() => vi.unstubAllGlobals())

describe("connection notice", () => {
  const after = (...events: ConnectionEvent[]) => events.reduce(nextConnection, CONNECTED)

  it("appears after two failed polls in a row, not after one", () => {
    expect(isOffline(after("poll_failed"))).toBe(false)
    expect(isOffline(after("poll_failed", "poll_failed"))).toBe(true)
    expect(isOffline(after("poll_failed", "poll_ok", "poll_failed"))).toBe(false)
  })

  it("goes away on the first poll that gets through", () => {
    expect(isOffline(after("poll_failed", "poll_failed", "poll_failed", "poll_ok"))).toBe(false)
    expect(after("poll_failed", "poll_failed", "poll_ok")).toEqual(CONNECTED)
  })

  it("follows the browser's offline and online events", () => {
    expect(isOffline(after("browser_offline"))).toBe(true)
    expect(isOffline(after("browser_offline", "browser_online"))).toBe(false)
    // A poll that got through also clears a stale "offline" from the browser.
    expect(isOffline(after("browser_offline", "poll_ok"))).toBe(false)
    // "online" alone does not hide failed polls: one must get through first.
    expect(isOffline(after("poll_failed", "poll_failed", "browser_online"))).toBe(true)
  })

  it("keeps the same state object when nothing changes, so pages do not re-render", () => {
    expect(nextConnection(CONNECTED, "poll_ok")).toBe(CONNECTED)
    expect(nextConnection(CONNECTED, "browser_online")).toBe(CONNECTED)
  })

  it("is a polite live region on both polling pages", () => {
    const banner = read("components/player/connection.tsx")
    expect(banner).toMatch(/role="status"\s+aria-live="polite"/)
    expect(banner).toContain("pointer-events-none")
    expect(OFFLINE_TEXT).toBe("Nėra ryšio. Bandome prisijungti iš naujo...")
    for (const page of ["app/play/[gameCode]/play/page.tsx", "app/play/[gameCode]/leaderboard/page.tsx"]) {
      const source = read(page)
      expect(source, page).toContain("<ConnectionBanner offline={offline} />")
      expect(source, page).toContain("reportPoll(true)")
      expect(source, page).toContain("reportPoll(false)")
      expect(source, page).toContain('window.addEventListener("online"')
    }
  })
})

describe("load error screen", () => {
  it("retries by itself a few times, further and further apart, then stops", () => {
    const delays = [0, 1, 2, 3, 4, 5].map(loadRetryDelayMs)
    expect(delays).toEqual([2000, 4000, 8000, 16000, null, null])
    for (let i = 1; i < LOAD_RETRY_DELAYS_MS.length; i++) {
      expect(LOAD_RETRY_DELAYS_MS[i]).toBeGreaterThan(LOAD_RETRY_DELAYS_MS[i - 1])
    }
  })

  it("has no action that drops the team's session", () => {
    const screens = read("components/player/play-screens.tsx")
    const errorScreen = screens.slice(screens.indexOf("export function PlayLoadError"), screens.indexOf("export function PlayLoading"))
    expect(errorScreen).toContain("Bandyti dar kartą")
    expect(errorScreen.match(/<Button/g)).toHaveLength(1)
    expect(errorScreen).not.toContain("Prisijungti iš naujo")
    expect(errorScreen).not.toContain("onRejoin")
    expect(errorScreen).toContain("„Grąžinti į komandą“")
    expect(screens).not.toContain("clearPlayerSession")
  })

  it("leaves the session alone unless the team is gone or leaves on purpose", () => {
    const page = read("app/play/[gameCode]/play/page.tsx")
    // Two places only: the server said twice that the team does not exist,
    // and "Išeiti", which asks first (LeaveTeamButton).
    expect(page.match(/clearPlayerSession\(/g)).toHaveLength(2)
    expect(page).toMatch(/const again = await fetchState\(\)[\s\S]*?again\.team === null[\s\S]*?clearPlayerSession\(gameCode\)/)
    expect(page).toMatch(/const leaveTeam = \(\) => \{\s*clearPlayerSession\(gameCode\)/)
    expect(page.match(/onLeave=\{leaveTeam\}/g)).toHaveLength(2)
    expect(page).not.toMatch(/<PlayLoadError[^>]*leaveTeam/)
    const leave = read("components/player/leave-team-button.tsx")
    expect(leave).toContain("Taip, išeiti")
    expect(leave).toContain("Likti")
  })
})

describe("announcement banner", () => {
  it("remembers a closed announcement in the tab, by its id", () => {
    const storage = memoryStorage()
    vi.stubGlobal("sessionStorage", storage)
    expect(wasAnnouncementClosed("a1")).toBe(false)
    rememberAnnouncementClosed("a1")
    expect(wasAnnouncementClosed("a1")).toBe(true)
    expect(wasAnnouncementClosed("a2")).toBe(false)
    expect([...storage.items.keys()]).toEqual([closedAnnouncementKey("a1")])
  })

  it("works without sessionStorage", () => {
    vi.stubGlobal("sessionStorage", blockedStorage())
    expect(() => rememberAnnouncementClosed("a1")).not.toThrow()
    expect(wasAnnouncementClosed("a1")).toBe(false)
  })

  it("shows when the announcement was sent, in Vilnius time", () => {
    expect(announcementTime("2026-11-22T08:42:10Z")).toBe("10:42")
    expect(announcementTime("2026-06-22T08:05:00Z")).toBe("11:05")
    expect(announcementTime("not a date")).toBe("")
  })

  it("stays until a participant closes it; only the facilitator's screen times out", () => {
    const banner = read("components/player/announcement-banner.tsx")
    expect(banner).toMatch(/if \(fromPoll \|\| !activeAnnouncement\) return\s+const timer = setTimeout\(dismiss, AUTO_DISMISS_MS\)/)
    expect(banner.match(/setTimeout\(/g)).toHaveLength(1)
  })

  it("is a polite live region with a named close button of at least 24 px", () => {
    const banner = read("components/player/announcement-banner.tsx")
    expect(banner).toMatch(/<div role="status" aria-live="polite"/)
    const button = banner.match(/<button[\s\S]*?>/)?.[0] ?? ""
    expect(button).toContain('aria-label="Uždaryti pranešimą"')
    // Tailwind h-8 w-8 is 32 x 32 CSS px.
    expect(button).toMatch(/\bh-8 w-8\b/)
  })

  it("reaches participants for 15 minutes", () => {
    expect(read("app/api/play/status/route.ts")).toContain("const ANNOUNCEMENT_WINDOW_MS = 15 * 60 * 1000")
  })

  it("is shown on the leaderboard page too, from the status poll", () => {
    const page = read("app/play/[gameCode]/leaderboard/page.tsx")
    expect(page).toContain("<AnnouncementBanner latest={announcement} />")
    expect(page).toContain("/api/play/status?game_code=")
  })
})

// WCAG 2.x contrast of the colour tokens the two banners use, read from
// app/globals.css so a palette change that breaks them fails here.
function token(css: string, name: string): [number, number, number] {
  const match = css.match(new RegExp(`--${name}:\\s*([\\d.]+)\\s+([\\d.]+)%\\s+([\\d.]+)%`))
  if (!match) throw new Error(`token --${name} not found`)
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

function luminance([h, s, l]: [number, number, number]): number {
  const sat = s / 100
  const light = l / 100
  const a = sat * Math.min(light, 1 - light)
  const channel = (n: number) => {
    const k = (n + h / 30) % 12
    const c = light - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(0) + 0.7152 * channel(8) + 0.0722 * channel(4)
}

function contrast(a: [number, number, number], b: [number, number, number]): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

describe("banner colours", () => {
  const css = read("app/globals.css")
  const white: [number, number, number] = [0, 0, 100]

  it("announcement: white text on secondary-ink is at least 4.5:1", () => {
    const banner = read("components/player/announcement-banner.tsx")
    expect(banner).toContain("bg-secondary-ink text-white")
    expect(banner).not.toMatch(/bg-secondary text-white/)
    expect(contrast(white, token(css, "secondary-ink"))).toBeGreaterThanOrEqual(4.5)
    // What it replaced: below AA for 14 px text.
    expect(contrast(white, token(css, "secondary"))).toBeLessThan(4.5)
  })

  it("no connection: highlight-foreground on highlight is at least 4.5:1", () => {
    expect(read("components/player/connection.tsx")).toContain("bg-highlight px-4 py-2.5 text-sm font-medium text-highlight-foreground")
    expect(contrast(token(css, "highlight-foreground"), token(css, "highlight"))).toBeGreaterThanOrEqual(4.5)
  })
})

describe("reflection form", () => {
  const form = read("components/player/reflection-form.tsx")

  it("ties every label to its field", () => {
    for (const id of ["hardestId", "improvementId", "likedId"]) {
      expect(form, id).toContain(`<Label htmlFor={${id}}`)
      expect(form, id).toContain(`id={${id}}`)
    }
  })

  it("ties each character counter to its text field", () => {
    for (const id of ["improvementId", "likedId"]) {
      expect(form, id).toContain("aria-describedby={`${" + id + "}-count`}")
      expect(form, id).toContain("<p id={`${" + id + "}-count`}")
    }
  })
})

describe("player session storage", () => {
  const session = { team_id: "t1", session_token: "tok", game_code: "ABC123", team_name: "Komanda" }

  it("stores, reads and clears a session", () => {
    vi.stubGlobal("localStorage", memoryStorage())
    expect(canStorePlayerSession()).toBe(true)
    expect(getPlayerSession("ABC123")).toBeNull()
    expect(savePlayerSession("ABC123", session)).toBe(true)
    expect(getPlayerSession("ABC123")).toMatchObject(session)
    clearPlayerSession("ABC123")
    expect(getPlayerSession("ABC123")).toBeNull()
  })

  it("leaves no probe behind", () => {
    const storage = memoryStorage()
    vi.stubGlobal("localStorage", storage)
    canStorePlayerSession()
    expect(storage.items.size).toBe(0)
  })

  it("drops an expired or broken session", () => {
    const storage = memoryStorage()
    vi.stubGlobal("localStorage", storage)
    savePlayerSession("ABC123", { ...session, created_at: Date.now() - 25 * 60 * 60 * 1000 })
    expect(getPlayerSession("ABC123")).toBeNull()
    storage.setItem("ctf_session_ABC123", "{not json")
    expect(getPlayerSession("ABC123")).toBeNull()
    expect(storage.items.size).toBe(0)
  })

  it("does not throw when the browser blocks storage", () => {
    vi.stubGlobal("localStorage", blockedStorage())
    expect(canStorePlayerSession()).toBe(false)
    expect(getPlayerSession("ABC123")).toBeNull()
    expect(savePlayerSession("ABC123", session)).toBe(false)
    expect(() => clearPlayerSession("ABC123")).not.toThrow()
    expect(readStored("ctf_reflection_ABC123")).toBeNull()
    expect(writeStored("ctf_reflection_ABC123", "skipped")).toBe(false)
  })

  it("does not throw when there is no storage at all", () => {
    vi.stubGlobal("localStorage", undefined)
    expect(canStorePlayerSession()).toBe(false)
    expect(getPlayerSession("ABC123")).toBeNull()
    expect(savePlayerSession("ABC123", session)).toBe(false)
  })

  it("tells the participant why joining is not possible, before a team is created", () => {
    expect(STORAGE_BLOCKED_MESSAGE).toMatch(/^Ši naršyklė neleidžia išsaugoti jūsų komandos/)
    expect(STORAGE_BLOCKED_MESSAGE).not.toContain("—")
    const join = read("app/play/[gameCode]/page.tsx")
    // The check comes before the request that creates the team.
    expect(join.indexOf("if (!canStorePlayerSession())")).toBeGreaterThan(-1)
    expect(join.indexOf("if (!canStorePlayerSession())")).toBeLessThan(join.indexOf('fetch("/api/teams"'))
    expect(join).toContain("{STORAGE_BLOCKED_MESSAGE}")
    const rejoin = read("app/play/[gameCode]/grizti/page.tsx")
    expect(rejoin.indexOf("if (!canStorePlayerSession())")).toBeLessThan(rejoin.indexOf('fetch("/api/play/rejoin"'))
  })

  it("is never read straight from localStorage on participant pages", () => {
    for (const file of [
      "app/play/[gameCode]/page.tsx",
      "app/play/[gameCode]/leaderboard/page.tsx",
      "components/player/reflection-form.tsx",
    ]) {
      expect(read(file), file).not.toMatch(/localStorage\./)
    }
  })
})
