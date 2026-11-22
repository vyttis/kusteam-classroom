import { describe, expect, it } from "vitest"
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"

// Source-level guards for the facilitator's first hour: the guide, the
// dashboard and the navigation.

const GUIDE = "app/(teacher)/gidas/page.tsx"
const FIRST_RUN_FILES = [
  GUIDE,
  "app/(teacher)/dashboard/page.tsx",
  "components/teacher/teacher-nav.tsx",
  "components/teacher/onboarding-checklist.tsx",
  "components/teacher/games-grid.tsx",
  "lib/teacher/dashboard.ts",
  "app/slaptazodis/page.tsx",
  "app/slaptazodis/password-form.tsx",
]

// Routes that another branch adds (the catalogue of ready-made activities).
// Remove an entry once its page is in this repository: the test then checks
// the route like any other.
const ROUTES_FROM_OTHER_BRANCHES = ["/paruostos-veiklos"]

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? files(path) : [path]
  })
}

/** Every page of the app as a path pattern: route groups dropped, [param] = one segment. */
function pageRoutes(): RegExp[] {
  return files("app")
    .filter((f) => /[\\/]page\.tsx$/.test(f) || f === join("app", "page.tsx"))
    .map((f) => {
      const segments = f
        .split(/[\\/]/)
        .slice(1, -1)
        .filter((s) => !/^\(.*\)$/.test(s))
        .map((s) => (/^\[.*\]$/.test(s) ? "[^/]+" : s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
      return new RegExp(`^/${segments.join("/")}$`)
    })
}

/** In-product paths a source file links to: href="/..." and the catalogue constant. */
function internalLinks(source: string): string[] {
  const links = [...source.matchAll(/href=(?:"|\{`|\{")(\/[^"`#?$}]*)/g)].map((m) => m[1])
  return [...new Set(links.map((l) => (l.length > 1 ? l.replace(/\/$/, "") : l)))]
}

describe("facilitator guide", () => {
  const guide = readFileSync(GUIDE, "utf8")

  it("links only to pages that exist", () => {
    const routes = pageRoutes()
    const links = internalLinks(guide)
    expect(links.length).toBeGreaterThan(0)
    const missing = links.filter(
      (link) => !ROUTES_FROM_OTHER_BRANCHES.includes(link) && !routes.some((r) => r.test(link)),
    )
    expect(missing).toEqual([])
  })

  it("does not keep a finished route in the list of routes still to come", () => {
    const routes = pageRoutes()
    // Fails on purpose once the catalogue lands, so the exception is removed.
    const landed = ROUTES_FROM_OTHER_BRANCHES.filter((r) => routes.some((p) => p.test(r)))
    expect(landed).toEqual([])
  })

  it("has the seven parts, each reachable from the table of contents", () => {
    const ids = [...guide.matchAll(/\{ id: "([a-z-]+)", title: "([^"]+)" \}/g)].map((m) => m[1])
    expect(ids).toEqual([
      "pries-pamoka",
      "pamokos-pradzia",
      "kol-komandos-dirba",
      "pabaiga",
      "po-pamokos",
      "di-pagalba",
      "privatumas",
    ])
    for (const id of ids) expect(guide).toContain(`<Section id="${id}">`)
    expect(guide).toContain("href={`#${s.id}`}")
  })

  it("names only buttons and sections that the product has", () => {
    // Quoted in the guide -> the file where the label really is.
    const labels: Record<string, string> = {
      "Pradėti veiklą": "components/teacher/game-status-actions.tsx",
      "Baigti veiklą": "components/teacher/game-status-actions.tsx",
      Pristabdyti: "components/teacher/game-status-actions.tsx",
      "Klasės ekranas": "app/(teacher)/games/[gameId]/page.tsx",
      Analitika: "app/(teacher)/games/[gameId]/page.tsx",
      "Spausdinti ataskaitą": "app/(teacher)/games/[gameId]/page.tsx",
      Pervadinti: "components/teacher/live-team-progress.tsx",
      "Grąžinti į komandą": "components/teacher/live-team-progress.tsx",
      "Įstrigo!": "components/teacher/live-team-progress.tsx",
      Prisijungimas: "components/teacher/joining-control.tsx",
      Pranešimai: "components/teacher/announcement-panel.tsx",
      "Laiko valdymas": "components/teacher/time-controls.tsx",
      Pratęsti: "components/teacher/time-controls.tsx",
      "Klasės rezultatų suvestinė": "components/teacher/game-results-summary.tsx",
      "Eksportuoti CSV": "components/teacher/reflections-table.tsx",
      Daugiau: "components/teacher/game-detail-client.tsx",
      Kopijuoti: "components/teacher/game-detail-client.tsx",
      Ištrinti: "components/teacher/game-detail-client.tsx",
      "Pridėti kitą atsakymą": "components/teacher/game-builder/accepted-answers-field.tsx",
    }
    const quoted = new Set([...guide.matchAll(/„([^“]+)“/g)].map((m) => m[1].replace(/\s+/g, " ")))
    // Things the facilitator says, not product labels.
    for (const said of ["Liko 5 minutės", "Kaip galvojote?", "Kas laimėjo?", "Mano veiklos"]) quoted.delete(said)
    expect([...quoted].sort()).toEqual(Object.keys(labels).sort())
    for (const [label, file] of Object.entries(labels)) {
      expect(existsSync(file), file).toBe(true)
      expect(readFileSync(file, "utf8"), `${label} in ${file}`).toContain(label)
    }
  })

  it("is a facilitator page behind the sign-in on every host", () => {
    expect(readFileSync("proxy.ts", "utf8")).toContain('url.pathname.startsWith("/gidas")')
  })
})

describe("first-run texts", () => {
  it("have no long dashes", () => {
    for (const file of FIRST_RUN_FILES) {
      const source = readFileSync(file, "utf8")
      const line = source.split("\n").findIndex((l) => /[–—―]/.test(l))
      expect(line === -1 ? null : `${file}:${line + 1}`).toBeNull()
    }
  })

  it("use the agreed role names", () => {
    for (const file of FIRST_RUN_FILES) {
      // Lithuanian strings only: "mokytoj-" and "mokin-" stay out of the interface texts.
      const strings = readFileSync(file, "utf8").match(/[^\n]*[ąčęėįšųūž][^\n]*/g) ?? []
      const offenders = strings.filter((l) => !/^\s*(\/\/|\*|\{\/\*)/.test(l) && /\b(mokytoj|mokini|mokinių|žaidim|žaidėj)/i.test(l))
      expect(offenders, file).toEqual([])
    }
  })
})

describe("teacher navigation", () => {
  const nav = readFileSync("components/teacher/teacher-nav.tsx", "utf8")

  it("links to the guide and to the password page, and every link is a page", () => {
    const routes = pageRoutes()
    const links = [...nav.matchAll(/href: "(\/[^"]*)"/g)].map((m) => m[1]).concat(internalLinks(nav))
    expect(links).toContain("/gidas")
    expect(links).toContain("/slaptazodis")
    // "/games" is the fixed part of the live shortcut (/games/<id>/live).
    expect(links.filter((l) => l !== "/games" && !routes.some((r) => r.test(l)))).toEqual([])
  })

  it("offers the password change in the desktop account menu and in the mobile menu", () => {
    expect(nav.match(/Keisti slaptažodį/g)).toHaveLength(2)
    expect(nav.match(/href="\/slaptazodis"/g)).toHaveLength(2)
    // KU STEAM TEAM staff have no CLASSROOM password.
    expect(nav).toContain('const canChangePassword = role !== "staff"')
  })
})
