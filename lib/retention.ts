import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Data retention (CLS-014, approved by Vytis Radvila on 2026-11-08) and its
 * two jobs: CLS-017 (imported documents) and CLS-018 (nightly cleanup). Runs
 * from the existing nightly cron, no new infrastructure. Nothing is deleted
 * unless RETENTION_MODE=delete is set; otherwise the cron only counts what
 * would go, so the first runs can be checked before deletion is switched on.
 */
export const RETENTION = {
  accessRequestDays: 90,
  participantResultMonths: 6,
  aiUsageMonths: 12,
  auditLogMonths: 12,
  importDocumentDays: 7,
} as const

export type RetentionMode = "report" | "delete"

export type RetentionSummary = {
  mode: RetentionMode
  access_requests: number
  participant_teams: number
  ai_usage: number
  admin_audit_log: number
  import_documents: number
  failed: string[]
  incomplete: boolean
}

const DAY_MS = 24 * 60 * 60 * 1000
const GAME_PAGE = 200
const FOLDER_PAGE = 1000
const REMOVE_CHUNK = 100
const IMPORTS = "imports"

export function retentionMode(value: string | undefined = process.env.RETENTION_MODE): RetentionMode {
  return value === "delete" ? "delete" : "report"
}

const daysAgo = (now: Date, days: number) => new Date(now.getTime() - days * DAY_MS).toISOString()
function monthsAgo(now: Date, months: number): string {
  const d = new Date(now.getTime())
  d.setUTCMonth(d.getUTCMonth() - months)
  return d.toISOString()
}

export function retentionCutoffs(now: Date) {
  return {
    accessRequests: daysAgo(now, RETENTION.accessRequestDays),
    participantResults: monthsAgo(now, RETENTION.participantResultMonths),
    aiUsage: monthsAgo(now, RETENTION.aiUsageMonths),
    auditLog: monthsAgo(now, RETENTION.auditLogMonths),
    importDocuments: daysAgo(now, RETENTION.importDocumentDays),
  }
}

type StorageEntry = { name: string; id: string | null; created_at?: string | null }

/** Paths of files (not folders) in `folder` uploaded before the cutoff. */
export function oldImportFiles(folder: string, entries: StorageEntry[], cutoffIso: string): string[] {
  const cutoff = Date.parse(cutoffIso)
  return entries
    .filter((e) => e.id !== null && e.created_at && Date.parse(e.created_at) < cutoff)
    .map((e) => `${folder}/${e.name}`)
}

/**
 * CLS-017: after a successful import the uploaded document is no longer
 * needed. Removal never fails the import; the nightly sweep catches what is
 * left (failed imports, removal errors) after seven days.
 */
export async function removeImportDocument(
  path: string,
  mode: RetentionMode,
  client: () => SupabaseClient,
): Promise<boolean> {
  if (mode !== "delete") return false
  try {
    const { error } = await client().storage.from("documents").remove([path])
    if (error) {
      console.error(JSON.stringify({ event: "import_document_remove_failed", message: error.message }))
      return false
    }
    return true
  } catch (e) {
    console.error(JSON.stringify({ event: "import_document_remove_failed", message: e instanceof Error ? e.message : "unknown" }))
    return false
  }
}

