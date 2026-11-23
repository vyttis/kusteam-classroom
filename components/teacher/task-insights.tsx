import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Lightbulb } from "lucide-react"
import { pluralizeLt } from "@/lib/utils"
import type { DetailedChallengeStat } from "@/lib/game/detailed-stats"
import type { InsightKind } from "@/lib/game/formative-insights"

const INSIGHT_TONES: Record<InsightKind, string> = {
  mastered: "text-primary-ink border-primary/30 bg-primary/5",
  mixed: "text-secondary-ink border-secondary/30 bg-secondary/5",
  many_attempts: "text-highlight-ink border-highlight/30 bg-highlight/5",
  hints: "text-highlight-ink border-highlight/30 bg-highlight/5",
  unsolved: "text-accent-ink border-accent/30 bg-accent/5",
  few_reached: "text-muted-foreground border-border bg-muted/40",
  no_attempts: "text-muted-foreground border-border bg-muted/40",
}

function teams(n: number): string {
  return `${n} ${pluralizeLt(n, "komanda", "komandos", "komandų")}`
}

/** A bar whose value is also written next to it; the bar itself is decoration. */
function ShareBar({ part, whole }: { part: number; whole: number }) {
  const percent = whole > 0 ? Math.round((part / whole) * 100) : 0
  return (
    <div className="w-20 h-2 bg-muted rounded-full overflow-hidden shrink-0" aria-hidden="true">
      <div className="h-full bg-primary rounded-full" style={{ width: `${percent}%` }} />
    </div>
  )
}

interface TaskInsightsProps {
  stats: DetailedChallengeStat[]
  /** The answer texts were read (the viewer owns the activity). */
  answersIncluded: boolean
}

/**
 * Per task: what the numbers suggest for the next lesson, the most common
 * wrong answers of a typed task and the picks of a choice task. The wrong
 * answers are free text typed by participants: rendered as text only (React
 * escapes it), already cleaned and capped on the server.
 */
export function TaskInsights({ stats, answersIncluded }: TaskInsightsProps) {
  if (stats.length === 0) return null
  return (
    <Card className="border-border/50 bg-white">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-highlight-ink" aria-hidden="true" />
          Užduočių įžvalgos
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Ką kiekvienos užduoties rodikliai sako kitai pamokai.
          {answersIncluded
            ? " Klaidingus atsakymus rašė dalyviai, juos matote tik jūs."
            : " Klaidingų atsakymų tekstus mato tik veiklos vedėjas."}
        </p>
      </CardHeader>
      <CardContent>
        <ol className="space-y-3">
          {stats.map((stat, index) => (
            <li key={stat.challenge_id} className="rounded-lg border border-border/50 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="text-sm font-semibold text-steam-dark min-w-0 break-words">
                  {index + 1}. {stat.title}
                </h3>
                <Badge variant="outline" className={`text-xs shrink-0 ${INSIGHT_TONES[stat.insight.kind]}`}>
                  {stat.insight.label}
                </Badge>
              </div>
              <p className="text-sm text-steam-dark mt-1.5">{stat.insight.text}</p>

              {stat.attempted_teams > 0 && (
                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                  <ShareBar part={stat.first_try_solves} whole={stat.attempted_teams} />
                  <span>
                    Iš pirmo karto: {stat.first_try_solves} iš {stat.attempted_teams} ({stat.first_try_rate ?? 0} %).
                    Užuominas naudojo: {stat.hint_teams}.
                  </span>
                </div>
              )}

              {stat.wrong_answers.length > 0 && (
                <div className="mt-3">
                  <h4 className="text-xs font-medium text-muted-foreground">Dažniausi klaidingi atsakymai</h4>
                  <ul className="mt-1 space-y-1">
                    {stat.wrong_answers.map((wrong) => (
                      <li key={wrong.text} className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="min-w-0 break-words text-steam-dark">„{wrong.text}“</span>
                        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                          {teams(wrong.teams)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {answersIncluded &&
                (stat.type === "text" || stat.type === "number") &&
                stat.attempted_teams > 0 &&
                stat.wrong_answers.length === 0 && (
                  <p className="mt-3 text-xs text-muted-foreground">Klaidingų atsakymų nebuvo.</p>
                )}

              {stat.choice_stats && stat.choice_stats.length > 0 && stat.attempted_teams > 0 && (
                <div className="mt-3">
                  <h4 className="text-xs font-medium text-muted-foreground">Kiek komandų rinkosi kiekvieną variantą</h4>
                  <ul className="mt-1 space-y-1">
                    {stat.choice_stats.map((choice, choiceIndex) => (
                      <li key={`${choiceIndex}-${choice.option}`} className="flex items-center justify-between gap-3 text-sm">
                        <span className="min-w-0 break-words text-steam-dark">
                          {choice.option}
                          {choice.correct && <span className="text-xs text-primary-ink"> (teisingas)</span>}
                        </span>
                        <span className="flex items-center gap-2 shrink-0">
                          <ShareBar part={choice.teams} whole={stat.attempted_teams} />
                          <span className="text-xs text-muted-foreground tabular-nums w-24 text-right">
                            {teams(choice.teams)}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  )
}
