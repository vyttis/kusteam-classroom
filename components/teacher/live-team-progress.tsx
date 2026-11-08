"use client"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { useLiveGame } from "@/hooks/use-live-game"
import { LiveConnectionBanner } from "./live-connection-banner"
import { Users, Trophy, Clock, AlertTriangle, MoreHorizontal, Loader2, Pencil, Trash2, Smartphone } from "lucide-react"
import { TeamRejoinDialog } from "./team-rejoin-dialog"

interface LiveTeamProgressProps {
  gameId: string
  /** While paused nobody is stuck. */
  paused?: boolean
  /** When the last pause ended, from the server, so a reload keeps it. */
  resumedAt?: string | null
  /** Number of tasks; a team that solved them all is done, not stuck. */
  challengeCount?: number
}

function formatTimeSince(timestamp: string): string {
  const now = Date.now()
  const then = new Date(timestamp).getTime()
  const diffMs = now - then
  const diffMin = Math.floor(diffMs / 60000)

  if (diffMin < 1) return "ką tik"
  if (diffMin < 60) return `prieš ${diffMin} min.`
  const diffHours = Math.floor(diffMin / 60)
  return `prieš ${diffHours} val.`
}

function teamLabel(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 19) return "komandų"
  if (mod10 === 1) return "komanda"
  if (mod10 >= 2 && mod10 <= 9) return "komandos"
  return "komandų"
}

