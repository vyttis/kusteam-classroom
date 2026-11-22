"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { motion } from "framer-motion"
import {
  BarChart3,
  Users,
  Trophy,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react"
import type { DetailedChallengeStat, DetailedStats } from "@/lib/game/detailed-stats"
import { summarizeClass } from "@/lib/game/formative-insights"

interface GameResultsSummaryProps {
  gameId: string
  totalChallenges: number
}

type SummaryStats = DetailedStats & { game_status?: string }

/** How often the numbers are read again while the activity runs. */
const LIVE_REFRESH_MS = 10_000

/**
 * Class summary for the facilitator: completion, accuracy, where the class
 * got stuck and what went well.
 *
 * The numbers come from the same per-task statistics as the analytics page
 * (teams that solved a task, not answers), and while the activity is active
 * or paused they are read again every few seconds: a summary read once when
 * the page opened kept showing the first team with no answers for the rest
 * of the lesson. The texts participants typed are not requested here
 * ("answers=0"): this page is often on a projector.
 */
export function GameResultsSummary({ gameId, totalChallenges }: GameResultsSummaryProps) {
  const [stats, setStats] = useState<SummaryStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)

  const running = stats?.game_status === "active" || stats?.game_status === "paused"

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`/api/games/${gameId}/analytics/detailed?answers=0`, { cache: "no-store" })
        if (!res.ok) {
          if (!cancelled) setError("Nepavyko gauti statistikos")
          return
        }
        const data = (await res.json()) as SummaryStats
        if (!cancelled) {
          setStats(data)
          setUpdatedAt(new Date())
          setError(null)
        }
      } catch {
        if (!cancelled) setError("Nepavyko gauti statistikos")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    if (!running) {
      return () => {
        cancelled = true
      }
    }
    // A hidden tab does not read; it catches up when it is shown again.
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load()
    }, LIVE_REFRESH_MS)
    const onVisible = () => {
      if (document.visibilityState === "visible") void load()
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      cancelled = true
      window.clearInterval(timer)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [gameId, running])

  if (loading) {
    return (
      <Card className="border-border/50 bg-white">
        <CardContent className="p-6 flex items-center justify-center text-muted-foreground gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Skaičiuojama klasės statistika…</span>
        </CardContent>
      </Card>
    )
  }

  // Numbers that can no longer be refreshed are not shown as current.
  if (!stats || (error && running)) {
    return error ? (
      <p role="status" className="text-sm text-muted-foreground">
        Klasės rezultatų suvestinės įkelti nepavyko. Tikslūs skaičiai yra analitikos puslapyje.
      </p>
    ) : null
  }
  if (stats.total_teams === 0) return null

  const taskCount = stats.challenge_stats.length || totalChallenges
  const totals = summarizeClass(stats.challenge_stats, stats.total_teams)

  const attempted = stats.challenge_stats
    .map((c, index) => ({ ...c, index }))
    .filter((c) => c.attempted_teams > 0)
  const solvedShare = (c: DetailedChallengeStat) => c.solves / c.attempted_teams
  const firstShare = (c: DetailedChallengeStat) => c.first_try_solves / c.attempted_teams

  const hardest = attempted
    .filter((c) => c.insight.kind !== "mastered")
    .sort((a, b) => solvedShare(a) - solvedShare(b) || firstShare(a) - firstShare(b) || a.index - b.index)
    .slice(0, 3)

  const easiest = attempted
    .filter((c) => solvedShare(c) >= 0.5 && !hardest.some((h) => h.challenge_id === c.challenge_id))
    .sort((a, b) => firstShare(b) - firstShare(a) || solvedShare(b) - solvedShare(a) || a.index - b.index)
    .slice(0, 3)

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="border-secondary/30 bg-gradient-to-br from-secondary/5 to-white">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-secondary-ink" />
            Klasės rezultatų suvestinė
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Pedagoginis pamokos eigos apibendrinimas: kas pavyko, kur reikia grįžti.
          </p>
          {running && updatedAt && (
            <p className="text-xs text-muted-foreground mt-1">
              Veikla vyksta, skaičiai atnaujinami kas 10 s. Atnaujinta{" "}
              {updatedAt.toLocaleTimeString("lt-LT", { timeZone: "Europe/Vilnius" })}.
            </p>
          )}
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Top-line KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard
              icon={<Users className="h-4 w-4" />}
              label="Komandos"
              value={stats.total_teams.toString()}
              tint="secondary"
            />
            <KpiCard
              icon={<CheckCircle2 className="h-4 w-4" />}
              label="Užbaigta"
              value={`${totals.completion_pct} %`}
              hint={`${totals.solved} iš ${totals.possible} sprendimų`}
              tint="primary"
            />
            <KpiCard
              icon={<TrendingUp className="h-4 w-4" />}
              label="Bandymų tikslumas"
              value={totals.attempts > 0 ? `${totals.accuracy_pct} %` : "-"}
              hint={totals.attempts > 0 ? `${totals.correct} iš ${totals.attempts} atsakymų` : "Atsakymų dar nėra"}
              tint="highlight"
            />
            <KpiCard
              icon={<Trophy className="h-4 w-4" />}
              label="Iš viso užduočių"
              value={taskCount.toString()}
              tint="accent"
            />
          </div>

          {/* Hardest / easiest split */}
          {(hardest.length > 0 || easiest.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ChallengeListPanel
                title="Sudėtingiausios užduotys"
                hint="Kur klasė užstrigo. Verta aptarti."
                icon={<AlertCircle className="h-4 w-4 text-accent-ink" />}
                tone="accent"
                items={hardest}
                emptyText="Sunkių užduočių kol kas nėra."
              />
              <ChallengeListPanel
                title="Lengviausiai pavyko"
                hint="Dalyviai jau valdo šią medžiagą."
                icon={<CheckCircle2 className="h-4 w-4 text-primary-ink" />}
                tone="primary"
                items={easiest}
                emptyText="Kol kas nėra užduoties, kurią išsprendė bent pusė bandžiusių komandų."
              />
            </div>
          )}

          {/* Methodological note */}
          <div className="rounded-lg border border-secondary/30 bg-secondary/5 p-3 text-xs text-muted-foreground leading-relaxed">
            <strong className="text-secondary-ink">Metodinė pastaba.</strong>{" "}
            Suvestinė pateikia kiekybinius rodiklius. Pedagoginis vertinimas reikalauja
            kokybinės refleksijos su klase: kas pavyko, kodėl, ką darysite kitą pamoką.
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

