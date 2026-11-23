"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowRight } from "lucide-react"
import { GameCard } from "./game-card"
import { GameWithChallengeCount } from "@/types/game"
import { nextAction, type GameGroups, type NextActionKind } from "@/lib/teacher/dashboard"
import { pluralizeLt } from "@/lib/utils"

interface GamesGridProps {
  /** Activities in dashboard order: running, drafts, finished. */
  groups: GameGroups<GameWithChallengeCount>
}

const GROUPS = [
  { key: "running", id: "veiklos-vyksta", title: "Vyksta dabar" },
  { key: "drafts", id: "veiklos-juodrasciai", title: "Juodraščiai" },
  { key: "finished", id: "veiklos-baigtos", title: "Baigtos" },
] as const

// The filled button is kept for what moves a lesson forward (lead a running
// activity, start a ready one); the rest are outlined.
const ACTION_STYLE: Record<NextActionKind, string> = {
  continue: "bg-primary text-primary-foreground hover:bg-primary/90",
  start: "bg-primary text-primary-foreground hover:bg-primary/90",
  "add-tasks": "border border-primary/40 bg-white text-primary-ink hover:bg-primary/5",
  results: "border border-secondary/40 bg-white text-secondary-ink hover:bg-secondary/5",
}

export function GamesGrid({ groups }: GamesGridProps) {
  const router = useRouter()

  return (
    <div className="space-y-8">
      {GROUPS.map((group) => {
        const games = groups[group.key]
        if (games.length === 0) return null
        return (
          <section key={group.key} aria-labelledby={group.id}>
            <h2 id={group.id} className="mb-3 flex items-baseline gap-2 text-base font-semibold text-steam-dark">
              {group.title}
              <span className="text-sm font-normal text-muted-foreground">
                {games.length} {pluralizeLt(games.length, "veikla", "veiklos", "veiklų")}
              </span>
            </h2>
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {games.map((game, index) => {
                const action = nextAction({
                  id: game.id,
                  status: game.status,
                  taskCount: game.challenges?.[0]?.count || 0,
                })
                return (
                  <li key={game.id} className="flex min-w-0 flex-col gap-2">
                    <GameCard game={game} index={Math.min(index, 5)} onUpdate={() => router.refresh()} />
                    <Link
                      href={action.href}
                      aria-label={`${action.verb} „${game.title}“`}
                      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${ACTION_STYLE[action.kind]}`}
                    >
                      {action.label}
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
