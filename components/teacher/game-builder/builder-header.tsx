"use client"

import { useState } from "react"
import { GameStatus } from "@/types/game"
import { GameStatusActions } from "@/components/teacher/game-status-actions"
import { QRDisplay } from "@/components/teacher/qr-display"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { ArrowLeft, Settings, QrCode } from "lucide-react"
import Link from "next/link"

interface BuilderHeaderProps {
  game: {
    id: string
    title: string
    description: string | null
    status: GameStatus
    game_code: string
  }
  challengeCount: number
  totalPoints: number
  // Tasks still lacking a confirmed answer — the start dialog must warn about
  // them, otherwise the server rejects activation with a raw error toast
  tasksNeedingAnswer?: { id: string; title: string }[]
  onOpenSettings: () => void
}

const statusLabels: Record<GameStatus, string> = {
  draft: "Juodraštis",
  active: "Aktyvus",
  paused: "Pristabdytas",
  finished: "Baigtas",
}

const statusColors: Record<GameStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-primary/10 text-primary-ink border-primary/20",
  paused: "bg-highlight/10 text-highlight-ink border-highlight/20",
  finished: "bg-secondary/10 text-secondary-ink border-secondary/20",
}

export function BuilderHeader({
  game,
  challengeCount,
  totalPoints,
  tasksNeedingAnswer = [],
  onOpenSettings,
}: BuilderHeaderProps) {
  const [launchOpen, setLaunchOpen] = useState(false)

  return (
    <>
      <div className="border-b border-border/50 bg-white -mx-4 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 basis-56 items-center gap-3">
            <Link href={`/games/${game.id}`}>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-muted-foreground shrink-0"
                aria-label="Grįžti į veiklą"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-steam-dark truncate">
                  {game.title}
                </h1>
                <Badge
                  variant="outline"
                  className={`shrink-0 text-xs ${statusColors[game.status]}`}
                >
                  {statusLabels[game.status]}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {challengeCount} užd. &middot; {totalPoints} tšk.
                {game.description && (
                  <span className="hidden sm:inline">
                    {" "}&middot; {game.description}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-muted-foreground"
              onClick={onOpenSettings}
              aria-label="Veiklos nustatymai"
            >
              <Settings className="h-4 w-4" />
            </Button>
            <GameStatusActions
              gameId={game.id}
              status={game.status}
              challengeCount={challengeCount}
              tasksNeedingAnswer={tasksNeedingAnswer}
            />
            {/* Shows the join QR and code only. It used to say "Paleisti" next
                to "Pradėti veiklą", and facilitators took it for the start. */}
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 h-8"
              onClick={() => setLaunchOpen(true)}
            >
              <QrCode className="h-3.5 w-3.5" aria-hidden="true" />
              QR kodas
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={launchOpen} onOpenChange={setLaunchOpen}>
        <DialogContent className="max-w-sm sm:max-w-md">
          <DialogTitle className="text-lg font-bold text-steam-dark text-center">
            Prisijungimo QR kodas
          </DialogTitle>
          <QRDisplay gameCode={game.game_code} />
        </DialogContent>
      </Dialog>
    </>
  )
}
