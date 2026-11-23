import { GameStats } from "@/types/game"
import { formatAverageTime } from "@/lib/game/formative-insights"

interface AnalyticsCardsProps {
  stats: GameStats
}

/**
 * The four totals of an activity as one quiet row under the digest: the
 * same size, tabular figures and a shared baseline, so they compare at a
 * glance without competing with what to discuss.
 */
export function AnalyticsCards({ stats }: AnalyticsCardsProps) {
  const successRate =
    stats.total_submissions > 0
      ? Math.round((stats.correct_submissions / stats.total_submissions) * 100)
      : 0

  const cards = [
    { label: "Komandos", value: stats.total_teams },
    { label: "Atsakymų iš viso", value: stats.total_submissions },
    { label: "Teisingi atsakymai", value: `${stats.correct_submissions} (${successRate} %)` },
    { label: "Vid. laikas iki teisingo atsakymo", value: formatAverageTime(stats.avg_completion_time_seconds) },
  ]

  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-xl border border-border bg-white p-5 lg:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className="min-w-0 border-l-2 border-border pl-4">
          <p className="text-2xl font-bold leading-none text-steam-dark tabular-nums">{card.value}</p>
          <p className="mt-1.5 text-sm text-muted-foreground">{card.label}</p>
        </div>
      ))}
    </div>
  )
}
