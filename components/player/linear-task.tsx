"use client"

import { useEffect, useRef, type FormEvent } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { BookOpen, CheckCircle2, ChevronRight, Loader2, Send, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AnswerInput } from "@/components/player/answer-input"
import { TaskImage } from "@/components/player/task-image"
import { HintList } from "@/components/player/hint-list"
import { OptionButton } from "@/components/player/option-button"
import { MapsEmbed } from "@/components/shared/maps-embed"
import { pluralizeLt } from "@/lib/utils"
import type { ChallengeType, SubmissionResult } from "@/types/game"

/** A task as the participant page receives it (no answer data). */
export interface PlayerChallenge {
  id: string
  title: string
  description: string | null
  type: ChallengeType
  points: number
  // null: a hint the team has not opened yet (its text comes from /api/play/hint)
  hints: (string | null)[]
  options: string[] | null
  order_index: number
  image_url: string | null
  maps_url: string | null
  hint_penalty: number
  prerequisites: string[]
}

export interface ExtendedSubmissionResult extends SubmissionResult {
  explanation?: string | null
}

/**
 * The current task in the linear path: text, picture, map, hints, the
 * answer form, and the result with an explanation after a correct answer.
 */
export function LinearTask({
  challenge,
  index,
  answer,
  onAnswerChange,
  loading,
  feedback,
  explanation,
  onSubmit,
  onRevealHint,
  onNext,
}: {
  challenge: PlayerChallenge
  index: number
  answer: string
  onAnswerChange: (value: string) => void
  loading: boolean
  feedback: ExtendedSubmissionResult | null
  /** Shown after a correct answer, with "Toliau"; null while it is not. */
  explanation: string | null
  onSubmit: (e: FormEvent) => void
  onRevealHint: (index: number) => Promise<boolean>
  onNext: () => void
}) {
  // On a phone the result sits below the answer button, out of sight: bring
  // it into view, or a wrong answer looks like nothing happened.
  const feedbackRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!feedback) return
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    feedbackRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest" })
  }, [feedback, explanation])

  const wrong = feedback !== null && !feedback.is_correct

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={challenge.id}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
      >
        <Card className="border-border/50 bg-white shadow-lg mb-4">
          <CardContent className="p-5">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-lg font-bold text-primary-ink shrink-0">
                {index + 1}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-bold text-steam-dark leading-tight break-words">
                  {challenge.title}
                </h2>
                <Badge variant="outline" className="text-xs mt-1">
                  {challenge.points}{" "}
                  {pluralizeLt(challenge.points, "taškas", "taškai", "taškų")}
                </Badge>
              </div>
            </div>

            {challenge.description && (
              <div className="bg-muted/30 rounded-lg p-4 mb-4 text-sm text-steam-dark leading-relaxed">
                {challenge.description}
              </div>
            )}

            {challenge.image_url && (
              <TaskImage src={challenge.image_url} title={challenge.title} />
            )}

            {challenge.maps_url && (
              <div className="mb-4">
                <MapsEmbed url={challenge.maps_url} className="rounded-xl overflow-hidden" />
              </div>
            )}

            {/* Hints: the text arrives when the team opens one */}
            <HintList
              key={challenge.id}
              hints={challenge.hints ?? []}
              penalty={challenge.hint_penalty}
              points={challenge.points}
              solved={feedback?.is_correct === true}
              onReveal={onRevealHint}
            />

            {!feedback?.is_correct && (
            <form onSubmit={onSubmit} className="space-y-3" aria-label="Atsakymo forma">
              {challenge.type === "multiple_choice" && challenge.options ? (
                <div className="space-y-2">
                  {(challenge.options as string[]).map((option, i) => (
                    <OptionButton
                      key={i}
                      option={option}
                      index={i}
                      chosen={answer === option}
                      wrong={wrong}
                      onChoose={onAnswerChange}
                    />
                  ))}
                </div>
              ) : (
                <AnswerInput type={challenge.type} value={answer} onChange={onAnswerChange} />
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

            <AnimatePresence>
              {feedback && (
                <motion.div
                  ref={feedbackRef}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-4 space-y-3 scroll-mb-4"
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
                      <p className={`font-medium ${feedback.is_correct ? "text-primary-ink" : "text-accent-ink"}`}>
                        {feedback.message}
                      </p>
                      {feedback.is_correct && !explanation && (
                        <p className="text-sm text-muted-foreground mt-0.5">
                          Pereinama prie kitos užduoties...
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Explanation after correct answer */}
                  {explanation && (
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
                          {explanation}
                        </p>
                      </div>
                      <Button
                        onClick={onNext}
                        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
                      >
                        Toliau
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </motion.div>
    </AnimatePresence>
  )
}
