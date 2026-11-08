"use client"

import { useState } from "react"
import { AnswerInput } from "@/components/player/answer-input"
import { TaskImage } from "@/components/player/task-image"
import { motion, AnimatePresence } from "framer-motion"
import {
  Send,
  Loader2,
  CheckCircle2,
  XCircle,
  BookOpen,
  ArrowLeft,
} from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MapsEmbed } from "@/components/shared/maps-embed"
import { HintList } from "@/components/player/hint-list"
import { OptionButton } from "@/components/player/option-button"

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
  onSubmit: (
    answer: string,
    hintsUsed: number
  ) => Promise<{
    is_correct: boolean
    points_awarded: number
    message: string
    explanation?: string | null
  }>
  isSolved: boolean
  // Opens a hint (0-based index): the parent records it server-side for the
  // penalty and stores the returned text on the task. false when it failed.
  onRevealHint: (hintIndex: number) => Promise<boolean>
}

export function ChallengeDetailModal({
  challenge,
  open,
  onOpenChange,
  onSubmit,
  isSolved,
  onRevealHint,
}: ChallengeDetailModalProps) {
  const [answer, setAnswer] = useState("")
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState<{
    is_correct: boolean
    points_awarded: number
    message: string
    explanation?: string | null
  } | null>(null)
  const [showExplanation, setShowExplanation] = useState(false)

  function handleClose() {
    // Reset state when closing
    setAnswer("")
    setFeedback(null)
    setShowExplanation(false)
    onOpenChange(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // Close the phone keyboard so the result below the button is visible.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    if (!answer.trim() || !challenge || isSolved) return

    setLoading(true)
    setFeedback(null)

    try {
      const opened = (challenge.hints ?? []).filter((hint) => hint !== null).length
      const result = await onSubmit(answer.trim(), opened)
      setFeedback(result)

      if (result.is_correct) {
        setAnswer("")
        if (result.explanation) {
          setShowExplanation(true)
        }
      }
    } catch {
      setFeedback({ is_correct: false, points_awarded: 0, message: "Tinklo klaida. Bandykite dar kartą." })
    } finally {
      setLoading(false)
    }
  }

  if (!challenge) return null


  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent
        side="bottom"
        className="max-h-[90vh] overflow-y-auto rounded-t-2xl px-4 pb-8 pt-6 sm:px-6"
      >
        <SheetHeader className="mb-4">
          {/* pr-8 keeps the points badge clear of Radix's absolute top-right
              close button — otherwise the badge sits underneath it and taps
              on it close the sheet */}
          <div className="flex items-center gap-3 pr-8">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="shrink-0 -ml-2"
              aria-label="Grįžti"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-lg font-bold text-steam-dark text-left truncate">
                {challenge.title}
              </SheetTitle>
              <SheetDescription className="sr-only">
                Užduoties detalės
              </SheetDescription>
            </div>
            <Badge
              variant="outline"
              className="shrink-0 bg-highlight/10 text-steam-dark border-highlight/30 font-bold text-xs"
            >
              {challenge.points} tšk.
            </Badge>
          </div>
        </SheetHeader>

        {/* Solved indicator */}
        {isSolved && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-3 rounded-lg bg-primary/10 border border-primary/20 flex items-center gap-2"
          >
            <CheckCircle2 className="h-5 w-5 text-primary-ink shrink-0" />
            <p className="text-sm font-medium text-primary-ink">
              Ši užduotis jau išspręsta
            </p>
          </motion.div>
        )}

        {/* Description */}
        {challenge.description && (
          <div className="bg-muted rounded-lg p-4 mb-4 text-sm text-steam-dark leading-relaxed">
            {challenge.description}
          </div>
        )}

        {/* Image */}
        {challenge.image_url && <TaskImage src={challenge.image_url} title={challenge.title} />}

        {/* Google Maps */}
        {challenge.maps_url && (
          <div className="mb-4">
            <MapsEmbed
              url={challenge.maps_url}
              className="rounded-xl overflow-hidden"
            />
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

        {/* Answer form */}
        {!isSolved && (
          <form onSubmit={handleSubmit} className="space-y-3" aria-label="Atsakymo forma">
            {challenge.type === "multiple_choice" && challenge.options ? (
              <div className="space-y-2">
                {challenge.options.map((option, i) => (
                  <OptionButton
                    key={i}
                    option={option}
                    index={i}
                    chosen={answer === option}
                    wrong={feedback !== null && !feedback.is_correct}
                    disabled={loading}
                    onChoose={setAnswer}
                  />
                ))}
              </div>
            ) : (
              <AnswerInput type={challenge.type} value={answer} onChange={setAnswer} disabled={loading} />
            )}

            <Button
              type="submit"
              disabled={loading || !answer.trim()}
              className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg shadow-primary/25 gap-2"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Pateikti atsakymą
                </>
              )}
            </Button>
          </form>
        )}

        {/* Feedback */}
        <AnimatePresence>
          {feedback && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-4 space-y-3"
              role="alert"
              aria-live="assertive"
            >
              <div
                className={`p-4 rounded-lg flex items-center gap-3 ${
                  feedback.is_correct
                    ? "bg-primary/10 border border-primary/20"
                    : "bg-accent/5 border border-accent/20"
                }`}
              >
                {feedback.is_correct ? (
                  <CheckCircle2 className="h-6 w-6 text-primary-ink shrink-0" />
                ) : (
                  <XCircle className="h-6 w-6 text-accent-ink shrink-0" />
                )}
                <div>
                  <p
                    className={`font-medium ${
                      feedback.is_correct
                        ? "text-primary-ink"
                        : "text-accent-ink"
                    }`}
                  >
                    {feedback.message}
                  </p>
                </div>
              </div>

              {/* Explanation after correct answer */}
              {showExplanation && feedback.explanation && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-3"
                >
                  <div className="p-4 rounded-lg bg-secondary/5 border border-secondary/20">
                    <div className="flex items-center gap-2 mb-2">
                      <BookOpen className="h-4 w-4 text-secondary-ink" />
                      <p className="text-sm font-semibold text-secondary-ink">
                        Ar žinojote?
                      </p>
                    </div>
                    <p className="text-sm text-steam-dark/80 leading-relaxed">
                      {feedback.explanation}
                    </p>
                  </div>
                  <Button
                    onClick={handleClose}
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
                  >
                    Grįžti
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                </motion.div>
              )}

              {/* Close button after correct answer without explanation */}
              {feedback.is_correct && !feedback.explanation && (
                <Button
                  onClick={handleClose}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
                >
                  Grįžti
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </SheetContent>
    </Sheet>
  )
}
