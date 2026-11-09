"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Download, Loader2, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { InviteUserDialog } from "@/components/admin/invite-user-dialog"
import { useToast } from "@/hooks/use-toast"
import { exportCsv } from "@/lib/csv"
import { cn } from "@/lib/utils"
import {
  type AdminUserRow,
  schoolKey,
  type Breakdown,
  breakdown,
  matchesSearch,
  recentlyActive,
  ROLE_LABEL,
  STATUS_LABEL,
  USER_CSV_HEADERS,
  userCsvRow,
} from "@/lib/admin/user-rows"
import type { AccountStatus, UserRole } from "@/types/game"

interface UsersManagerProps {
  users: AdminUserRow[]
  currentUserId: string
  currentUserRole: UserRole
  defaultAiLimit: number
}

const ALL = "all"
// Always Lithuanian time, so the server render and the browser show the same day.
const dateFormat = new Intl.DateTimeFormat("lt-LT", { dateStyle: "medium", timeZone: "Europe/Vilnius" })
const formatDate = (iso: string | null) => (iso ? dateFormat.format(new Date(iso)) : null)

const STATUS_STYLE: Record<AccountStatus, string> = {
  active: "bg-primary/10 text-primary-ink border-primary/25",
  pending: "bg-highlight/15 text-steam-dark border-highlight/40",
  blocked: "bg-accent/10 text-accent-ink border-accent/25",
}

function StatusBadge({ status }: { status: AccountStatus }) {
  return (
    <span className={cn("inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium", STATUS_STYLE[status])}>
      {STATUS_LABEL[status]}
    </span>
  )
}

