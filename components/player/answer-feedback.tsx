"use client"

/**
 * What a team sees after sending an answer, shared by the linear task and
 * the free-mode sheet. Four states that must not look alike:
 * correct (green, earned), try again (neutral, calm), already solved
 * (blue, information) and "not accepted" such as time over or no
 * connection (yellow, wait). None of them is a red error screen.
 */

import { useEffect, useRef } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { BookOpen, Check, CheckCheck, ChevronRight, Clock, CloudOff, Loader2, RotateCcw, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PRIMARY_BUTTON } from "@/components/player/play-ui"

/** A reply that is not a checked answer: refused, too many tries, no network. */
export interface AnswerNotice {
  /** "wait": time, pause, limits. "connection": the request did not get through. */
  kind: "wait" | "connection"
  title: string
  text: string
}

/** "Pateikti atsakymą"; shows progress and cannot be pressed twice while sending. */
export function SubmitAnswerButton({ loading, disabled }: { loading: boolean; disabled: boolean }) {
  return (
    <Button type="submit" disabled={loading || disabled} aria-busy={loading} className={PRIMARY_BUTTON}>
      {loading ? (
        <>
          <Loader2 className="motion-safe:animate-spin" aria-hidden="true" />
          Tikrinama...
        </>
      ) : (
        <>
          <Send aria-hidden="true" />
          Pateikti atsakymą
        </>
      )}
    </Button>
  )
}

/**
 * A wrong answer: said plainly and calmly, with what to do next. Mounted
 * anew for each attempt (the caller keys it), so a screen reader hears it
 * every time.
 */
export function TryAgainNote({ message, hintsLeft }: { message: string; hintsLeft: boolean }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-xl border border-border bg-muted p-3 text-left">
      <RotateCcw className="mt-0.5 h-5 w-5 shrink-0 text-foreground" aria-hidden="true" />
      <div className="min-w-0">
        <p className="font-bold text-foreground">{message}</p>
        <p className="text-sm text-muted-foreground">
          {hintsLeft
            ? "Pataisykite atsakymą arba atverkite užuominą."
            : "Perskaitykite sąlygą dar kartą ir pataisykite atsakymą."}
        </p>
      </div>
    </div>
  )
}

/** The answer was not checked (time over, pause, too many tries, no network). */
export function AnswerNoticeNote({ notice }: { notice: AnswerNotice }) {
  const Icon = notice.kind === "wait" ? Clock : CloudOff
  return (
    <div role="alert" className="flex items-start gap-3 rounded-xl border border-highlight bg-highlight/20 p-3 text-left">
      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-foreground" aria-hidden="true" />
      <div className="min-w-0">
        <p className="font-bold text-foreground">{notice.title}</p>
        <p className="text-sm text-foreground">{notice.text}</p>
      </div>
    </div>
  )
}

/**
 * A correct answer: the check mark pops, the server's message
 * ("Teisingai! +100 taškų"), the explanation when the task has one, then
 * one action. Without an explanation there is nothing to read, so the next
 * step also happens by itself after `autoAdvanceMs` (the bar under the
 * button shows the wait); with reduced motion the bar is not drawn.
 */
export function CorrectResult({
  message,
  alreadySolved = false,
  explanation,
  nextLabel,
  onNext,
  autoAdvanceMs,
}: {
  message: string
  /** Solved before (another device of the team): information, not a win. */
  alreadySolved?: boolean
  explanation?: string | null
  nextLabel: string
  onNext: () => void
  autoAdvanceMs?: number
}) {
  const reduce = useReducedMotion()
  const nextRef = useRef<HTMLButtonElement>(null)
  const onNextRef = useRef(onNext)
  useEffect(() => {
    onNextRef.current = onNext
  }, [onNext])

  // The form is gone: put the keyboard on the one action left.
  useEffect(() => {
    nextRef.current?.focus({ preventScroll: true })
  }, [])

  useEffect(() => {
    if (!autoAdvanceMs) return
    const timer = setTimeout(() => onNextRef.current(), autoAdvanceMs)
    return () => clearTimeout(timer)
  }, [autoAdvanceMs])

  return (
    <div className="space-y-3">
      <div
        className={`rounded-2xl border-2 p-5 text-center ${
          alreadySolved ? "border-secondary bg-secondary/10" : "border-primary bg-primary/10"
        }`}
      >
        <motion.div
          initial={reduce ? false : { scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 14 }}
          className={`mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full ${
            alreadySolved ? "bg-secondary-ink" : "bg-primary"
          }`}
        >
          {alreadySolved ? (
            <CheckCheck className="h-8 w-8 text-white" strokeWidth={3} aria-hidden="true" />
          ) : (
            <Check className="h-8 w-8 text-primary-foreground" strokeWidth={3} aria-hidden="true" />
          )}
        </motion.div>
        <p role="alert" className="text-xl font-bold text-foreground">
          {message}
        </p>
      </div>

      {explanation && (
        <div className="rounded-2xl border border-border bg-white p-4 text-left">
          <p className="mb-1 flex items-center gap-2 font-bold text-foreground">
            <BookOpen className="h-5 w-5 shrink-0" aria-hidden="true" />
            Ar žinojote?
          </p>
          <p className="text-base leading-relaxed text-foreground">{explanation}</p>
        </div>
      )}

      <div>
        <Button ref={nextRef} type="button" onClick={onNext} className={PRIMARY_BUTTON}>
          {nextLabel}
          <ChevronRight aria-hidden="true" />
        </Button>
        {autoAdvanceMs && !reduce ? (
          <span aria-hidden="true" className="mx-6 mt-2 block h-1 overflow-hidden rounded-full bg-foreground/10">
            <motion.span
              initial={{ scaleX: 1 }}
              animate={{ scaleX: 0 }}
              transition={{ duration: autoAdvanceMs / 1000, ease: "linear" }}
              className="block h-full origin-left rounded-full bg-foreground/40"
            />
          </span>
        ) : null}
      </div>
    </div>
  )
}
