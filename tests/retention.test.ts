import { describe, expect, it } from "vitest"
import { readFileSync } from "fs"
import path from "path"
import {
  RETENTION,
  oldImportFiles,
  removeImportDocument,
  retentionCutoffs,
  retentionMode,
  runRetention,
} from "@/lib/retention"

// Retention rules approved by Vytis Radvila on 2026-11-08 (CLS-014):
// access requests 90 days after the decision, participant results 6 months
// after the activity ended, AI usage and admin log 12 months, imported
// documents at most 7 days. Deletes run only with RETENTION_MODE=delete.

const NOW = new Date("2027-05-08T02:00:00Z")

type Step = [string, unknown[]]
type Query = { table: string; steps: Step[] }
type Result = { data?: unknown; count?: number | null; error?: { message: string; code?: string } | null }

/** A stand-in for the service-role client that records every query. */
function fakeAdmin(opts: {
  respond?: (q: Query) => Result
  folders?: { name: string; id: string | null }[]
  files?: Record<string, { name: string; id: string | null; created_at: string }[]>
  removeError?: boolean
}) {
  const queries: Query[] = []
  const removed: string[][] = []
  const listed: string[] = []
  const admin = {
    from(table: string) {
      const query: Query = { table, steps: [] }
      queries.push(query)
      const builder: Record<string, unknown> = {}
      for (const method of ["select", "delete", "insert", "in", "lt", "gt", "eq", "order", "limit"]) {
        builder[method] = (...args: unknown[]) => {
          query.steps.push([method, args])
          return builder
        }
      }
      builder.then = (resolve: (r: Result) => unknown) =>
        resolve(opts.respond?.(query) ?? { data: [], count: 0, error: null })
      return builder
    },
    storage: {
      from(bucket: string) {
        expect(bucket).toBe("documents")
        return {
          async list(prefix: string) {
            listed.push(prefix)
            if (prefix === "imports") return { data: opts.folders ?? [], error: null }
            return { data: opts.files?.[prefix] ?? [], error: null }
          },
          async remove(paths: string[]) {
            removed.push(paths)
            return { data: null, error: opts.removeError ? { message: "boom" } : null }
          },
        }
      },
    },
  }
  return { admin: admin as never, queries, removed, listed }
}

const ops = (q: Query) => q.steps.map(([m]) => m)
const arg = (q: Query, method: string) => q.steps.find(([m]) => m === method)?.[1]
const never = () => false

describe("retention settings", () => {
  it("keeps the approved terms", () => {
    expect(RETENTION).toEqual({
      accessRequestDays: 90,
      participantResultMonths: 6,
      aiUsageMonths: 12,
      auditLogMonths: 12,
      importDocumentDays: 7,
    })
  })

  it("only deletes when RETENTION_MODE is exactly delete", () => {
    expect(retentionMode(undefined)).toBe("report")
    expect(retentionMode("")).toBe("report")
    expect(retentionMode("DELETE")).toBe("report")
    expect(retentionMode("yes")).toBe("report")
    expect(retentionMode("delete")).toBe("delete")
  })

  it("computes the cutoffs from the run time", () => {
    expect(retentionCutoffs(NOW)).toEqual({
      accessRequests: "2027-02-07T02:00:00.000Z",
      participantResults: "2026-11-08T02:00:00.000Z",
      aiUsage: "2026-05-08T02:00:00.000Z",
      auditLog: "2026-05-08T02:00:00.000Z",
      importDocuments: "2027-05-01T02:00:00.000Z",
    })
  })
})

describe("oldImportFiles", () => {
  it("picks files older than the cutoff and skips folders and newer files", () => {
    const entries = [
      { name: "a.pdf", id: "1", created_at: "2027-04-30T10:00:00Z" },
      { name: "b.docx", id: "2", created_at: "2027-05-07T10:00:00Z" },
      { name: "nested", id: null, created_at: "2027-01-01T00:00:00Z" },
      { name: "c.txt", id: "3", created_at: "not a date" },
    ]
    expect(oldImportFiles("imports/u1", entries, "2027-05-01T02:00:00.000Z")).toEqual(["imports/u1/a.pdf"])
  })
})

