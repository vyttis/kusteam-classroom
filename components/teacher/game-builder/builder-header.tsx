"use client"

import { useState } from "react"
import { GameStatus } from "@/types/game"
import type { AiTaskToReview } from "@/lib/game/ai-review"
import { GameStatusActions } from "@/components/teacher/game-status-actions"
import { QRDisplay } from "@/components/teacher/qr-display"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { ArrowLeft, MoreHorizontal, QrCode, Settings } from "lucide-react"
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
  // Tasks still lacking a confirmed answer — the start dialog must warn about
  // them, otherwise the server rejects activation with a raw error toast
  tasksNeedingAnswer?: { id: string; title: string }[]
  /** DI-made tasks whose answer nobody confirmed: the start dialog lists them. */
  aiTasksToReview?: AiTaskToReview[]
  onOpenTask?: (taskId: string) => void
  onOpenSettings: () => void
}

const statusLabels: Record<GameStatus, string> = {
  draft: "Juodraštis",
  active: "Vyksta",
  paused: "Pristabdyta",
  finished: "Baigta",
}

const menuItem =
  "flex min-h-11 w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-steam-dark hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"

/**
 * The builder's header: where you are, and one main action (the start of
 * the activity). Settings and the join QR are needed rarely, so they are
 * quiet buttons on a wide screen and one "more" menu on a phone, where the
 * header keeps to two short rows.
 */
export function BuilderHeader({
  game,
  challengeCount,
  tasksNeedingAnswer = [],
  aiTasksToReview = [],
  onOpenTask,
  onOpenSettings,
}: BuilderHeaderProps) {
  const [launchOpen, setLaunchOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const statusPill = (
    <span className="shrink-0 rounded-full border border-border bg-white px-2 py-0.5 text-xs font-semibold text-foreground">
      {statusLabels[game.status]}
    </span>
  )

  return (
    <>
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-1 basis-64 items-center gap-1">
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="-ml-2 shrink-0 text-muted-foreground"
          >
            <Link href={`/games/${game.id}`} aria-label="Grįžti į veiklą">
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            </Link>
          </Button>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold leading-tight text-steam-dark sm:text-2xl" title={game.title}>
              {game.title}
            </h1>
            <p className="mt-0.5 hidden min-w-0 items-center gap-2 text-sm text-muted-foreground sm:flex">
              {statusPill}
              {game.description && <span className="hidden truncate md:inline">{game.description}</span>}
            </p>
          </div>

          {/* Phone: the rare actions in one menu. */}
          <Popover open={menuOpen} onOpenChange={setMenuOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="-mr-2 shrink-0 text-muted-foreground sm:hidden"
                aria-label="Daugiau veiksmų"
              >
                <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-60 p-1">
              <ul>
                <li>
                  <button
                    type="button"
                    className={menuItem}
                    onClick={() => {
                      setMenuOpen(false)
                      setLaunchOpen(true)
                    }}
                  >
                    <QrCode className="h-4 w-4" aria-hidden="true" />
                    QR kodas
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className={menuItem}
                    onClick={() => {
                      setMenuOpen(false)
                      onOpenSettings()
                    }}
                  >
                    <Settings className="h-4 w-4" aria-hidden="true" />
                    Veiklos nustatymai
                  </button>
                </li>
              </ul>
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 max-sm:w-full max-sm:justify-between">
          {/* Phone: the state shares the row with the main action. */}
          <span className="sm:hidden">{statusPill}</span>
          <div className="hidden items-center gap-1 sm:flex">
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground"
              onClick={onOpenSettings}
              aria-label="Veiklos nustatymai"
            >
              <Settings className="h-5 w-5" aria-hidden="true" />
            </Button>
            {/* Shows the join QR and code only. It used to say "Paleisti" next
                to "Pradėti veiklą", and facilitators took it for the start. */}
            <Button variant="ghost" className="gap-1.5 px-3 text-foreground" onClick={() => setLaunchOpen(true)}>
              <QrCode className="h-4 w-4" aria-hidden="true" />
              QR kodas
            </Button>
          </div>
          <GameStatusActions
            gameId={game.id}
            status={game.status}
            challengeCount={challengeCount}
            tasksNeedingAnswer={tasksNeedingAnswer}
            aiTasksToReview={aiTasksToReview}
            onOpenTask={onOpenTask}
          />
        </div>
      </header>

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
