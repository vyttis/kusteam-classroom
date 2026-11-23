"use client"

import { useRouter } from "next/navigation"
import { GameCard } from "./game-card"
import { GameWithChallengeCount } from "@/types/game"
import { nextAction, type GameGroups } from "@/lib/teacher/dashboard"
import { pluralizeLt } from "@/lib/utils"

interface GamesGridProps {
  /** Activities in dashboard order: running, drafts, finished. */
  groups: GameGroups<GameWithChallengeCount & { teamCount?: number }>
}

const GROUPS = [
  { key: "running", id: "veiklos-vyksta", title: "Vyksta dabar" },
  { key: "drafts", id: "veiklos-juodrasciai", title: "Juodraščiai" },
  { key: "finished", id: "veiklos-baigtos", title: "Baigtos" },
] as const

export function GamesGrid({ groups }: GamesGridProps) {
  const router = useRouter()

  return (
    <div className="space-y-8">
      {GROUPS.map((group) => {
        const games = groups[group.key]
        if (games.length === 0) return null
        return (
          <section key={group.key} aria-labelledby={group.id}>
            <h2 id={group.id} className="mb-3 flex items-baseline gap-2 text-base font-bold text-steam-dark">
              {group.title}
              <span className="text-sm font-normal text-muted-foreground">
                {games.length} {pluralizeLt(games.length, "veikla", "veiklos", "veiklų")}
              </span>
            </h2>
            {/* Rows stretch, so the cards of a row are equally tall. */}
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {games.map((game) => (
                <li key={game.id} className="min-w-0">
                  <GameCard
                    game={game}
                    action={nextAction({
                      id: game.id,
                      status: game.status,
                      taskCount: game.challenges?.[0]?.count || 0,
                    })}
                    onUpdate={() => router.refresh()}
                  />
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
