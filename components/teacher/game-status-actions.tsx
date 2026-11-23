"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { GameStatus } from "@/types/game"
import { Checkbox } from "@/components/ui/checkbox"
import { aiVerdictLabel, type AiTaskToReview } from "@/lib/game/ai-review"
import {
  Play,
  Pause,
  Square,
  Loader2,
  AlertCircle,
  AlertTriangle,
  Rocket,
  Wrench,
  Sparkles,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

interface GameStatusActionsProps {
  gameId: string
  status: GameStatus
  challengeCount: number
  // Duplicated/cloned tasks that still need a confirmed answer — blocks start
  tasksNeedingAnswer?: { id: string; title: string }[]
  // DI-made tasks whose answer the facilitator has not confirmed (see
  // components/teacher/ai-review.ts): the start asks about them explicitly.
  aiTasksToReview?: AiTaskToReview[]
  // In the builder a task opens in the editor on the same page; elsewhere
  // the dialog links to the builder.
  onOpenTask?: (taskId: string) => void
  /**
   * "page" on the activity page, "bar" in the class screen's dark control
   * bar. In both, "Baigti veiklą" is set apart from pause and resume: it
   * comes last in the row, behind a divider, and is the quieter button.
   */
  variant?: "page" | "bar"
}

export function GameStatusActions({
  gameId,
  status,
  challengeCount,
  tasksNeedingAnswer = [],
  aiTasksToReview = [],
  onOpenTask,
  variant = "page",
}: GameStatusActionsProps) {
  const bar = variant === "bar"
  const [loading, setLoading] = useState(false)
  const [showActivateDialog, setShowActivateDialog] = useState(false)
  const [showFinishDialog, setShowFinishDialog] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  const hasPendingAnswers = tasksNeedingAnswer.length > 0
  // The server's list wins when it refused the start: this page may have
  // been loaded before a DI task was added in another tab.
  const [serverAiTasks, setServerAiTasks] = useState<AiTaskToReview[] | null>(null)
  const [aiReviewed, setAiReviewed] = useState(false)
  const aiTasks = serverAiTasks ?? aiTasksToReview
  const needsAiReview = aiTasks.length > 0

  async function updateStatus(newStatus: GameStatus) {
    setLoading(true)
    try {
      const res = await fetch(`/api/games/${gameId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          newStatus === "active" && status === "draft" && needsAiReview && aiReviewed
            ? { status: newStatus, ai_reviewed: true }
            : { status: newStatus }
        ),
      })

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as {
          error?: string
          code?: string
          ai_tasks_to_review?: AiTaskToReview[]
        }
        // The start dialog stays open and now lists the tasks to confirm.
        if (err.code === "ai_review_required" && Array.isArray(err.ai_tasks_to_review)) {
          setServerAiTasks(err.ai_tasks_to_review)
          setAiReviewed(false)
        }
        // Another device already changed the status: show the current one.
        if (res.status === 409) router.refresh()
        throw new Error(err.error || "Nepavyko atnaujinti būsenos")
      }

      toast({
        title:
          newStatus === "active"
            ? "Veikla pradėta!"
            : newStatus === "finished"
            ? "Veikla baigta"
            : "Veikla pristabdyta",
        description:
          newStatus === "active"
            ? "Dalyviai gali prisijungti nuskaitę QR kodą."
            : newStatus === "finished"
            ? "Rezultatai ir analitika paruošti peržiūrai."
            : "Dalyviai matys pauzės pranešimą.",
      })

      setShowActivateDialog(false)
      setShowFinishDialog(false)
      router.refresh()
    } catch (error: unknown) {
      toast({
        title: "Klaida",
        description: error instanceof Error ? error.message : "Nepavyko atnaujinti būsenos",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // The wrapper is laid out by the parent's flex row (the status buttons use
  // `display: contents`), so `order-last` moves the destructive action to
  // the end of the whole row, away from pause and resume.
  const finishDialog = (
    <span
      className={`order-last flex items-center sm:border-l sm:pl-3 ${bar ? "ml-auto border-white/20" : "border-border sm:ml-1"}`}
    >
    <Dialog open={showFinishDialog} onOpenChange={setShowFinishDialog}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          disabled={loading}
          className={
            bar
              ? "h-11 gap-2 rounded-full px-4 text-white/80 hover:bg-accent hover:text-white focus-visible:ring-highlight focus-visible:ring-offset-0"
              : "h-11 gap-2 rounded-full px-4 text-foreground hover:bg-accent/10 hover:text-foreground"
          }
        >
          <Square className={bar ? "h-4 w-4" : "h-4 w-4 text-accent-ink"} aria-hidden="true" />
          {status === "paused" ? "Baigti" : "Baigti veiklą"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Baigti veiklą?</DialogTitle>
          <DialogDescription>
            Dalyviai nebegalės pateikti atsakymų, o jūs matysite rezultatų
            suvestinę. Šio veiksmo negalima atšaukti.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowFinishDialog(false)}>
            Atšaukti
          </Button>
          <Button
            onClick={() => updateStatus("finished")}
            disabled={loading}
            className="bg-accent-ink hover:bg-accent-ink/90 text-white gap-2"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Square className="h-4 w-4" />
            )}
            Baigti veiklą
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </span>
  )

  if (status === "draft") {
    return (
      <Dialog
        open={showActivateDialog}
        onOpenChange={(open) => {
          setShowActivateDialog(open)
          // Each opening asks again: tasks may have changed meanwhile.
          if (!open) {
            setAiReviewed(false)
            setServerAiTasks(null)
          }
        }}
      >
        <DialogTrigger asChild>
          <Button
            className="h-12 gap-2 rounded-full bg-primary px-6 text-base font-bold text-primary-foreground hover:bg-primary/90"
            disabled={challengeCount === 0}
          >
            <Rocket className="h-5 w-5" aria-hidden="true" />
            Pradėti veiklą
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pradėti veiklą?</DialogTitle>
            <DialogDescription>
              Dalyviai galės prisijungti nuskaitę QR kodą arba įvedę veiklos
              kodą. Galėsite bet kada pristabdyti ar baigti veiklą.
            </DialogDescription>
          </DialogHeader>
          {challengeCount === 0 && (
            <div className="flex items-center gap-2 text-accent-ink text-sm">
              <AlertCircle className="h-4 w-4" />
              Pridėkite bent 1 užduotį prieš pradėdami
            </div>
          )}
          {hasPendingAnswers && (
            <div className="rounded-lg border border-accent/30 bg-accent/5 p-3 space-y-2">
              <div className="flex items-center gap-2 text-accent-ink text-sm font-medium">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Šios užduotys neturi nustatyto atsakymo:
              </div>
              <ul className="text-sm text-steam-dark list-disc pl-6 space-y-0.5">
                {tasksNeedingAnswer.map((t) => (
                  <li key={t.id}>{t.title}</li>
                ))}
              </ul>
              <Link href={`/games/${gameId}/builder`}>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 mt-1 border-accent/30 text-accent-ink hover:bg-accent/5"
                >
                  <Wrench className="h-3.5 w-3.5" />
                  Taisyti užduotis
                </Button>
              </Link>
            </div>
          )}
          {needsAiReview && (
            <div className="rounded-lg border border-highlight/40 bg-highlight/10 p-3 space-y-2">
              <div className="flex items-center gap-2 text-steam-dark text-sm font-medium">
                <Sparkles className="h-4 w-4 shrink-0 text-highlight-ink" aria-hidden="true" />
                Šių DI sukurtų užduočių atsakymų dar nepatvirtinote:
              </div>
              <ul className="max-h-40 overflow-y-auto text-sm text-steam-dark list-disc pl-6 space-y-1">
                {aiTasks.map((t) => (
                  <li key={t.id}>
                    {onOpenTask ? (
                      <button
                        type="button"
                        className="text-left font-medium underline underline-offset-2 hover:text-primary-ink"
                        onClick={() => {
                          setShowActivateDialog(false)
                          setAiReviewed(false)
                          setServerAiTasks(null)
                          onOpenTask(t.id)
                        }}
                      >
                        {t.title}
                      </button>
                    ) : (
                      <Link
                        href={`/games/${gameId}/builder?task=${t.id}`}
                        className="font-medium underline underline-offset-2 hover:text-primary-ink"
                      >
                        {t.title}
                      </Link>
                    )}
                    <span className="block text-xs text-muted-foreground">{aiVerdictLabel(t.verdict)}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                DI tik siūlo: teisingą atsakymą tvirtinate jūs. Atidarykite užduotį, patikrinkite atsakymą ir
                išsaugokite, tada ji iš šio sąrašo dings.
              </p>
              <div className="flex items-start gap-2 pt-1">
                <Checkbox
                  id="ai-reviewed"
                  checked={aiReviewed}
                  onCheckedChange={(checked) => setAiReviewed(checked === true)}
                  className="mt-0.5"
                />
                <label htmlFor="ai-reviewed" className="text-sm font-medium text-steam-dark cursor-pointer">
                  Peržiūrėjau šių užduočių atsakymus ir patvirtinu, kad jie teisingi
                </label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowActivateDialog(false)}
            >
              Atšaukti
            </Button>
            <Button
              onClick={() => updateStatus("active")}
              disabled={
                loading || challengeCount === 0 || hasPendingAnswers || (needsAiReview && !aiReviewed)
              }
              className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Pradėti
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  if (status === "active") {
    return (
      <div className="contents">
        <Button
          variant="outline"
          onClick={() => updateStatus("paused")}
          disabled={loading}
          className={
            bar
              ? "h-11 gap-2 rounded-full border-transparent bg-white px-5 text-base font-bold text-steam-dark hover:bg-white/90 hover:text-steam-dark focus-visible:ring-highlight focus-visible:ring-offset-0"
              : "h-11 gap-2 rounded-full px-5"
          }
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Pause className="h-4 w-4" />
          )}
          Pristabdyti
        </Button>
        {finishDialog}
      </div>
    )
  }

  if (status === "paused") {
    return (
      <div className="contents">
        <Button
          onClick={() => updateStatus("active")}
          disabled={loading}
          className={
            bar
              ? "h-11 gap-2 rounded-full bg-highlight px-5 text-base font-bold text-highlight-foreground hover:bg-highlight/90 focus-visible:ring-white focus-visible:ring-offset-0"
              : "h-11 gap-2 rounded-full bg-primary px-5 font-bold text-primary-foreground hover:bg-primary/90"
          }
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          Tęsti
        </Button>
        {finishDialog}
      </div>
    )
  }

  // finished: on the class screen the header already says so.
  if (bar) return null
  return (
    <Badge variant="outline" className="text-sm gap-1 py-1.5 px-3 bg-secondary/10 text-secondary-ink border-secondary/20">
      <Square className="h-3 w-3" aria-hidden="true" />
      Veikla baigta
    </Badge>
  )
}
