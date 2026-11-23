"use client"

import { useState, useEffect, useId } from "react"
import { Challenge, ChallengeType } from "@/types/game"
import { readJson } from "@/lib/http/read-json"
import { AiSuggestion } from "@/lib/ai/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { useLeaveWarning } from "@/hooks/use-leave-warning"
import { useSessionExpired } from "@/hooks/use-session-expired"
import { SessionExpiredNotice } from "@/components/teacher/session-expired-notice"
import {
  AlertCircle,
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  Plus,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react"
import { calculatePoints } from "@/lib/game/scoring"
import { cn } from "@/lib/utils"
import { ImageUpload } from "../image-upload"
import { MapsEmbed } from "@/components/shared/maps-embed"
import { ChallengePrerequisites } from "../challenge-prerequisites"
import { AcceptedAnswersField } from "./accepted-answers-field"
import { proposedAcceptedAnswers } from "./suggestion-payload"

interface ManualTaskEditorProps {
  gameId: string
  challenge?: Challenge | null
  prefillData?: AiSuggestion | null
  onSuccess: () => void
  onCancel: () => void
  // Free-mode prerequisites: which challenges must be solved first. Only shown
  // in free path mode when editing a saved challenge (needs a real id + the
  // full challenge list to build/validate the dependency graph).
  pathMode?: "linear" | "free"
  allChallenges?: Array<{
    id: string
    title: string
    order_index: number
    prerequisites?: string[]
  }>
}

interface TaskForm {
  title: string
  description: string
  type: ChallengeType
  pointsText: string
  correctAnswer: string
  // New extra accepted answers typed in this edit (the saved ones are hashes).
  acceptedAnswers: string[]
  removeAccepted: boolean
  hints: string[]
  options: string[]
  imageUrl: string | null
  mapsUrl: string
  explanation: string
  difficulty: "easy" | "medium" | "hard" | null
  hintPenalty: number
  prerequisites: string[]
}

function initialForm(challenge: Challenge | null, prefill: AiSuggestion | null): TaskForm {
  if (challenge) {
    return {
      title: challenge.title,
      description: challenge.description || "",
      type: challenge.type,
      pointsText: String(challenge.points),
      // The stored answer is only a hash: the field starts empty.
      correctAnswer: "",
      acceptedAnswers: [],
      removeAccepted: false,
      hints: challenge.hints || [],
      options: challenge.options || [],
      imageUrl: challenge.image_url,
      mapsUrl: challenge.maps_url || "",
      explanation: challenge.explanation || "",
      difficulty: challenge.difficulty,
      hintPenalty: challenge.hint_penalty,
      prerequisites: challenge.prerequisites || [],
    }
  }
  return {
    title: prefill?.title ?? "",
    description: prefill?.description ?? "",
    type: prefill?.type ?? "text",
    pointsText: String(prefill?.points ?? 100),
    correctAnswer: prefill?.correct_answer ?? "",
    // Spellings the DI proposed stay editable when the suggestion is edited.
    acceptedAnswers: prefill ? proposedAcceptedAnswers(prefill) : [],
    removeAccepted: false,
    hints: prefill?.hints || [],
    options: prefill?.type === "multiple_choice" && prefill.options ? prefill.options : [],
    imageUrl: null,
    mapsUrl: "",
    explanation: prefill?.explanation || "",
    difficulty: prefill?.difficulty || null,
    hintPenalty: 20,
    prerequisites: [],
  }
}

type ErrorField = "title" | "answer" | "points" | "options"

const TASK_TYPES: { value: ChallengeType; label: string; note: string }[] = [
  { value: "text", label: "Tekstas", note: "Dalyviai įrašo žodį ar trumpą frazę." },
  { value: "number", label: "Skaičius", note: "Dalyviai įrašo skaičių." },
  { value: "multiple_choice", label: "Pasirinkimas", note: "Dalyviai renkasi vieną iš jūsų surašytų variantų." },
]

const DIFFICULTIES = [
  { value: "easy", label: "Lengva" },
  { value: "medium", label: "Vidutinė" },
  { value: "hard", label: "Sunki" },
] as const

const labelClass = "block text-sm font-semibold leading-snug text-foreground"
const noteClass = "text-xs text-muted-foreground"
const sectionTitle = "text-base font-bold text-steam-dark"
const removeButton = "h-11 w-11 shrink-0 text-muted-foreground hover:text-foreground"

/** A refused save, said at the field. */
function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return (
    <p
      id={id}
      role="alert"
      className="motion-shake flex items-start gap-1.5 text-sm font-semibold text-destructive"
      style={{ "--motion-shake-distance": "4px" } as React.CSSProperties}
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      {message}
    </p>
  )
}

