"use client"

import { useState } from "react"
import Link from "next/link"
import { GameWithChallengeCount } from "@/types/game"
import type { NextAction, NextActionKind } from "@/lib/teacher/dashboard"
import { cn, pluralizeLt } from "@/lib/utils"
import { GameEditDialog } from "./game-edit-dialog"
import { GameDeleteDialog } from "./game-delete-dialog"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ArrowRight, Edit3, FileText, MonitorPlay, MoreHorizontal, Pause, Trash2 } from "lucide-react"

interface GameCardProps {
  game: GameWithChallengeCount & { teamCount?: number }
  /** The one thing to do next with this activity (lib/teacher/dashboard.ts). */
  action: NextAction
  onUpdate?: () => void
}

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"

// One action per card. Only leading a running activity is filled: it is the
// main thing on the page while a lesson is on. The rest are outlined.
const ACTION_STYLE: Record<NextActionKind, string> = {
  continue: "min-h-12 bg-primary text-primary-foreground hover:bg-primary/90",
  start: "min-h-11 border-2 border-primary bg-white text-foreground hover:bg-primary/10",
  "add-tasks": "min-h-11 border border-foreground/25 bg-white text-foreground hover:bg-muted",
  results: "min-h-11 border border-foreground/25 bg-white text-foreground hover:bg-muted",
}

const menuItem =
  "flex min-h-11 w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-steam-dark hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"

/**
 * One activity on the dashboard: title, the facts a facilitator looks for,
 * one action for its state, and the rare actions in a quiet menu. The group
 * heading already says whether it runs, is a draft or is over, so the card
 * repeats no state badge; only "Pristabdyta" is said, because the heading
 * cannot.
 */
export function GameCard({ game, action, onUpdate }: GameCardProps) {
  const challengeCount = game.challenges?.[0]?.count || 0
  const teamCount = game.teamCount ?? 0
  const isDraft = game.status === "draft"
  const isLive = game.status === "active" || game.status === "paused"
  const isFinished = game.status === "finished"
  // A running activity is finished first; a draft or a finished one can go
  // (a participant may ask for their data to be deleted after the lesson).
  const canDelete = isDraft || isFinished

  const [menuOpen, setMenuOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  /** Close the menu first, then open the dialog (it lives outside the menu). */
  const openFromMenu = (open: (value: boolean) => void) => () => {
    setMenuOpen(false)
    open(true)
  }

  return (
    <article
      className={cn(
        "flex h-full min-w-0 flex-col rounded-xl border bg-white p-5 shadow-sm transition-shadow hover:shadow-md motion-reduce:transition-none",
        isLive ? "border-l-[6px] border-primary" : "border-border",
      )}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          {game.status === "paused" && (
            <p className="mb-1 flex items-center gap-1.5 text-sm font-bold text-steam-dark">
              <Pause className="h-4 w-4" aria-hidden="true" />
              Pristabdyta
            </p>
          )}
          {/* Two lines, not one: similar titles could not be told apart. */}
          <h3 className="text-lg font-bold leading-snug text-steam-dark">
            <Link
              href={`/games/${game.id}`}
              title={game.title}
              className={`-my-2.5 block rounded-sm py-2.5 underline-offset-4 hover:underline ${FOCUS_RING}`}
            >
              <span className="line-clamp-2 break-words">{game.title}</span>
            </Link>
          </h3>
          {game.description && (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{game.description}</p>
          )}
        </div>

        {!isLive && (
          <Popover open={menuOpen} onOpenChange={setMenuOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="-mr-2 -mt-2 h-11 w-11 shrink-0 text-muted-foreground"
                aria-label={`Daugiau veiksmų: „${game.title}“`}
              >
                <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 p-1">
              <ul>
                <li>
                  <Link href={`/games/${game.id}`} className={menuItem} onClick={() => setMenuOpen(false)}>
                    <FileText className="h-4 w-4" aria-hidden="true" />
                    Veiklos puslapis
                  </Link>
                </li>
                {isDraft && (
                  <li>
                    <button type="button" className={menuItem} onClick={openFromMenu(setEditOpen)}>
                      <Edit3 className="h-4 w-4" aria-hidden="true" />
                      Redaguoti nustatymus
                    </button>
                  </li>
                )}
                {canDelete && (
                  <li>
                    <button type="button" className={menuItem} onClick={openFromMenu(setDeleteOpen)}>
                      <Trash2 className="h-4 w-4 text-accent-ink" aria-hidden="true" />
                      {isFinished ? "Ištrinti veiklą ir jos duomenis" : "Ištrinti"}
                    </button>
                  </li>
                )}
              </ul>
            </PopoverContent>
          </Popover>
        )}
      </div>

      {/* Facts: the same order on every card, so a row of cards compares. */}
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <li className="tabular-nums">
          {challengeCount} {pluralizeLt(challengeCount, "užduotis", "užduotys", "užduočių")}
        </li>
        {!isDraft && (
          <li className="tabular-nums">
            {teamCount} {pluralizeLt(teamCount, "komanda", "komandos", "komandų")}
          </li>
        )}
        {!isFinished && (
          <li>
            Kodas <span className="font-mono font-bold tracking-wider text-steam-dark">{game.game_code}</span>
          </li>
        )}
        <li className="tabular-nums">
          {new Date(game.created_at).toLocaleDateString("lt-LT", { timeZone: "Europe/Vilnius" })}
        </li>
      </ul>

      <div className="mt-auto flex flex-wrap gap-2 pt-4">
        <Link
          href={action.href}
          aria-label={`${action.verb} „${game.title}“`}
          className={cn(
            "inline-flex flex-1 items-center justify-center gap-2 rounded-full px-5 text-sm font-bold transition-colors motion-reduce:transition-none",
            FOCUS_RING,
            ACTION_STYLE[action.kind],
          )}
        >
          {action.label}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
        {isLive && (
          <Link
            href={`/games/${game.id}/live`}
            className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-foreground/25 bg-white px-4 text-sm font-bold text-foreground transition-colors hover:bg-muted motion-reduce:transition-none ${FOCUS_RING}`}
          >
            <MonitorPlay className="h-4 w-4" aria-hidden="true" />
            Klasės ekranas
          </Link>
        )}
      </div>

      {/* Dialogs */}
      {isDraft && (
        <GameEditDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          game={{
            id: game.id,
            title: game.title,
            description: game.description,
            settings: game.settings,
          }}
          onSuccess={() => {
            setEditOpen(false)
            onUpdate?.()
          }}
        />
      )}
      {canDelete && (
        <GameDeleteDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          gameId={game.id}
          gameTitle={game.title}
          finished={isFinished}
          onSuccess={() => {
            setDeleteOpen(false)
            onUpdate?.()
          }}
        />
      )}
    </article>
  )
}
