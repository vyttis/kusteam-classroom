import { Card, CardContent } from "@/components/ui/card"
import { Users, Target, CheckCircle, Clock } from "lucide-react"
import { GameStats } from "@/types/game"
import { formatAverageTime } from "@/lib/game/formative-insights"

interface AnalyticsCardsProps {
  stats: GameStats
}

export function AnalyticsCards({ stats }: AnalyticsCardsProps) {
  const successRate =
    stats.total_submissions > 0
      ? Math.round((stats.correct_submissions / stats.total_submissions) * 100)
      : 0

  const avgTime = formatAverageTime(stats.avg_completion_time_seconds)

  const cards = [
    {
      label: "Komandos",
      value: stats.total_teams,
      icon: Users,
      color: "text-secondary-ink",
      bg: "bg-secondary/10",
    },
    {
      label: "Atsakymų iš viso",
      value: stats.total_submissions,
      icon: Target,
      color: "text-muted-foreground",
      bg: "bg-muted",
    },
    {
      label: "Teisingi atsakymai",
      value: `${stats.correct_submissions} (${successRate} %)`,
      icon: CheckCircle,
      color: "text-primary-ink",
      bg: "bg-primary/10",
    },
    {
      label: "Vid. laikas iki teisingo atsakymo",
      value: avgTime,
      icon: Clock,
      color: "text-highlight-ink",
      bg: "bg-highlight/10",
    },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {cards.map((card) => (
        <Card key={card.label} className="border-border/50 bg-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl ${card.bg} flex items-center justify-center shrink-0`}
              >
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </div>
              <div>
                <p className="text-xl font-bold text-steam-dark leading-none">
                  {card.value}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {card.label}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