function KpiCard({
  icon,
  label,
  value,
  hint,
  tint,
}: {
  icon: React.ReactNode
  label: string
  value: string
  hint?: string
  tint: "primary" | "secondary" | "highlight" | "accent"
}) {
  const tints: Record<string, string> = {
    primary: "bg-primary/10 text-primary-ink",
    secondary: "bg-secondary/10 text-secondary-ink",
    highlight: "bg-highlight/15 text-steam-dark",
    accent: "bg-accent/10 text-accent-ink",
  }
  return (
    <div className="rounded-xl border border-border/40 bg-white p-3">
      <div className={`inline-flex items-center justify-center w-7 h-7 rounded-md ${tints[tint]} mb-2`}>
        {icon}
      </div>
      <div className="text-xl font-bold text-steam-dark tabular-nums leading-none">{value}</div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground mt-1">{label}</div>
      {hint && <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  )
}

function ChallengeListPanel({
  title,
  hint,
  icon,
  tone,
  items,
  emptyText,
}: {
  title: string
  hint: string
  icon: React.ReactNode
  tone: "primary" | "accent"
  items: (DetailedChallengeStat & { index: number })[]
  emptyText: string
}) {
  const borderTone = tone === "primary" ? "border-primary/20" : "border-accent/20"
  return (
    <div className={`rounded-xl border ${borderTone} bg-white p-4`}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <h4 className="text-sm font-semibold text-steam-dark">{title}</h4>
      </div>
      <p className="text-xs text-muted-foreground mb-3">{hint}</p>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyText}</p>
      ) : (
        <ol className="space-y-2">
          {items.map((c) => (
            <li key={c.challenge_id} className="flex items-start justify-between gap-2 text-sm">
              <div className="min-w-0 flex-1">
                <div className="font-medium text-steam-dark text-[13px] truncate">
                  {c.index + 1}. {c.title}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Išsprendė {c.solves} iš {c.attempted_teams} bandžiusių komandų, iš pirmo karto {c.first_try_solves}
                </div>
              </div>
              <Badge
                variant="outline"
                className={`text-xs shrink-0 ${tone === "primary" ? "border-primary/30 text-primary-ink" : "border-accent/30 text-accent-ink"}`}
              >
                {c.completion_rate} % klasės
              </Badge>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
