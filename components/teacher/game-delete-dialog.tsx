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
import { Checkbox } from "@/components/ui/checkbox"
import Link from "next/link"
import { readJson } from "@/lib/http/read-json"
import { useToast } from "@/hooks/use-toast"
import { AlertCircle, Loader2 } from "lucide-react"

interface GameDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  gameId: string
  gameTitle: string
  /**
   * The activity has been run: deleting it also deletes what participants
   * did (teams, answers, reflections), so the dialog says so plainly, points
   * to the CSV export and asks for an explicit confirmation.
   */
  finished?: boolean
  onSuccess?: () => void
}

export function GameDeleteDialog({
  open,
  onOpenChange,
  gameId,
  gameTitle,
  finished = false,
  onSuccess,
}: GameDeleteDialogProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [deleting, setDeleting] = useState(false)
  const [understood, setUnderstood] = useState(false)

  // Every way of closing forgets the confirmation: the next opening asks again.
  function setOpen(next: boolean) {
    if (!next) setUnderstood(false)
    onOpenChange(next)
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch(`/api/games/${gameId}`, {
        method: "DELETE",
      })

      if (!res.ok) {
        const err = await readJson<{ error?: unknown }>(res)
        throw new Error(typeof err.error === "string" ? err.error : "Nepavyko ištrinti veiklos")
      }

      toast({ title: "Veikla ištrinta" })

      if (onSuccess) {
        onSuccess()
      } else {
        router.push("/dashboard")
      }
    } catch (error: unknown) {
      toast({
        title: "Klaida",
        description: error instanceof Error ? error.message : "Nepavyko ištrinti veiklos",
        variant: "destructive",
      })
    } finally {
      setDeleting(false)
      setOpen(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-accent-ink" aria-hidden="true" />
            {finished ? "Ištrinti baigtą veiklą?" : "Ištrinti veiklą?"}
          </DialogTitle>
          <DialogDescription>
            {finished
              ? `Veikla „${gameTitle}“ jau įvyko. Kartu su ja visam laikui bus ištrintos užduotys, visos komandos, jų atsakymai, rezultatai ir refleksijos. Ištrintų duomenų atkurti nebus galima.`
              : `Ar tikrai norite ištrinti veiklą „${gameTitle}“? Bus ištrintos visos užduotys, komandos ir jų atsakymai. Šio veiksmo atšaukti negalima.`}
          </DialogDescription>
        </DialogHeader>
        {finished && (
          <div className="space-y-3 text-sm text-steam-dark">
            <p className="rounded-lg border border-highlight/40 bg-highlight/10 p-3">
              Jei rezultatų dar gali prireikti, pirmiausia atsisiųskite juos: veiklos puslapyje ir{" "}
              <Link href={`/games/${gameId}/analytics`} className="font-medium underline underline-offset-2">
                analitikoje
              </Link>{" "}
              spauskite „Eksportuoti CSV“.
            </p>
            <div className="flex items-start gap-2">
              <Checkbox
                id={`delete-understood-${gameId}`}
                checked={understood}
                onCheckedChange={(checked) => setUnderstood(checked === true)}
                className="mt-0.5"
              />
              <label htmlFor={`delete-understood-${gameId}`} className="cursor-pointer font-medium">
                Suprantu, kad komandos, atsakymai ir refleksijos bus ištrinti visam laikui
              </label>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={deleting}
          >
            Atšaukti
          </Button>
          <Button
            onClick={handleDelete}
            disabled={deleting || (finished && !understood)}
            className="bg-accent-ink hover:bg-accent-ink/90 text-white gap-2"
          >
            {deleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            {deleting ? "Trinama..." : finished ? "Ištrinti visam laikui" : "Ištrinti"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