/** The user list for the super admin: find people, see their use, manage access. */
export function UsersManager({ users, currentUserId, currentUserRole, defaultAiLimit }: UsersManagerProps) {
  const router = useRouter()
  const canManage = currentUserRole === "super_admin"
  // Changes made here are applied on top of the server rows, so a refresh
  // after an invitation keeps them without copying props into state.
  const [overrides, setOverrides] = useState<Record<string, Partial<AdminUserRow>>>({})
  const rows = useMemo(() => users.map((u) => ({ ...u, ...overrides[u.id] })), [users, overrides])

  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<string>(ALL)
  const [role, setRole] = useState<string>(ALL)
  const [municipality, setMunicipality] = useState<string>(ALL)
  const [managing, setManaging] = useState<AdminUserRow | null>(null)

  const municipalities = useMemo(
    () =>
      Array.from(new Set(rows.map((r) => r.municipality).filter((m): m is string => Boolean(m)))).sort((a, b) =>
        a.localeCompare(b, "lt"),
      ),
    [rows],
  )

  const filtered = rows.filter(
    (r) =>
      matchesSearch(r, query) &&
      (status === ALL || r.status === status) &&
      (role === ALL || r.role === role) &&
      (municipality === ALL || r.municipality === municipality),
  )
  const isFiltered = query.trim() !== "" || status !== ALL || role !== ALL || municipality !== ALL

  const active = rows.filter((r) => r.status === "active")
  const summary = [
    { label: "Aktyvios paskyros", value: active.length },
    { label: "Laukia patvirtinimo", value: rows.filter((r) => r.status === "pending").length },
    { label: "Užblokuotos", value: rows.filter((r) => r.status === "blocked").length },
    { label: "Prisijungė per 30 d.", value: rows.filter((r) => recentlyActive(r)).length },
    { label: "Mokyklų", value: new Set(active.map(schoolKey).filter(Boolean)).size },
    { label: "Savivaldybių", value: new Set(active.map((r) => r.municipality).filter(Boolean)).size },
  ]

  const byMunicipality = breakdown(active, (r) => r.municipality)
  const bySchoolType = breakdown(active, (r) => r.school_type)
  const bySubject = breakdown(active, (r) => r.subjects)
  const byGrades = breakdown(active, (r) => r.grades)

  function applyChange(id: string, change: Partial<AdminUserRow>) {
    setOverrides((o) => ({ ...o, [id]: { ...o[id], ...change } }))
    setManaging((m) => (m && m.id === id ? { ...m, ...change } : m))
  }

  function downloadUsers() {
    const stamp = new Date().toISOString().slice(0, 10)
    exportCsv(`vedejai-${stamp}.csv`, USER_CSV_HEADERS, filtered.map(userCsvRow))
  }

  function downloadStats() {
    const stamp = new Date().toISOString().slice(0, 10)
    const section = (name: string, list: Breakdown[]) => list.map((b) => [name, b.label, b.count])
    exportCsv(`vedeju-statistika-${stamp}.csv`, ["Pjūvis", "Reikšmė", "Aktyvių vedėjų"], [
      ...section("Savivaldybė", byMunicipality),
      ...section("Mokyklos tipas", bySchoolType),
      ...section("Dalykas", bySubject),
      ...section("Klasės", byGrades),
    ])
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-steam-dark">Vartotojai</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Visos platformos paskyros: kas jas turi, iš kurių mokyklų ir kaip naudojasi.
          </p>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={downloadUsers} disabled={filtered.length === 0}>
              <Download className="h-4 w-4" aria-hidden="true" />
              Sąrašas (CSV)
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={downloadStats} disabled={active.length === 0}>
              <Download className="h-4 w-4" aria-hidden="true" />
              Statistika (CSV)
            </Button>
            <InviteUserDialog currentUserRole={currentUserRole} onUserInvited={() => router.refresh()} />
          </div>
        )}
      </header>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border/60 bg-border/60 sm:grid-cols-3 lg:grid-cols-6">
        {summary.map((s) => (
          <div key={s.label} className="bg-white px-4 py-3">
            <dt className="text-xs text-muted-foreground">{s.label}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums text-steam-dark">{s.value}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="users-list-title" className="space-y-4">
        <h2 id="users-list-title" className="sr-only">
          Paskyrų sąrašas
        </h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
          <div className="relative">
            <Label htmlFor="users-search" className="sr-only">
              Paieška
            </Label>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              id="users-search"
              type="search"
              placeholder="Vardas, el. paštas, mokykla"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger aria-label="Paskyros būsena">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Visos būsenos</SelectItem>
              <SelectItem value="active">Aktyvios</SelectItem>
              <SelectItem value="pending">Laukia patvirtinimo</SelectItem>
              <SelectItem value="blocked">Užblokuotos</SelectItem>
            </SelectContent>
          </Select>
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger aria-label="Rolė">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Visos rolės</SelectItem>
              <SelectItem value="teacher">Vedėjai</SelectItem>
              <SelectItem value="admin">Administratoriai</SelectItem>
              <SelectItem value="super_admin">Super administratoriai</SelectItem>
              <SelectItem value="staff">KU STEAM darbuotojai</SelectItem>
            </SelectContent>
          </Select>
          <Select value={municipality} onValueChange={setMunicipality}>
            <SelectTrigger aria-label="Savivaldybė">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Visos savivaldybės</SelectItem>
              {municipalities.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between text-sm text-muted-foreground" aria-live="polite">
          <span>
            Rodoma {filtered.length} iš {rows.length}
          </span>
          {isFiltered && (
            <button
              type="button"
              className="text-secondary-ink underline-offset-4 hover:underline"
              onClick={() => {
                setQuery("")
                setStatus(ALL)
                setRole(ALL)
                setMunicipality(ALL)
              }}
            >
              Rodyti visus
            </button>
          )}
        </div>

        {filtered.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-white px-4 py-8 text-center text-sm text-muted-foreground">
            {rows.length === 0 ? "Paskyrų dar nėra." : "Pagal šiuos filtrus paskyrų nerasta."}
          </p>
        ) : (
          <div className="relative overflow-x-auto rounded-xl border border-border/60 bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" tabIndex={0} role="region" aria-label="Naudotojų sąrašas">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-xs text-muted-foreground">
                  <th scope="col" className="px-4 py-3 font-medium">Vedėjas</th>
                  <th scope="col" className="px-4 py-3 font-medium">Mokykla</th>
                  <th scope="col" className="px-4 py-3 font-medium">Paskyra</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Veiklos</th>
                  {canManage && <th scope="col" className="px-4 py-3 text-right font-medium">DI šį mėn.</th>}
                  <th scope="col" className="px-4 py-3 font-medium">Paskutinį kartą</th>
                  {canManage && (
                    <th scope="col" className="px-4 py-3 font-medium">
                      <span className="sr-only">Veiksmai</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => {
                  const unlimited = u.role === "super_admin"
                  const limit = u.ai_limit ?? defaultAiLimit
                  return (
                    <tr key={u.id} className="border-b border-border/40 align-top last:border-0">
                      <td className="px-4 py-3">
                        <p className="font-medium text-steam-dark">{u.name}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </td>
                      <td className="max-w-[260px] px-4 py-3">
                        {u.school ? (
                          <>
                            <p className="text-steam-dark">{u.school}</p>
                            <p className="text-xs text-muted-foreground">
                              {[u.municipality, u.school_type].filter(Boolean).join(", ")}
                            </p>
                          </>
                        ) : (
                          <span className="text-muted-foreground">Nenurodyta</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-start gap-1">
                          <StatusBadge status={u.status} />
                          <span className="text-xs text-muted-foreground">{ROLE_LABEL[u.role]}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{u.activities}</td>
                      {canManage && (
                        <td className="px-4 py-3 text-right tabular-nums">
                          {unlimited ? (u.ai_actions ?? 0) : `${u.ai_actions ?? 0} iš ${limit}`}
                        </td>
                      )}
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {formatDate(u.last_sign_in_at) ?? "Neprisijungė"}
                      </td>
                      {canManage && (
                        <td className="px-4 py-3 text-right">
                          {u.id === currentUserId ? (
                            <span className="text-xs text-muted-foreground">Jūs</span>
                          ) : (
                            <Button variant="outline" size="sm" onClick={() => setManaging(u)} aria-label={`Tvarkyti paskyrą: ${u.name}`}>
                              Tvarkyti
                            </Button>
                          )}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="users-breakdown-title" className="space-y-4">
        <div>
          <h2 id="users-breakdown-title" className="text-lg font-semibold text-steam-dark">
            Iš kur vedėjai
          </h2>
          <p className="text-sm text-muted-foreground">Tik aktyvios paskyros. Vienas vedėjas gali dėstyti kelis dalykus.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <BreakdownList title="Savivaldybės" items={byMunicipality} />
          <BreakdownList title="Mokyklų tipai" items={bySchoolType} />
          <BreakdownList title="Dalykai" items={bySubject} />
        </div>
      </section>

      <ManageUserDialog
        user={managing}
        defaultAiLimit={defaultAiLimit}
        onClose={() => setManaging(null)}
        onChanged={applyChange}
      />
    </div>
  )
}

function BreakdownList({ title, items }: { title: string; items: Breakdown[] }) {
  const [expanded, setExpanded] = useState(false)
  const shown = expanded ? items : items.slice(0, 8)
  const max = items[0]?.count ?? 0
  return (
    <div className="rounded-xl border border-border/60 bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-steam-dark">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Duomenų dar nėra.</p>
      ) : (
        <ul className="space-y-2">
          {shown.map((b) => (
            <li key={b.label} className="text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <span className={cn("truncate", b.label === "Nenurodyta" ? "text-muted-foreground" : "text-steam-dark")}>
                  {b.label}
                </span>
                <span className="tabular-nums text-muted-foreground">{b.count}</span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-muted" aria-hidden="true">
                <div className="h-1.5 rounded-full bg-secondary" style={{ width: `${max ? (b.count / max) * 100 : 0}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
      {items.length > 8 && (
        <button
          type="button"
          className="mt-3 text-sm text-secondary-ink underline-offset-4 hover:underline"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
        >
          {expanded ? "Rodyti mažiau" : `Rodyti visas (${items.length})`}
        </button>
      )}
    </div>
  )
}

type Step = { kind: "idle" } | { kind: "confirm-status"; next: AccountStatus } | { kind: "confirm-role"; next: UserRole }

function ManageUserDialog({
  user,
  defaultAiLimit,
  onClose,
  onChanged,
}: {
  user: AdminUserRow | null
  defaultAiLimit: number
  onClose: () => void
  onChanged: (id: string, change: Partial<AdminUserRow>) => void
}) {
  const { toast } = useToast()
  const [step, setStep] = useState<Step>({ kind: "idle" })
  const [roleDraft, setRoleDraft] = useState<UserRole | null>(null)
  const [limitDraft, setLimitDraft] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const role = roleDraft ?? user?.role ?? "teacher"
  const limitValue = limitDraft ?? (user?.ai_limit === null || user?.ai_limit === undefined ? "" : String(user.ai_limit))

  function close() {
    setStep({ kind: "idle" })
    setRoleDraft(null)
    setLimitDraft(null)
    onClose()
  }

  async function call(url: string, body: unknown, success: string): Promise<boolean> {
    setBusy(true)
    try {
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(data.error ?? "Nepavyko išsaugoti.")
      toast({ title: success })
      return true
    } catch (e) {
      toast({ title: "Klaida", description: e instanceof Error ? e.message : "Nepavyko išsaugoti.", variant: "destructive" })
      return false
    } finally {
      setBusy(false)
    }
  }

  async function saveStatus(next: AccountStatus) {
    if (!user) return
    const ok = await call(
      `/api/admin/users/${user.id}/status`,
      { status: next },
      next === "blocked" ? "Paskyra užblokuota" : "Paskyra aktyvuota",
    )
    if (ok) onChanged(user.id, { status: next })
    setStep({ kind: "idle" })
  }

  async function saveRole(next: UserRole) {
    if (!user) return
    const ok = await call("/api/admin/users", { userId: user.id, role: next }, "Rolė pakeista")
    if (ok) {
      onChanged(user.id, { role: next })
      setRoleDraft(null)
    }
    setStep({ kind: "idle" })
  }

  async function saveLimit() {
    if (!user) return
    const trimmed = limitValue.trim()
    const parsed = trimmed === "" ? null : Number(trimmed)
    if (parsed !== null && (!Number.isInteger(parsed) || parsed < 0 || parsed > 10000)) {
      toast({ title: "Limitas turi būti sveikas skaičius nuo 0 iki 10 000.", variant: "destructive" })
      return
    }
    const ok = await call(`/api/admin/users/${user.id}/ai-limit`, { ai_monthly_limit: parsed }, "DI limitas išsaugotas")
    if (ok) {
      onChanged(user.id, { ai_limit: parsed })
      setLimitDraft(null)
    }
  }

  return (
    <Dialog open={user !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        {user && (
          <>
            <DialogHeader>
              <DialogTitle>{user.name}</DialogTitle>
              <DialogDescription>
                {user.email}
                {user.school ? `, ${user.school}` : ""}
              </DialogDescription>
            </DialogHeader>

            {step.kind === "confirm-status" ? (
              <div className="space-y-3 text-sm">
                {step.next === "blocked" ? (
                  <p>
                    Užblokuotas vedėjas nebegalės kurti ir keisti veiklų, naudoti DI ir administravimo. Jo veiklos, rezultatai ir
                    duomenys lieka, paskyrą galėsite atblokuoti bet kada.
                  </p>
                ) : user.status === "pending" ? (
                  <p>
                    Paskyra bus patvirtinta: vedėjas galės kurti ir vesti veiklas, jo prašymas bus pažymėtas patvirtintu, o jam
                    išsiųsime laišką, kad gali prisijungti.
                  </p>
                ) : (
                  <p>Paskyra vėl veiks: vedėjas galės kurti ir vesti veiklas.</p>
                )}
                <DialogFooter className="gap-2">
                  <Button variant="outline" onClick={() => setStep({ kind: "idle" })} disabled={busy}>
                    Atšaukti
                  </Button>
                  <Button
                    onClick={() => saveStatus(step.next)}
                    disabled={busy}
                    className={step.next === "blocked" ? "bg-accent-ink text-white hover:bg-accent-ink/90" : "bg-primary text-primary-foreground hover:bg-primary/90"}
                  >
                    {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                    {step.next === "blocked" ? "Užblokuoti paskyrą" : "Aktyvuoti paskyrą"}
                  </Button>
                </DialogFooter>
              </div>
            ) : step.kind === "confirm-role" ? (
              <div className="space-y-3 text-sm">
                <p>
                  Pakeisti rolę iš „{ROLE_LABEL[user.role]}“ į „{ROLE_LABEL[step.next]}“?
                  {step.next !== "teacher" &&
                    " Administratorius mato platformos statistiką ir tvirtina bibliotekos įrašus. Super administratorius dar tvirtina paskyrų prašymus ir keičia teises."}
                </p>
                <DialogFooter className="gap-2">
                  <Button variant="outline" onClick={() => setStep({ kind: "idle" })} disabled={busy}>
                    Atšaukti
                  </Button>
                  <Button onClick={() => saveRole(step.next)} disabled={busy} className="bg-secondary-ink text-white hover:bg-secondary-ink/90">
                    {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                    Pakeisti rolę
                  </Button>
                </DialogFooter>
              </div>
            ) : (
              <div className="space-y-6">
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Paskyra</dt>
                    <dd className="mt-1">
                      <StatusBadge status={user.status} />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Sukurta</dt>
                    <dd className="mt-1">{formatDate(user.created_at)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Veiklų</dt>
                    <dd className="mt-1 tabular-nums">{user.activities}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Paskutinį kartą prisijungė</dt>
                    <dd className="mt-1">{formatDate(user.last_sign_in_at) ?? "Neprisijungė"}</dd>
                  </div>
                  {user.subjects.length > 0 && (
                    <div className="col-span-2">
                      <dt className="text-xs text-muted-foreground">Dalykai</dt>
                      <dd className="mt-1">{user.subjects.join(", ")}</dd>
                    </div>
                  )}
                </dl>

                {user.role === "staff" ? (
                  <div className="space-y-1 text-sm">
                    <p className="text-xs text-muted-foreground">Rolė</p>
                    <p>{ROLE_LABEL.staff}</p>
                    <p className="text-xs text-muted-foreground">
                      Prisijungia per KU STEAM TEAM. Rolę ir prieigą prie veiklos valdo KU STEAM TEAM. Čia paskyrą galite
                      užblokuoti arba atblokuoti.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="manage-role">Rolė</Label>
                    <div className="flex gap-2">
                      <Select value={role} onValueChange={(v) => setRoleDraft(v as UserRole)}>
                        <SelectTrigger id="manage-role" className="flex-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="teacher">{ROLE_LABEL.teacher}</SelectItem>
                          <SelectItem value="admin">{ROLE_LABEL.admin}</SelectItem>
                          <SelectItem value="super_admin">{ROLE_LABEL.super_admin}</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="outline"
                        disabled={busy || role === user.role}
                        onClick={() => setStep({ kind: "confirm-role", next: role })}
                      >
                        Keisti
                      </Button>
                    </div>
                  </div>
                )}

                {user.role !== "super_admin" && (
                  <div className="space-y-2">
                    <Label htmlFor="manage-limit">DI užklausų per mėnesį</Label>
                    <div className="flex gap-2">
                      <Input
                        id="manage-limit"
                        type="number"
                        min={0}
                        max={10000}
                        inputMode="numeric"
                        placeholder={`Numatytasis (${defaultAiLimit})`}
                        value={limitValue}
                        onChange={(e) => setLimitDraft(e.target.value)}
                        className="flex-1"
                      />
                      <Button variant="outline" disabled={busy || limitDraft === null} onClick={saveLimit}>
                        Išsaugoti
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Šį mėnesį panaudota {user.ai_actions ?? 0}. Tuščias laukas reiškia numatytąjį limitą.
                    </p>
                  </div>
                )}

                <div className="border-t border-border/60 pt-4">
                  {user.status === "blocked" ? (
                    <Button variant="outline" onClick={() => setStep({ kind: "confirm-status", next: "active" })} disabled={busy}>
                      Atblokuoti paskyrą
                    </Button>
                  ) : user.status === "pending" ? (
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => setStep({ kind: "confirm-status", next: "active" })} disabled={busy} className="bg-primary text-primary-foreground hover:bg-primary/90">
                        Aktyvuoti paskyrą
                      </Button>
                      <Button variant="outline" onClick={() => setStep({ kind: "confirm-status", next: "blocked" })} disabled={busy} className="text-accent-ink">
                        Užblokuoti
                      </Button>
                    </div>
                  ) : (
                    <Button variant="outline" onClick={() => setStep({ kind: "confirm-status", next: "blocked" })} disabled={busy} className="text-accent-ink">
                      Užblokuoti paskyrą
                    </Button>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
