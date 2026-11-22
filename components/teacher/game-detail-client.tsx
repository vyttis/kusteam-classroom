"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { GameStatus, GameSettings } from "@/types/game"
import { GameEditDialog } from "./game-edit-dialog"
import { GameDeleteDialog } from "./game-delete-dialog"
import { GameDuplicateDialog } from "./game-duplicate-dialog"
import { PublishDialog } from "./publish-dialog"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Sparkles, Edit3, Trash2, Copy, BookOpen, Share2, MoreHorizontal } from "lucide-react"

interface GameDetailClientProps {
  game: {
    id: string
    title: string
    description: string | null
    status: GameStatus
    settings: GameSettings
    game_code: string
  }
  /** The activity can go to the library (it has tasks and has been run). */
  canPublish?: boolean
}

const menuItem =
  "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-steam-dark hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"

/**
 * The activity page's secondary actions (FAC-13). Only what the current
 * stage needs stays on the header; the rest sits under "Daugiau", so a
 * running activity shows pause/finish, class screen and analytics, not
 * eight buttons in a row.
 */
export function GameDetailClient({ game, canPublish = false }: GameDetailClientProps) {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false)
  const [publishDialogOpen, setPublishDialogOpen] = useState(false)

  const isDraft = game.status === "draft"
  const isFinished = game.status === "finished"
  // After the activity, sharing it is the next step, so it stays visible.
  const publishOnHeader = canPublish && isFinished

  /** Close the menu first, then open the dialog (it lives outside the menu). */
  const openFromMenu = (open: (value: boolean) => void) => () => {
    setMenuOpen(false)
    open(true)
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {/* Single AI surface: the builder's DI tab (verified generation pipeline) */}
        {isDraft && (
          <Button
            asChild
            variant="outline"
            size="sm"
            className="gap-2 border-highlight/40 text-highlight-ink hover:bg-highlight/10"
          >
            <Link href={`/games/${game.id}/builder`}>
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              DI Padėjėjas
            </Link>
          </Button>
        )}
        {publishOnHeader && (
          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-secondary/30 text-secondary-ink hover:bg-secondary/5"
            onClick={() => setPublishDialogOpen(true)}
          >
            <Share2 className="h-4 w-4" aria-hidden="true" />
            Dalintis bibliotekoje
          </Button>
        )}

        <Popover open={menuOpen} onOpenChange={setMenuOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2" aria-label="Daugiau veiksmų">
              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
              Daugiau
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-60 p-1" aria-label="Daugiau veiksmų">
            <ul className="space-y-0.5">
              {!isDraft && (
                <li>
                  <Link href={`/games/${game.id}/builder`} className={menuItem} onClick={() => setMenuOpen(false)}>
                    <Sparkles className="h-4 w-4 text-highlight-ink" aria-hidden="true" />
                    DI Padėjėjas
                  </Link>
                </li>
              )}
              <li>
                <Link href={`/games/${game.id}/lesson`} className={menuItem} onClick={() => setMenuOpen(false)}>
                  <BookOpen className="h-4 w-4 text-secondary-ink" aria-hidden="true" />
                  Sukurti pamoką
                </Link>
              </li>
              <li>
                <button type="button" className={menuItem} onClick={openFromMenu(setDuplicateDialogOpen)}>
                  <Copy className="h-4 w-4 text-primary-ink" aria-hidden="true" />
                  Kopijuoti
                </button>
              </li>
              {canPublish && !publishOnHeader && (
                <li>
                  <button type="button" className={menuItem} onClick={openFromMenu(setPublishDialogOpen)}>
                    <Share2 className="h-4 w-4 text-secondary-ink" aria-hidden="true" />
                    Dalintis bibliotekoje
                  </button>
                </li>
              )}
              {isDraft && (
                <li>
                  <button type="button" className={menuItem} onClick={openFromMenu(setEditDialogOpen)}>
                    <Edit3 className="h-4 w-4 text-secondary-ink" aria-hidden="true" />
                    Redaguoti nustatymus
                  </button>
                </li>
              )}
              {/* A running activity is finished first. A finished one can be
                  deleted: a participant may ask for their data to be removed. */}
              {(isDraft || isFinished) && (
                <li>
                  <button
                    type="button"
                    className={`${menuItem} text-accent-ink`}
                    onClick={openFromMenu(setDeleteDialogOpen)}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    {isFinished ? "Ištrinti veiklą ir jos duomenis" : "Ištrinti"}
                  </button>
                </li>
              )}
            </ul>
          </PopoverContent>
        </Popover>
      </div>

      {isDraft && (
        <GameEditDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          game={game}
          onSuccess={() => {
            setEditDialogOpen(false)
            router.refresh()
          }}
        />
      )}

      {(isDraft || isFinished) && (
        <GameDeleteDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          gameId={game.id}
          gameTitle={game.title}
          finished={isFinished}
        />
      )}

      <GameDuplicateDialog
        open={duplicateDialogOpen}
        onOpenChange={setDuplicateDialogOpen}
        gameId={game.id}
        gameTitle={game.title}
      />

      {canPublish && (
        <PublishDialog
          gameId={game.id}
          gameTitle={game.title}
          gameDescription={game.description}
          open={publishDialogOpen}
          onOpenChange={setPublishDialogOpen}
        />
      )}
    </>
  )
}
