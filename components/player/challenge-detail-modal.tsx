"use client"

import { useEffect, useRef, useState } from "react"
import { CheckCheck } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { AnswerInput } from "@/components/player/answer-input"
import {
  AnswerNoticeNote,
  CorrectResult,
  SubmitAnswerButton,
  TryAgainNote,
  type AnswerNotice,
} from "@/components/player/answer-feedback"
import { TaskImage } from "@/components/player/task-image"
import { MapsEmbed } from "@/components/shared/maps-embed"
import { HintList } from "@/components/player/hint-list"
import { OptionButton } from "@/components/player/option-button"
import { Shake } from "@/components/player/play-ui"
import { calculatePoints } from "@/lib/game/scoring"
import { pluralizeLt } from "@/lib/utils"

interface FreeResult {
  is_correct: boolean
  points_awarded: number
  message: string
  explanation?: string | null
  already_solved?: boolean
  /** Set when the answer was not checked (time over, pause, no connection). */
  notice?: AnswerNotice["kind"]
}

interface ChallengeDetailModalProps {
  challenge: {
    id: string
    title: string
    description: string | null
    type: string
    points: number
    // null: not opened yet by this team
    hints: (string | null)[]
    options: string[] | null
    image_url: string | null
    maps_url: string | null
    hint_penalty: number
  } | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (answer: string, hintsUsed: number) => Promise<FreeResult>
  isSolved: boolean
  /** Every task is solved: closing the sheet leads to the results. */
  lastTask: boolean
  // Opens a hint (0-based index): the parent records it server-side for the
  // penalty and stores the returned text on the task. false when it failed.
  onRevealHint: (hintIndex: number) => Promise<boolean>
}

/**
 * One task of the free mode, in a sheet from the bottom. The same answer
 * flow as the linear task: a wrong answer shakes the field and keeps the
 * text, a correct one replaces the form with the confirmation and one
 * action that closes the sheet.
 */