/** CLS-018: count (report) or delete (delete) what is past its term. */
export async function runRetention(
  admin: SupabaseClient,
  { now, mode, overBudget }: { now: Date; mode: RetentionMode; overBudget: () => boolean },
): Promise<RetentionSummary> {
  const cutoff = retentionCutoffs(now)
  const summary: RetentionSummary = {
    mode,
    access_requests: 0,
    participant_teams: 0,
    ai_usage: 0,
    admin_audit_log: 0,
    import_documents: 0,
    failed: [],
    incomplete: false,
  }
  const del = mode === "delete"
  const steps: [keyof RetentionSummary & string, () => Promise<number | null>][] = [
    [
      "access_requests",
      async () => {
        const base = admin.from("access_requests")
        const query = del ? base.delete({ count: "exact" }) : base.select("id", { count: "exact", head: true })
        const { count, error } = await query.in("status", ["approved", "rejected"]).lt("reviewed_at", cutoff.accessRequests)
        return error ? null : (count ?? 0)
      },
    ],
    ["participant_teams", () => participantTeams(admin, cutoff.participantResults, del, overBudget, summary)],
    [
      "ai_usage",
      async () => {
        const base = admin.from("ai_usage")
        const query = del ? base.delete({ count: "exact" }) : base.select("id", { count: "exact", head: true })
        const { count, error } = await query.lt("created_at", cutoff.aiUsage)
        return error ? null : (count ?? 0)
      },
    ],
    [
      "admin_audit_log",
      async () => {
        const base = admin.from("admin_audit_log")
        const query = del ? base.delete({ count: "exact" }) : base.select("id", { count: "exact", head: true })
        const { count, error } = await query.lt("created_at", cutoff.auditLog)
        return error ? null : (count ?? 0)
      },
    ],
    ["import_documents", () => importDocuments(admin, cutoff.importDocuments, del, overBudget, summary)],
  ]

  for (const [key, step] of steps) {
    if (overBudget()) {
      summary.incomplete = true
      break
    }
    const result = await step()
    if (result === null) summary.failed.push(key)
    else (summary[key] as number) = result
  }

  const counts = {
    access_requests: summary.access_requests,
    participant_teams: summary.participant_teams,
    ai_usage: summary.ai_usage,
    admin_audit_log: summary.admin_audit_log,
    import_documents: summary.import_documents,
  }
  if (del && Object.values(counts).some((n) => n > 0)) {
    // Counts only: no names, emails or ids of what was deleted.
    const { error } = await admin.from("admin_audit_log").insert({
      actor_id: null,
      action: "retention_run",
      target_type: "platform",
      target_id: null,
      details: counts,
    })
    if (error) console.error(JSON.stringify({ event: "retention_audit_failed", code: error.code }))
  }
  return summary
}

/**
 * Teams of activities that finished before the cutoff; deleting a team
 * removes its answers, hint reveals, achievements and reflections (cascade).
 * The activity and its tasks stay with the facilitator.
 */
async function participantTeams(
  admin: SupabaseClient,
  cutoffIso: string,
  del: boolean,
  overBudget: () => boolean,
  summary: RetentionSummary,
): Promise<number | null> {
  let total = 0
  let cursor: string | null = null
  for (;;) {
    if (overBudget()) {
      summary.incomplete = true
      return total
    }
    let query = admin
      .from("games")
      .select("id, teams!inner(id)")
      .eq("status", "finished")
      .lt("finished_at", cutoffIso)
      .order("id", { ascending: true })
      .limit(GAME_PAGE)
    if (cursor) query = query.gt("id", cursor)
    const { data, error } = await query
    if (error) return null
    const games = (data ?? []) as unknown as { id: string; teams: { id: string }[] }[]
    if (games.length === 0) return total
    const ids = games.map((g) => g.id)
    if (del) {
      const { count, error: deleteError } = await admin.from("teams").delete({ count: "exact" }).in("game_id", ids)
      if (deleteError) return null
      total += count ?? 0
    } else {
      total += games.reduce((n, g) => n + (g.teams?.length ?? 0), 0)
    }
    if (games.length < GAME_PAGE) return total
    cursor = ids[ids.length - 1]
  }
}

/** Files under documents/imports/<facilitator>/ older than the cutoff. */
async function importDocuments(
  admin: SupabaseClient,
  cutoffIso: string,
  del: boolean,
  overBudget: () => boolean,
  summary: RetentionSummary,
): Promise<number | null> {
  const bucket = admin.storage.from("documents")
  const { data: folders, error } = await bucket.list(IMPORTS, { limit: FOLDER_PAGE })
  if (error) return null
  let total = 0
  for (const folder of (folders ?? []).filter((e) => e.id === null)) {
    if (overBudget()) {
      summary.incomplete = true
      return total
    }
    const prefix = `${IMPORTS}/${folder.name}`
    const { data: files, error: listError } = await bucket.list(prefix, { limit: FOLDER_PAGE })
    if (listError) return null
    if ((files ?? []).length >= FOLDER_PAGE) summary.incomplete = true
    const paths = oldImportFiles(prefix, files ?? [], cutoffIso)
    if (!del) {
      total += paths.length
      continue
    }
    for (let i = 0; i < paths.length; i += REMOVE_CHUNK) {
      const chunk = paths.slice(i, i + REMOVE_CHUNK)
      const { error: removeError } = await bucket.remove(chunk)
      if (removeError) return null
      total += chunk.length
    }
  }
  return total
}