const formKey = (f: TaskForm) =>
  JSON.stringify([
    f.title, f.description, f.type, f.pointsText, f.correctAnswer, f.acceptedAnswers, f.removeAccepted,
    f.hints, f.options, f.imageUrl, f.mapsUrl, f.explanation, f.difficulty, f.hintPenalty, f.prerequisites,
  ])

export function ManualTaskEditor({
  gameId,
  challenge,
  prefillData,
  onSuccess,
  onCancel,
  pathMode = "linear",
  allChallenges = [],
}: ManualTaskEditorProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [showExtras, setShowExtras] = useState(false)
  // Unique per editor instance: the workspace is mounted twice (desktop panel
  // + mobile sheet), and a shared radio `name` would merge both mounts into
  // one DOM radio group. Also used to pair labels with inputs (a11y).
  const fieldId = useId()

  // Form state
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [type, setType] = useState<ChallengeType>("text")
  // Kept as typed, so the field can be cleared and retyped; checked on save.
  const [pointsText, setPointsText] = useState("100")
  const [correctAnswer, setCorrectAnswer] = useState("")
  const [acceptedAnswers, setAcceptedAnswers] = useState<string[]>([])
  const [removeAccepted, setRemoveAccepted] = useState(false)
  const [hints, setHints] = useState<string[]>([])
  const [options, setOptions] = useState<string[]>([])
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [mapsUrl, setMapsUrl] = useState("")
  const [explanation, setExplanation] = useState("")
  const [difficulty, setDifficulty] = useState<
    "easy" | "medium" | "hard" | null
  >(null)
  const [hintPenalty, setHintPenalty] = useState(20)
  const [prerequisites, setPrerequisites] = useState<string[]>([])
  // Options as loaded from the server — used to detect edits that invalidate
  // the stored answer hash (we can never recover the original answer, only
  // its hash, so changed options force the teacher to re-mark the answer).
  const [initialOptions, setInitialOptions] = useState<string[] | null>(null)

  // A refused save is explained at the field it is about, and the cursor
  // goes there (the field may be far above the save bar).
  const [errors, setErrors] = useState<Partial<Record<ErrorField, string>>>({})

  const showPrerequisites = pathMode === "free" && !!challenge

  // The form as last loaded: an edit compared against it is unsaved work.
  const [baseline, setBaseline] = useState<string | null>(null)
  const snapshot = formKey({
    title, description, type, pointsText, correctAnswer, acceptedAnswers, removeAccepted, hints, options,
    imageUrl, mapsUrl, explanation, difficulty, hintPenalty, prerequisites,
  })
  // Stays set while saving: the work is safe only once the save succeeded.
  const dirty = baseline !== null && snapshot !== baseline
  useLeaveWarning(dirty)
  const session = useSessionExpired()

  // Initialize from challenge or prefill. Every field is set each time, so
  // nothing carries over from the task edited before.
  useEffect(() => {
    const f = initialForm(challenge ?? null, prefillData ?? null)
    setTitle(f.title)
    setDescription(f.description)
    setType(f.type)
    setPointsText(f.pointsText)
    setCorrectAnswer(f.correctAnswer)
    setAcceptedAnswers(f.acceptedAnswers)
    setRemoveAccepted(f.removeAccepted)
    setHints(f.hints)
    setOptions(f.options)
    setInitialOptions(challenge ? challenge.options || [] : null)
    setImageUrl(f.imageUrl)
    setMapsUrl(f.mapsUrl)
    setExplanation(f.explanation)
    setDifficulty(f.difficulty)
    setHintPenalty(f.hintPenalty)
    setPrerequisites(f.prerequisites)
    setShowExtras(!!(f.imageUrl || f.mapsUrl))
    setErrors({})
    setBaseline(formKey(f))
  }, [challenge, prefillData])

  // A DI-made task whose answer the check doubted or rejected: saving it is
  // the facilitator's review, which clears the mark.
  const flaggedByDi =
    !!challenge &&
    challenge.generated_by_di &&
    (challenge.verification_verdict === "uncertain" || challenge.verification_verdict === "fail")
  const diIssues = flaggedByDi && Array.isArray(challenge.verification_issues) ? challenge.verification_issues : []

  function fail(field: ErrorField, message: string) {
    setErrors({ [field]: message })
    document.getElementById(`${fieldId}-${field}`)?.focus()
  }
  function clearError(field: ErrorField) {
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev))
  }

  async function handleSave() {
    setErrors({})
    if (!title.trim()) {
      fail("title", "Pavadinimas privalomas")
      return
    }
    // New tasks and duplicated/cloned tasks without a confirmed answer
    // (needs_answer) must get one; ordinary edits may leave it blank to keep
    // the existing answer.
    if ((!challenge || challenge.needs_answer) && !correctAnswer.trim()) {
      if (type === "multiple_choice") fail("options", "Atsakymas privalomas. Pažymėkite teisingą variantą.")
      else fail("answer", "Atsakymas privalomas")
      return
    }

    const points = Number(pointsText)
    if (!Number.isInteger(points) || points < 1 || points > 1000) {
      fail("points", "Taškai turi būti sveikasis skaičius nuo 1 iki 1000")
      return
    }

    if (type === "multiple_choice") {
      const cleanOptions = options.map((o) => o.trim()).filter(Boolean)
      if (cleanOptions.length < 2) {
        fail("options", "Reikia bent dviejų atsakymo variantų")
        return
      }
      // A marked answer must still exist among the options (it may have been
      // deleted or renamed after being marked).
      if (correctAnswer.trim() && !cleanOptions.includes(correctAnswer.trim())) {
        fail("options", "Pažymėkite teisingą atsakymą. Pažymėtas atsakymas nebesutampa su nė vienu variantu.")
        return
      }
      // Editing options without re-marking the answer would leave the stored
      // hash pointing at an option string that no longer exists — the task
      // would become unsolvable for students.
      const optionsChanged =
        challenge &&
        initialOptions !== null &&
        JSON.stringify(cleanOptions) !==
          JSON.stringify(initialOptions.map((o) => o.trim()).filter(Boolean))
      if (optionsChanged && !correctAnswer.trim()) {
        fail("options", "Pažymėkite teisingą atsakymą. Pakeitus atsakymų variantus būtina iš naujo pažymėti teisingą.")
        return
      }
    }

    setLoading(true)
    try {
      const isEditing = !!challenge
      const payload: Record<string, unknown> = {
        title: title.trim(),
        description: description.trim(),
        type,
        points,
        hints: hints.filter((h) => h.trim()),
        options:
          type === "multiple_choice"
            ? options.map((o) => o.trim()).filter(Boolean)
            : null,
        image_url: imageUrl || null,
        maps_url: mapsUrl.trim() || null,
        explanation: explanation.trim() || null,
        difficulty,
        hint_penalty: hintPenalty,
      }

      // Extra accepted answers: new ones replace the saved ones; "Pašalinti"
      // sends none. Choice tasks have none.
      const newAccepted = acceptedAnswers.map((a) => a.trim()).filter(Boolean)
      if (type !== "multiple_choice" && newAccepted.length > 0) {
        payload.accepted_answers = newAccepted
      } else if (type !== "multiple_choice" && isEditing && removeAccepted) {
        payload.accepted_answers = []
      }

      if (!isEditing) {
        payload.game_id = gameId
        payload.correct_answer = correctAnswer.trim()
        if (prefillData) {
          payload.generated_by_di = true
          payload.verification_verdict =
            prefillData.verification?.verdict ?? null
          payload.verification_issues =
            prefillData.verification?.issues ?? []
          payload.verification_confidence =
            prefillData.verification?.confidence ?? null
        }
      } else {
        if (correctAnswer.trim()) {
          payload.correct_answer = correctAnswer.trim()
        }
        // Prerequisites are only editable in free mode on a saved challenge.
        if (showPrerequisites) {
          payload.prerequisites = prerequisites
        }
        // Saving a DI task in this editor is the facilitator's confirmation
        // of its answer: the DI verdict (also a passing one) ends here, and
        // the start dialog stops asking about this task (the rule is in
        // components/teacher/ai-review.ts).
        if (challenge.generated_by_di && challenge.verification_verdict !== null) payload.mark_reviewed = true
      }

      const res = await fetch(
        isEditing ? `/api/challenges/${challenge.id}` : "/api/challenges",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      )

      // Session ended: the form keeps everything typed, the notice above
      // the save button says how to sign in and save again.
      if (session.check(res)) return
      if (!res.ok) {
        const err = await readJson<{ error?: unknown }>(res)
        throw new Error(
          typeof err.error === "string"
            ? err.error
            : "Nepavyko išsaugoti užduoties"
        )
      }

      // Saved while the activity runs, with answers already given: they are
      // not checked again (the server says so, lib/game/live-edit.ts).
      const saved = await readJson<{ live_scoring_notice?: unknown }>(res)
      const notice = typeof saved.live_scoring_notice === "string" ? saved.live_scoring_notice : null
      toast({
        title: isEditing ? "Užduotis atnaujinta" : "Užduotis sukurta!",
        ...(notice ? { description: notice, duration: 15000 } : {}),
      })
      onSuccess()
    } catch (error: unknown) {
      toast({
        title: "Klaida",
        description:
          error instanceof Error
            ? error.message
            : "Nepavyko išsaugoti užduoties",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const pointsNumber = Number(pointsText)
  const pointsValid = Number.isInteger(pointsNumber) && pointsNumber >= 1 && pointsNumber <= 1000
  const typeNote = TASK_TYPES.find((t) => t.value === type)?.note

  return (
    <div className="space-y-6" data-unsaved-task={dirty ? "true" : undefined}>
      {/* AI prefill badge */}
      {prefillData && !challenge && (
        <div className="flex items-start gap-2.5 rounded-xl border border-border border-l-[6px] border-l-highlight bg-white px-4 py-3 text-sm text-foreground">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Užpildyta pagal DI pasiūlymą. Peržiūrėkite ir patvirtinkite.</span>
        </div>
      )}

      {/* Needs-answer notice for duplicated/cloned tasks */}
      {challenge?.needs_answer && (
        <div className="flex items-start gap-2.5 rounded-xl border border-border border-l-[6px] border-l-accent bg-white px-4 py-3 text-sm text-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-accent-ink" aria-hidden="true" />
          <span>
            Ši užduotis dar neturi teisingo atsakymo. Įveskite jį žemiau, kad
            galėtumėte pradėti veiklą.
          </span>
        </div>
      )}

      {/* DI check notes on a saved DI task */}
      {flaggedByDi && (
        <div className="rounded-xl border border-border border-l-[6px] border-l-highlight bg-white px-4 py-3 text-sm text-foreground">
          <p className="flex items-center gap-2 font-bold">
            <Sparkles className="h-4 w-4 shrink-0" aria-hidden="true" />
            Reikia peržiūros
          </p>
          <p className="mt-1">
            {challenge?.needs_answer
              ? "DI patikra rado klaidą, todėl atsakymas neišsaugotas."
              : challenge?.verification_verdict === "fail"
                ? "DI patikra rado galimą klaidą."
                : "DI patikra abejoja šia užduotimi."}{" "}
            Peržiūrėkite ją ir išsaugokite: tada žyma dings.
          </p>
          {diIssues.length > 0 && (
            <ul className="mt-2 list-disc space-y-0.5 pl-5">
              {diIssues.map((issue, i) => (
                <li key={i}>{issue}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ===== Question ===== */}
      <section className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor={`${fieldId}-title`} className={labelClass}>
            Pavadinimas *
          </Label>
          <Input
            id={`${fieldId}-title`}
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              clearError("title")
            }}
            placeholder="pvz., Demografinis detektyvas"
            className="bg-white"
            aria-invalid={errors.title ? true : undefined}
            aria-describedby={errors.title ? `${fieldId}-title-error` : undefined}
          />
          <FieldError id={`${fieldId}-title-error`} message={errors.title} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`${fieldId}-description`} className={labelClass}>
            Aprašymas / klausimas
          </Label>
          <Textarea
            id={`${fieldId}-description`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Detalus užduoties aprašymas dalyviams..."
            className="resize-y bg-white"
            rows={3}
            aria-describedby={`${fieldId}-description-note`}
          />
          <p id={`${fieldId}-description-note`} className={noteClass}>
            Tai, ką dalyviai skaito ekrane. Be klausimo jie matytų tik pavadinimą.
          </p>
        </div>
      </section>

      {/* ===== Answer ===== */}
      <section className="space-y-4 border-t border-border pt-5">
        <h3 className={sectionTitle}>Atsakymas</h3>
        {challenge && !challenge.needs_answer && (
          <p className="text-sm text-muted-foreground">
            Teisingas atsakymas išsaugotas ir čia nerodomas. Jei jo nekeisite, jis liks toks pat.
          </p>
        )}

        {/* Type */}
        <fieldset className="space-y-1.5">
          <legend className={labelClass}>Tipas</legend>
          <div className="grid grid-cols-3 gap-1 rounded-full bg-muted p-1">
            {TASK_TYPES.map((t) => (
              <label key={t.value} className="relative min-w-0">
                <input
                  type="radio"
                  name={`${fieldId}-type`}
                  value={t.value}
                  checked={type === t.value}
                  onChange={() => {
                    setType(t.value)
                    setErrors({})
                  }}
                  className="peer sr-only"
                />
                <span className="flex min-h-11 cursor-pointer items-center justify-center rounded-full px-2 text-center text-sm font-semibold text-muted-foreground transition-colors motion-reduce:transition-none peer-checked:bg-white peer-checked:text-foreground peer-checked:shadow-sm peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2">
                  {t.label}
                </span>
              </label>
            ))}
          </div>
          {typeNote && <p className={noteClass}>{typeNote}</p>}
        </fieldset>

        {/* Multiple choice options */}
        {type === "multiple_choice" && (
          <fieldset
            className="space-y-2"
            aria-describedby={errors.options ? `${fieldId}-options-error` : undefined}
          >
            <legend className={labelClass}>
              Atsakymų variantai (pažymėkite teisingą)
            </legend>
            {options.map((option, i) => {
              const marked = correctAnswer === option && option.trim() !== ""
              return (
                <div
                  key={i}
                  className={cn(
                    "flex items-center gap-1 rounded-lg",
                    marked && "bg-primary/10"
                  )}
                >
                  <label
                    className={cn(
                      "flex h-11 w-11 shrink-0 items-center justify-center",
                      option.trim() ? "cursor-pointer" : "cursor-not-allowed"
                    )}
                  >
                    <input
                      type="radio"
                      name={`${fieldId}-correct-option`}
                      aria-label={`Teisingas atsakymas: variantas ${i + 1}`}
                      checked={marked}
                      onChange={() => {
                        setCorrectAnswer(option)
                        clearError("options")
                      }}
                      disabled={!option.trim()}
                      className="h-5 w-5 shrink-0 accent-primary"
                    />
                  </label>
                  <Input
                    value={option}
                    onChange={(e) => {
                      const old = option
                      const newOpts = [...options]
                      newOpts[i] = e.target.value
                      setOptions(newOpts)
                      if (correctAnswer === old) {
                        setCorrectAnswer(e.target.value)
                      }
                      clearError("options")
                    }}
                    placeholder={`Variantas ${i + 1}`}
                    aria-label={`Variantas ${i + 1}`}
                    className="flex-1 bg-white"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={removeButton}
                    aria-label={`Pašalinti ${i + 1} variantą`}
                    onClick={() => setOptions(options.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              )
            })}
            <Button
              type="button"
              variant="outline"
              size="sm"
              id={`${fieldId}-options`}
              onClick={() => {
                setOptions([...options, ""])
                clearError("options")
              }}
              className="gap-1.5"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Pridėti variantą
            </Button>
            <FieldError id={`${fieldId}-options-error`} message={errors.options} />
            <p className={noteClass}>
              Kiekviena komanda variantus mato kita tvarka. Jei kuris nors variantas remiasi kitais (pvz. „Visi
              išvardyti“), tvarka nekeičiama.
            </p>
          </fieldset>
        )}

        {/* Correct answer (non-multiple-choice or editing) */}
        {type !== "multiple_choice" && (
          <div className="space-y-1.5">
            <Label htmlFor={`${fieldId}-answer`} className={labelClass}>
              Teisingas atsakymas{" "}
              {challenge && !challenge.needs_answer
                ? "(palikite tuščią, jei nekeičiate)"
                : "*"}
            </Label>
            <Input
              id={`${fieldId}-answer`}
              type={type === "number" ? "number" : "text"}
              value={correctAnswer}
              onChange={(e) => {
                setCorrectAnswer(e.target.value)
                clearError("answer")
              }}
              placeholder="Tikslus teisingas atsakymas"
              autoFocus={challenge?.needs_answer === true}
              className="bg-white"
              aria-invalid={errors.answer ? true : undefined}
              aria-describedby={`${errors.answer ? `${fieldId}-answer-error ` : ""}${fieldId}-answer-note`}
            />
            <FieldError id={`${fieldId}-answer-error`} message={errors.answer} />
            <p id={`${fieldId}-answer-note`} className={noteClass}>
              {challenge && !challenge.needs_answer && (
                <>Išsaugoto atsakymo parodyti negalima. Rašykite čia tik tada, kai norite jį pakeisti. </>
              )}
              {type === "number"
                ? "Dalyvis turi įvesti tą patį skaičių."
                : "Tikrinant nesvarbu didžiosios raidės, lietuviškos raidės (š = s) ir nereikalingi tarpai. Žodžio forma ir tarpai tarp žodžių turi sutapti."}
            </p>
          </div>
        )}

        {/* More accepted answers (text and number tasks) */}
        {type !== "multiple_choice" && (
          <AcceptedAnswersField
            fieldId={fieldId}
            type={type}
            values={acceptedAnswers}
            onChange={setAcceptedAnswers}
            savedCount={challenge?.accepted_answer_count ?? 0}
            savedForType={challenge ? challenge.type === type : true}
            remove={removeAccepted}
            onRemoveChange={setRemoveAccepted}
          />
        )}
      </section>

      {/* ===== Points and help ===== */}
      <section className="space-y-4 border-t border-border pt-5">
        <h3 className={sectionTitle}>Taškai ir pagalba</h3>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[9rem_minmax(0,1fr)]">
          <div className="space-y-1.5">
            <Label htmlFor={`${fieldId}-points`} className={labelClass}>
              Taškai
            </Label>
            <Input
              id={`${fieldId}-points`}
              type="number"
              min={1}
              max={1000}
              inputMode="numeric"
              value={pointsText}
              onChange={(e) => {
                setPointsText(e.target.value)
                clearError("points")
              }}
              className="bg-white"
              aria-invalid={errors.points ? true : undefined}
              aria-describedby={errors.points ? `${fieldId}-points-error` : `${fieldId}-points-note`}
            />
            {!errors.points && (
              <p id={`${fieldId}-points-note`} className={noteClass}>
                Nuo 1 iki 1000.
              </p>
            )}
          </div>

          {/* Difficulty: optional, pressing the chosen one again clears it */}
          <div className="space-y-1.5" role="group" aria-labelledby={`${fieldId}-difficulty-label`}>
            <p id={`${fieldId}-difficulty-label`} className={labelClass}>
              Sunkumas <span className="font-normal text-muted-foreground">(neprivaloma)</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {DIFFICULTIES.map((d) => {
                const chosen = difficulty === d.value
                return (
                  <button
                    key={d.value}
                    type="button"
                    aria-pressed={chosen}
                    onClick={() => setDifficulty(chosen ? null : d.value)}
                    className={cn(
                      "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      chosen
                        ? "border-steam-dark bg-steam-dark text-white"
                        : "border-input bg-white text-foreground hover:bg-muted"
                    )}
                  >
                    {chosen && <Check className="h-4 w-4" aria-hidden="true" />}
                    {d.label}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="sm:col-span-2 empty:hidden">
            <FieldError id={`${fieldId}-points-error`} message={errors.points} />
          </div>
        </div>

        {/* Hints */}
        <fieldset className="space-y-2">
          <legend className={labelClass}>
            Užuominos <span className="font-normal text-muted-foreground">(neprivaloma)</span>
          </legend>
          <p className={noteClass}>
            Įstrigusi komanda užuominas atveria po vieną, iš eilės. Pirmoji turėtų tik pakreipti, paskutinė
            beveik atsakyti.
          </p>
          {hints.map((hint, i) => (
            <div key={i} className="flex items-center gap-1">
              <Input
                value={hint}
                onChange={(e) => {
                  const newH = [...hints]
                  newH[i] = e.target.value
                  setHints(newH)
                }}
                placeholder={`Užuomina ${i + 1}`}
                aria-label={`Užuomina ${i + 1}`}
                className="flex-1 bg-white"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={removeButton}
                aria-label={`Pašalinti ${i + 1} užuominą`}
                onClick={() => setHints(hints.filter((_, j) => j !== i))}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setHints([...hints, ""])}
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Pridėti užuominą
          </Button>
        </fieldset>

        {/* Hint penalty: only matters once there is a hint */}
        {hints.length > 0 && (
          <div className="motion-fade-in space-y-1.5">
            <Label htmlFor={`${fieldId}-hint-penalty`} className={labelClass}>
              Užuominos kaina (taškų)
            </Label>
            <Input
              type="number"
              min={0}
              max={100}
              id={`${fieldId}-hint-penalty`}
              value={hintPenalty}
              onChange={(e) => setHintPenalty(parseInt(e.target.value) || 0)}
              className="w-36 bg-white"
              aria-describedby={`${fieldId}-hint-penalty-note`}
            />
            <p id={`${fieldId}-hint-penalty-note`} className={noteClass}>
              Už kiekvieną atidarytą užuominą, bet kartu ne daugiau nei pusė užduoties taškų.
              {pointsValid && (
                <>
                  {" "}
                  Dabar: atvėrusi vieną užuominą, komanda už teisingą atsakymą gaus{" "}
                  {calculatePoints(pointsNumber, 1, hintPenalty)} tšk. iš {pointsNumber}
                  {hints.length > 1 && (
                    <>
                      , atvėrusi visas ({hints.length}): {calculatePoints(pointsNumber, hints.length, hintPenalty)} tšk
                    </>
                  )}
                  .
                </>
              )}
            </p>
          </div>
        )}

        {/* Explanation */}
        <div className="space-y-1.5">
          <Label htmlFor={`${fieldId}-explanation`} className={labelClass}>
            Paaiškinimas (rodomas po teisingo atsakymo){" "}
            <span className="font-normal text-muted-foreground">(neprivaloma)</span>
          </Label>
          <Textarea
            id={`${fieldId}-explanation`}
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            placeholder="Trumpas edukacinis paaiškinimas dalyviams..."
            className="resize-y bg-white"
            rows={2}
          />
        </div>
      </section>

      {/* Free-mode prerequisites (only for saved challenges) */}
      {showPrerequisites && challenge && (
        <section className="border-t border-border pt-5">
          <ChallengePrerequisites
            challengeId={challenge.id}
            gameId={gameId}
            allChallenges={allChallenges}
            currentPrerequisites={prerequisites}
            onChange={setPrerequisites}
          />
        </section>
      )}

      {/* ===== Optional picture and map ===== */}
      <section className="border-t border-border pt-3">
        <button
          type="button"
          aria-expanded={showExtras}
          className="flex min-h-11 w-full items-center justify-between gap-2 rounded-md text-left text-base font-bold text-steam-dark"
          onClick={() => setShowExtras(!showExtras)}
        >
          <span>
            Nuotrauka ir žemėlapis <span className="text-sm font-normal text-muted-foreground">(neprivaloma)</span>
          </span>
          {showExtras ? (
            <ChevronUp className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          ) : (
            <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          )}
        </button>

        {showExtras && (
          <div className="motion-fade-in space-y-4 pb-1 pt-2">
            {/* Image */}
            <ImageUpload value={imageUrl} onChange={setImageUrl} />

            {/* Maps */}
            <div className="space-y-1.5">
              <Label htmlFor={`${fieldId}-maps`} className={labelClass}>
                Google Maps nuoroda
              </Label>
              <Input
                id={`${fieldId}-maps`}
                placeholder="https://maps.google.com/..."
                value={mapsUrl}
                onChange={(e) => setMapsUrl(e.target.value)}
                className="bg-white"
              />
              {mapsUrl.trim() && (
                <MapsEmbed
                  url={mapsUrl.trim()}
                  className="rounded-lg overflow-hidden mt-2"
                />
              )}
            </div>
          </div>
        )}
      </section>

      {/* Save bar: stays at the bottom of the view, so saving never needs a
          scroll to the end of the form. */}
      <div className="sticky bottom-0 z-10 -mx-5 -mb-5 space-y-3 rounded-b-2xl border-t border-border bg-white px-5 py-3 shadow-[0_-6px_12px_-8px_hsl(var(--foreground)/0.18)]">
        {session.expired && <SessionExpiredNotice onRetry={() => void handleSave()} retrying={loading} />}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <p className="min-w-0 flex-1 basis-full text-sm text-muted-foreground empty:hidden sm:basis-40 sm:empty:block" aria-live="polite">
            {!title.trim()
              ? "Įrašykite pavadinimą, tada galėsite išsaugoti."
              : dirty
                ? "Yra neišsaugotų pakeitimų."
                : ""}
          </p>
          <div className="flex items-center gap-2 max-sm:w-full [&>*]:max-sm:flex-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (!dirty || window.confirm("Užduoties pakeitimai neišsaugoti. Atmesti juos?")) onCancel()
              }}
            >
              Atšaukti
            </Button>
            <Button
              onClick={handleSave}
              disabled={loading || !title.trim()}
              className="gap-2 font-bold"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              ) : (
                <Save className="h-4 w-4" aria-hidden="true" />
              )}
              {challenge ? "Atnaujinti" : "Pridėti užduotį"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