export function ChallengeDetailModal({
  challenge,
  open,
  onOpenChange,
  onSubmit,
  isSolved,
  lastTask,
  onRevealHint,
}: ChallengeDetailModalProps) {
  const [answer, setAnswer] = useState("")
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState<FreeResult | null>(null)
  const [wrongAttempts, setWrongAttempts] = useState(0)
  const submittingRef = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // A wrong answer: back into the field with the text selected.
  useEffect(() => {
    if (wrongAttempts === 0) return
    inputRef.current?.focus({ preventScroll: true })
    inputRef.current?.select()
  }, [wrongAttempts])

  function handleClose() {
    // Reset state when closing
    setAnswer("")
    setFeedback(null)
    onOpenChange(false)
  }

  function changeAnswer(value: string) {
    setAnswer(value)
    setFeedback((current) => (current && !current.is_correct ? null : current))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submittingRef.current) return
    if (!answer.trim() || !challenge || isSolved) return

    submittingRef.current = true
    setLoading(true)
    setFeedback(null)

    try {
      const opened = (challenge.hints ?? []).filter((hint) => hint !== null).length
      const result = await onSubmit(answer.trim(), opened)
      setFeedback(result)

      if (result.is_correct) {
        // The form goes away: close the phone keyboard with it.
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
        setAnswer("")
      } else if (!result.notice) {
        setWrongAttempts((n) => n + 1)
      }
    } catch {
      setFeedback({
        is_correct: false,
        points_awarded: 0,
        message: "Nepavyko pateikti atsakymo. Patikrinkite interneto ryšį ir bandykite dar kartą.",
        notice: "connection",
      })
    } finally {
      submittingRef.current = false
      setLoading(false)
    }
  }

  if (!challenge) return null

  const correct = feedback?.is_correct === true
  const wrong = feedback !== null && !feedback.is_correct && !feedback.notice
  const notice: AnswerNotice | null =
    feedback && !feedback.is_correct && feedback.notice
      ? {
          kind: feedback.notice,
          title: feedback.notice === "wait" ? "Atsakymas nepriimtas" : "Nepavyko pateikti atsakymo",
          text: feedback.message,
        }
      : null
  const opened = (challenge.hints ?? []).filter((hint) => hint !== null).length
  const worth = calculatePoints(challenge.points, opened, challenge.hint_penalty)
  const hintsLeft = (challenge.hints ?? []).some((hint) => hint === null)

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent
        side="bottom"
        // The sheet's own close button, made 44 px for a thumb.
        className="max-h-[90vh] overflow-y-auto rounded-t-3xl px-4 pb-8 pt-6 supports-[max-height:90dvh]:max-h-[90dvh] sm:px-6 [&>button]:right-2 [&>button]:top-2 [&>button]:flex [&>button]:h-11 [&>button]:w-11 [&>button]:items-center [&>button]:justify-center [&>button]:rounded-full [&>button]:opacity-100 [&>button[data-state=open]]:bg-transparent [&>button>svg]:h-5 [&>button>svg]:w-5"
      >
        <div className="mx-auto max-w-lg">
          {/* pr-10 keeps the title clear of the sheet's own close button */}
          <SheetHeader className="mb-4 space-y-1 pr-10 text-left">
            <SheetTitle className="break-words text-xl font-bold leading-tight text-foreground">
              {challenge.title}
            </SheetTitle>
            <SheetDescription className="text-sm text-muted-foreground">
              {worth} {pluralizeLt(worth, "taškas", "taškai", "taškų")}
              {worth < challenge.points ? ` (be užuominų ${challenge.points})` : ""}
            </SheetDescription>
          </SheetHeader>

          {/* Solved before this visit: information, not a result */}
          {isSolved && !correct && (
            <div className="mb-4 flex items-center gap-3 rounded-xl border-2 border-secondary bg-secondary/10 p-3">
              <CheckCheck className="h-5 w-5 shrink-0 text-foreground" aria-hidden="true" />
              <p className="text-base font-bold text-foreground">Ši užduotis jau išspręsta</p>
            </div>
          )}

          {challenge.description && (
            <p className="mb-4 whitespace-pre-line break-words text-base leading-relaxed text-foreground">
              {challenge.description}
            </p>
          )}

          {challenge.image_url && <TaskImage src={challenge.image_url} title={challenge.title} />}

          {challenge.maps_url && (
            <div className="mb-4">
              <MapsEmbed url={challenge.maps_url} className="overflow-hidden rounded-xl" />
            </div>
          )}

          {/* Hints: the text arrives when the team opens one */}
          {!isSolved && (
            <HintList
              key={challenge.id}
              hints={challenge.hints ?? []}
              penalty={challenge.hint_penalty}
              points={challenge.points}
              onReveal={onRevealHint}
            />
          )}

          {!isSolved && !correct && (
            <form onSubmit={handleSubmit} className="space-y-3" aria-label="Atsakymo forma">
              <Shake trigger={wrongAttempts}>
                {challenge.type === "multiple_choice" && challenge.options ? (
                  <div role="group" aria-label="Atsakymo variantai" className="space-y-2">
                    {challenge.options.map((option, i) => (
                      <OptionButton
                        key={i}
                        option={option}
                        index={i}
                        chosen={answer === option}
                        wrong={wrong}
                        disabled={loading}
                        onChoose={changeAnswer}
                      />
                    ))}
                  </div>
                ) : (
                  <AnswerInput
                    type={challenge.type}
                    value={answer}
                    onChange={changeAnswer}
                    busy={loading}
                    invalid={wrong}
                    inputRef={inputRef}
                  />
                )}
              </Shake>

              {wrong && <TryAgainNote key={wrongAttempts} message={feedback.message} hintsLeft={hintsLeft} />}
              {notice && <AnswerNoticeNote notice={notice} />}

              <SubmitAnswerButton loading={loading} disabled={!answer.trim()} />
            </form>
          )}

          {correct && (
            <CorrectResult
              message={feedback.message}
              alreadySolved={feedback.already_solved === true}
              explanation={feedback.explanation}
              nextLabel={lastTask ? "Rodyti rezultatus" : "Grįžti į užduotis"}
              onNext={handleClose}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