export function LiveTeamProgress({ gameId, paused = false, resumedAt: serverResumedAt = null, challengeCount }: LiveTeamProgressProps) {
  const { teams, solvedCounts, lastSubmissions, historyLoaded, connectionState, retry } =
    useLiveGame(gameId)
  const [, setTick] = useState(0)
  const { toast } = useToast()
  // When the activity was last resumed: nobody could answer during the
  // pause, so the 5 minutes count from here at the earliest. The server's
  // time (games.resumed_at) survives a reload or a resume from another
  // device; the local one covers the seconds until the page refreshes.
  const [localResumedAt, setResumedAt] = useState<number | null>(null)
  const resumedAt = Math.max(localResumedAt ?? 0, serverResumedAt ? Date.parse(serverResumedAt) || 0 : 0) || null
  const wasPaused = useRef(paused)
  useEffect(() => {
    const resumed = wasPaused.current && !paused
    wasPaused.current = paused
    if (!resumed) return
    const t = window.setTimeout(() => setResumedAt(Date.now()), 0)
    return () => window.clearTimeout(t)
  }, [paused])
  // Moderation: rename an unsuitable name, remove a test or duplicate team.
  const [editing, setEditing] = useState<{ id: string; name: string; mode: "rename" | "remove" } | null>(null)
  const [nameDraft, setNameDraft] = useState("")
  // A team that lost its device gets a QR to continue on another one.
  const [rejoinTeam, setRejoinTeam] = useState<{ id: string; name: string } | null>(null)
  const [busy, setBusy] = useState(false)

  async function moderate() {
    if (!editing) return
    setBusy(true)
    try {
      const res = await fetch(`/api/games/${gameId}/teams/${editing.id}`, {
        method: editing.mode === "rename" ? "PATCH" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: editing.mode === "rename" ? JSON.stringify({ name: nameDraft }) : undefined,
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(data.error ?? "Nepavyko išsaugoti.")
      toast({ title: editing.mode === "rename" ? "Komanda pervadinta" : "Komanda pašalinta" })
      setEditing(null)
      retry()
    } catch (e) {
      toast({ title: "Klaida", description: e instanceof Error ? e.message : undefined, variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  // Tick every 30s to update relative times
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30000)
    return () => clearInterval(interval)
  }, [])

  // No answer for 5 minutes, counted from the last answer or, for a team
  // that has not answered yet, from joining, and never from before the last
  // resume. Not while paused, and not for a team that has solved every task.
  function isStuck(team: { id: string; joined_at: string }): boolean {
    if (paused) return false
    // Before the answer history is read, a team that answered would look
    // like one that never did.
    if (!historyLoaded) return false
    if (challengeCount && (solvedCounts.get(team.id) ?? 0) >= challengeCount) return false
    const since = Math.max(
      new Date(lastSubmissions.get(team.id) ?? team.joined_at).getTime() || 0,
      resumedAt ?? 0
    )
    if (!since) return false
    return Date.now() - since > 5 * 60 * 1000
  }

  if (teams.length === 0) {
    return (
      <div className="space-y-3">
        {connectionState === "degraded" && (
          <LiveConnectionBanner onRetry={retry} />
        )}
        <Card className="border-border/50 bg-white">
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">
                Dar nėra prisijungusių komandų
              </p>
              <p className="text-xs mt-1">
                Komandos atsiras čia, kai prisijungs prie veiklos
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {connectionState === "degraded" && (
        <LiveConnectionBanner onRetry={retry} />
      )}

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Users className="h-4 w-4" />
        <span>
          {teams.length} {teamLabel(teams.length)}
        </span>
      </div>

      {/* At most two columns: this area is a third of the page width at
          most, and three cards cut team names to a few letters. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {teams.map((team, index) => {
          const lastSub = lastSubmissions.get(team.id)
          const stuck = isStuck(team)

          return (
            <Card
              key={team.id}
              className={`border-border/50 bg-white transition-shadow hover:shadow-md ${
                stuck ? "ring-1 ring-highlight/50" : ""
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-steam-dark leading-snug line-clamp-2 break-words" title={team.name}>
                      {index === 0 && teams.length > 1 && (
                        <Trophy className="inline h-3.5 w-3.5 text-highlight-ink mr-1 -mt-0.5" />
                      )}
                      {team.name}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {stuck && (
                      <Badge className="shrink-0 bg-highlight/15 text-highlight-ink border-highlight/30 hover:bg-highlight/20">
                        <AlertTriangle className="h-3 w-3 mr-1" aria-hidden="true" />
                        Įstrigo!
                      </Badge>
                    )}
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Tvarkyti komandą: ${team.name}`}>
                          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-52 p-1">
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm hover:bg-muted"
                          onClick={() => {
                            setNameDraft(team.name)
                            setEditing({ id: team.id, name: team.name, mode: "rename" })
                          }}
                        >
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                          Pervadinti
                        </button>
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm hover:bg-muted"
                          onClick={() => setRejoinTeam({ id: team.id, name: team.name })}
                        >
                          <Smartphone className="h-4 w-4" aria-hidden="true" />
                          Grąžinti į komandą
                        </button>
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm text-accent-ink hover:bg-accent/5"
                          onClick={() => setEditing({ id: team.id, name: team.name, mode: "remove" })}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                          Pašalinti
                        </button>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-muted-foreground mb-0.5">Taškai</p>
                    <p className="font-bold text-lg text-primary-ink leading-none">
                      {team.total_points}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-0.5">
                      Užduočių išspręsta
                    </p>
                    <p className="font-bold text-lg text-steam-dark leading-none">
                      {solvedCounts.get(team.id) ?? 0}
                    </p>
                  </div>
                </div>

                {lastSub && (
                  <div className="mt-3 pt-2 border-t border-border/40 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>Paskutinis atsakymas: {formatTimeSince(lastSub)}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      <TeamRejoinDialog gameId={gameId} team={rejoinTeam} onClose={() => setRejoinTeam(null)} />

      <Dialog open={editing !== null} onOpenChange={(open) => !open && !busy && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          {editing && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {editing.mode === "rename" ? "Pervadinti komandą" : `Pašalinti komandą „${editing.name}“?`}
                </DialogTitle>
                <DialogDescription>
                  {editing.mode === "rename"
                    ? "Naujas vardas iškart matomas klasės ekrane ir rezultatų lentelėje."
                    : "Komanda, jos atsakymai, užuominos ir refleksija bus ištrinti. Dalyviai su šia komanda nebegalės tęsti ir turės prisijungti iš naujo. Šio veiksmo atšaukti negalima."}
                </DialogDescription>
              </DialogHeader>
              {editing.mode === "rename" && (
                <Input
                  aria-label="Naujas komandos vardas"
                  value={nameDraft}
                  maxLength={30}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && nameDraft.trim()) void moderate()
                  }}
                />
              )}
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setEditing(null)} disabled={busy}>
                  Atšaukti
                </Button>
                <Button
                  onClick={() => void moderate()}
                  disabled={busy || (editing.mode === "rename" && (!nameDraft.trim() || nameDraft.trim() === editing.name))}
                  className={editing.mode === "remove" ? "bg-accent-ink text-white hover:bg-accent-ink/90" : "bg-primary text-primary-foreground hover:bg-primary/90"}
                >
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                  {editing.mode === "rename" ? "Išsaugoti vardą" : "Pašalinti komandą"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
