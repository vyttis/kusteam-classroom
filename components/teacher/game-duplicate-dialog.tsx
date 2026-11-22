"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { readJson } from "@/lib/http/read-json"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { AlertTriangle, Copy, Loader2 } from "lucide-react"

interface GameDuplicateDialogProps {
  gameId: string
  gameTitle: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function GameDuplicateDialog({
  gameId,
  gameTitle,
  open,
  onOpenChange,
}: GameDuplicateDialogProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [title, setTitle] = useState(`${gameTitle} (kopija)`)
  const [duplicating, setDuplicating] = useState(false)
  // The copy exists but is not complete (the server answered 207): the
  // dialog stays open and says what is missing.
  const [partial, setPartial] = useState<{ gameId: string; message: string } | null>(null)

  async function handleDuplicate() {
    setDuplicating(true)
    try {
      const res = await fetch(`/api/games/${gameId}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() || undefined }),
      })

      if (!res.ok) {
        const err = await readJson<{ error?: unknown }>(res)
        throw new Error(
          typeof err.error === "string"
            ? err.error
            : "Nepavyko nukopijuoti veiklos"
        )
      }

      const data = (await res.json()) as { game_id: string; partial?: boolean; error?: string }

      // 207 is "ok" for fetch, but it is not a full copy.
      if (res.status === 207 || data.partial) {
        setPartial({
          gameId: data.game_id,
          message: typeof data.error === "string" ? data.error : "Veikla nukopijuota ne visa. Patikrinkite kopiją.",
        })
        router.refresh()
        return
      }

      toast({ title: "Veikla nukopijuota" })

      onOpenChange(false)
      router.push(`/games/${data.game_id}`)
      router.refresh()
    } catch (error: unknown) {
      toast({
        title: "Klaida",
        description:
          error instanceof Error
            ? error.message
            : "Nepavyko nukopijuoti veiklos",
        variant: "destructive",
      })
    } finally {
      setDuplicating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5 text-primary-ink" />
            Kopijuoti veiklą
          </DialogTitle>
          <DialogDescription>
            Bus nukopijuoti visi nustatymai ir užduotys su atsakymais. Komandos
            ir rezultatai nebus kopijuojami.
          </DialogDescription>
        </DialogHeader>

        {partial ? (
          <>
            <div role="alert" className="rounded-lg border border-accent/40 bg-accent/5 p-3 text-sm text-steam-dark">
              <p className="flex items-center gap-2 font-medium text-accent-ink">
                <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                Veikla nukopijuota ne visa
              </p>
              <p className="mt-1">{partial.message}</p>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setPartial(null)
                  onOpenChange(false)
                }}
              >
                Uždaryti
              </Button>
              <Button
                onClick={() => {
                  const id = partial.gameId
                  setPartial(null)
                  onOpenChange(false)
                  router.push(`/games/${id}`)
                }}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                Atidaryti kopiją
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="space-y-2 py-2">
              <Label htmlFor="duplicate-title">Naujos veiklos pavadinimas</Label>
              <Input
                id="duplicate-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Įveskite pavadinimą"
                disabled={duplicating}
              />
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={duplicating}
              >
                Atšaukti
              </Button>
              <Button
                onClick={handleDuplicate}
                disabled={duplicating || title.trim().length < 3}
                className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
              >
                {duplicating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {duplicating ? "Kopijuojama..." : "Kopijuoti"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