describe("runRetention, report mode", () => {
  it("counts with the approved filters and deletes nothing", async () => {
    const fake = fakeAdmin({
      respond: (q) => {
        if (q.table === "games") return { data: [{ id: "g1", teams: [{ id: "t1" }, { id: "t2" }] }], error: null }
        return { count: { access_requests: 2, ai_usage: 3, admin_audit_log: 4 }[q.table] ?? 0, error: null }
      },
      folders: [{ name: "u1", id: null }],
      files: { "imports/u1": [{ name: "old.pdf", id: "1", created_at: "2027-04-01T00:00:00Z" }] },
    })
    const summary = await runRetention(fake.admin, { now: NOW, mode: "report", overBudget: never })

    expect(summary).toEqual({
      mode: "report",
      access_requests: 2,
      participant_teams: 2,
      ai_usage: 3,
      admin_audit_log: 4,
      import_documents: 1,
      failed: [],
      incomplete: false,
    })
    expect(fake.queries.some((q) => ops(q).includes("delete") || ops(q).includes("insert"))).toBe(false)
    expect(fake.removed).toEqual([])

    const requests = fake.queries.find((q) => q.table === "access_requests")!
    expect(arg(requests, "in")).toEqual(["status", ["approved", "rejected"]])
    expect(arg(requests, "lt")).toEqual(["reviewed_at", "2027-02-07T02:00:00.000Z"])
    const games = fake.queries.find((q) => q.table === "games")!
    expect(arg(games, "eq")).toEqual(["status", "finished"])
    expect(arg(games, "lt")).toEqual(["finished_at", "2026-11-08T02:00:00.000Z"])
    expect(arg(fake.queries.find((q) => q.table === "ai_usage")!, "lt")).toEqual(["created_at", "2026-05-08T02:00:00.000Z"])
    expect(arg(fake.queries.find((q) => q.table === "admin_audit_log")!, "lt")).toEqual([
      "created_at",
      "2026-05-08T02:00:00.000Z",
    ])
  })
})

