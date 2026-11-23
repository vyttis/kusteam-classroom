"use client"

import { useEffect, useRef, type FormEvent } from "react"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import { Card, CardContent } from "@/components/ui/card"
import { AnswerInput } from "@/components/player/answer-input"
import {
  AnswerNoticeNote,
  CorrectResult,
  SubmitAnswerButton,
  TryAgainNote,
  type AnswerNotice,
} from "@/components/player/answer-feedback"
import { TaskImage } from "@/components/player/task-image"
import { HintList } from "@/components/player/hint-list"
import { OptionButton } from "@/components/player/option-button"
import { Shake } from "@/components/player/play-ui"
import { MapsEmbed } from "@/components/shared/maps-embed"
import { calculatePoints } from "@/lib/game/scoring"
import { openedHintCount } from "@/lib/game/play-format"
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
  /** Correct, but the team had this task solved already (no new points). */
  already_solved?: boolean
}

/** How long a correct answer without an explanation stays before the next task. */
export const AUTO_ADVANCE_MS = 2500

/**
 * The current task in the linear path: text, picture, map, hints, the
 * answer form, and the result. A wrong answer shakes the field, keeps the
 * typed text selected for editing and says so calmly; a correct one
 * replaces the form with the confirmation and one "next" action.
 */
export function LinearTask({
  challenge,
  index,
  answer,
  onAnswerChange,
  loading,
  feedback,
  wrongAttempts,
  notice,
  explanation,
  lastTask,
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
  /** Wrong answers given to this page so far: each one shakes the field. */
  wrongAttempts: number
  /** The answer was not checked (time over, pause, no connection). */
  notice: AnswerNotice | null
  /** Shown after a correct answer, with "Toliau"; null while it is not. */
  explanation: string | null
  /** No unsolved task is left after this one. */
  lastTask: boolean
  onSubmit: (e: FormEvent) => void
  onRevealHint: (index: number) => Promise<boolean>
  onNext: () => void
}) {
  const reduce = useReducedMotion()
  // On a phone the result may sit below the fold: bring it into view, or
  // an answer looks like nothing happened.
  const feedbackRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (!feedback && !notice) return
    feedbackRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest" })
  }, [feedback, notice, explanation, reduce])

  // A wrong answer: back into the field with the text selected, so the
  // next keystroke replaces it and a small fix is one tap away.
  useEffect(() => {
    if (wrongAttempts === 0) return
    const input = inputRef.current
    if (!input) return
    input.focus({ preventScroll: true })
    input.select()
  }, [wrongAttempts])

  const correct = feedback?.is_correct === true
  const wrong = feedback !== null && !feedback.is_correct
  const opened = openedHintCount(challenge)
  const worth = calculatePoints(challenge.points, opened, challenge.hint_penalty)
  const hintsLeft = (challenge.hints ?? []).some((hint) => hint === null)
  const slide = reduce ? { duration: 0 } : { duration: 0.2, ease: "easeOut" as const }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={challenge.id}
        initial={reduce ? false : { opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        exit={reduce ? { opacity: 1 } : { opacity: 0, x: -16 }}
        transition={slide}
      >
        <Card className="mb-4 rounded-2xl border-border bg-white shadow-none">
          <CardContent className="p-5">
            <div className="mb-4 flex items-start gap-3">
              <div
                aria-hidden="true"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-foreground text-lg font-bold text-background"
              >
                {index + 1}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="break-words text-xl font-bold leading-tight text-foreground">{challenge.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {worth} {pluralizeLt(worth, "taškas", "taškai", "taškų")}
                  {worth < challenge.points ? ` (be užuominų ${challenge.points})` : ""}
                </p>
              </div>
            </div>

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
            <HintList
              key={challenge.id}
              hints={challenge.hints ?? []}
              penalty={challenge.hint_penalty}
              points={challenge.points}
              solved={correct}
              onReveal={onRevealHint}
            />

            {!correct && (
              <form onSubmit={onSubmit} className="space-y-3" aria-label="Atsakymo forma">
                <Shake trigger={wrongAttempts}>
                  {challenge.type === "multiple_choice" && challenge.options ? (
                    <div role="group" aria-label="Atsakymo variantai" className="space-y-2">
                      {(challenge.options as string[]).map((option, i) => (
                        <OptionButton
                          key={i}
                          option={option}
                          index={i}
                          chosen={answer === option}
                          wrong={wrong}
                          disabled={loading}
                          onChoose={onAnswerChange}
                        />
                      ))}
                    </div>
                  ) : (
                    <AnswerInput
                      type={challenge.type}
                      value={answer}
                      onChange={onAnswerChange}
                      busy={loading}
                      invalid={wrong}
                      inputRef={inputRef}
                    />
                  )}
                </Shake>

                <div ref={feedbackRef} className="scroll-mb-24 space-y-3 empty:hidden">
                  {wrong && !notice && (
                    <TryAgainNote key={wrongAttempts} message={feedback.message} hintsLeft={hintsLeft} />
                  )}
                  {notice && <AnswerNoticeNote notice={notice} />}
                </div>

                <SubmitAnswerButton loading={loading} disabled={!answer.trim()} />
              </form>
            )}

            {correct && (
              <div ref={feedbackRef} className="scroll-mb-24">
                <CorrectResult
                  message={feedback.message}
                  alreadySolved={feedback.already_solved === true}
                  explanation={explanation}
                  nextLabel={lastTask ? "Rodyti rezultatus" : "Kita užduotis"}
                  onNext={onNext}
                  autoAdvanceMs={explanation ? undefined : AUTO_ADVANCE_MS}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </AnimatePresence>
  )
}