describe("runRetention, delete mode", () => {
  it("deletes old rows and files and logs only counts", async () => {
    const fake = fakeAdmin({
      respond: (q) => {
        if (q.table === "games") return { data: [{ id: "g1", teams: [{ id: "t1" }] }, { id: "g2", teams: [{ id: "t2" }] }], error: null }
        if (q.table === "teams") return { count: 2, error: null }
        if (q.table === "admin_audit_log" && ops(q).includes("insert")) return { error: null }
        return { count: 1, error: null }
      },
      folders: [{ name: "u1", id: null }, { name: "stray.pdf", id: "9" }],
      files: {
        "imports/u1": [
          { name: "old.pdf", id: "1", created_at: "2027-04-01T00:00:00Z" },
          { name: "new.pdf", id: "2", created_at: "2027-05-07T00:00:00Z" },
        ],
      },
    })
    const summary = await runRetention(fake.admin, { now: NOW, mode: "delete", overBudget: never })

    expect(summary).toMatchObject({ mode: "delete", access_requests: 1, participant_teams: 2, ai_usage: 1, admin_audit_log: 1, import_documents: 1, failed: [] })
    const teams = fake.queries.find((q) => q.table === "teams")!
    expect(ops(teams)).toContain("delete")
    expect(arg(teams, "in")).toEqual(["game_id", ["g1", "g2"]])
    for (const table of ["access_requests", "ai_usage"]) {
      expect(ops(fake.queries.find((q) => q.table === table)!)).toContain("delete")
    }
    expect(fake.removed).toEqual([["imports/u1/old.pdf"]])
    expect(fake.listed).toEqual(["imports", "imports/u1"])

    const audit = fake.queries.find((q) => q.table === "admin_audit_log" && ops(q).includes("insert"))!
    const row = arg(audit, "insert")![0] as { action: string; actor_id: null; details: Record<string, unknown> }
    expect(row.action).toBe("retention_run")
    expect(row.actor_id).toBeNull()
    expect(row.details).toEqual({ access_requests: 1, participant_teams: 2, ai_usage: 1, admin_audit_log: 1, import_documents: 1 })
  })

  it("never deletes participant results of activities that have not finished", async () => {
    const fake = fakeAdmin({ respond: () => ({ data: [], count: 0, error: null }) })
    await runRetention(fake.admin, { now: NOW, mode: "delete", overBudget: never })
    expect(fake.queries.some((q) => q.table === "teams")).toBe(false)
    expect(arg(fake.queries.find((q) => q.table === "games")!, "eq")).toEqual(["status", "finished"])
  })

  it("reports a failed step and keeps going with the others", async () => {
    const fake = fakeAdmin({
      respond: (q) => (q.table === "ai_usage" ? { count: null, error: { message: "nope" } } : { data: [], count: 0, error: null }),
      removeError: true,
      folders: [{ name: "u1", id: null }],
      files: { "imports/u1": [{ name: "old.pdf", id: "1", created_at: "2027-04-01T00:00:00Z" }] },
    })
    const summary = await runRetention(fake.admin, { now: NOW, mode: "delete", overBudget: never })
    expect(summary.failed).toEqual(["ai_usage", "import_documents"])
    expect(fake.queries.some((q) => q.table === "admin_audit_log" && ops(q).includes("delete"))).toBe(true)
  })

  it("stops when the time budget runs out", async () => {
    const fake = fakeAdmin({})
    const summary = await runRetention(fake.admin, { now: NOW, mode: "delete", overBudget: () => true })
    expect(summary.incomplete).toBe(true)
    expect(fake.queries).toEqual([])
  })
})

describe("removeImportDocument", () => {
  it("leaves the file in report mode", async () => {
    const fake = fakeAdmin({})
    expect(await removeImportDocument("imports/u1/a.pdf", "report", () => fake.admin)).toBe(false)
    expect(fake.removed).toEqual([])
  })

  it("removes the processed file in delete mode", async () => {
    const fake = fakeAdmin({})
    expect(await removeImportDocument("imports/u1/a.pdf", "delete", () => fake.admin)).toBe(true)
    expect(fake.removed).toEqual([["imports/u1/a.pdf"]])
  })

  it("does not fail the import when removal fails", async () => {
    const fake = fakeAdmin({ removeError: true })
    expect(await removeImportDocument("imports/u1/a.pdf", "delete", () => fake.admin)).toBe(false)
    expect(await removeImportDocument("imports/u1/a.pdf", "delete", () => {
      throw new Error("no env")
    })).toBe(false)
  })
})

describe("wiring", () => {
  const read = (file: string) => readFileSync(path.join(__dirname, "..", file), "utf8")

  it("runs from the existing nightly cron, no new cron entry", () => {
    expect(read("app/api/cron/finish-stale-activities/route.ts")).toMatch(/runRetention\(admin, \{ now: new Date\(now\), mode: retentionMode\(\), overBudget \}\)/)
    const crons = JSON.parse(read("vercel.json")).crons
    expect(crons).toEqual([{ path: "/api/cron/finish-stale-activities", schedule: "0 2 * * *" }])
  })

  it("removes an imported document only after a successful import", () => {
    const route = read("app/api/import/process/route.ts")
    const removal = route.indexOf("removeImportDocument(parsed.data.storage_path")
    expect(removal).toBeGreaterThan(route.indexOf("const enriched = await Promise.all"))
    expect(removal).toBeLessThan(route.indexOf("return NextResponse.json({ suggestions: enriched, truncated })"))
  })
})
