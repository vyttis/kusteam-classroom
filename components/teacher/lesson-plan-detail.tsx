"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { useLeaveWarning } from "@/hooks/use-leave-warning"
import { useSessionExpired } from "@/hooks/use-session-expired"
import { SessionExpiredNotice } from "@/components/teacher/session-expired-notice"
import {
  ArrowLeft,
  GraduationCap,
  Clock,
  Target,
  MessageSquare,
  BookOpen,
  PlayCircle,
  Loader2,
  FileText,
  Sparkles,
  Pencil,
  Trash2,
  Save,
  CheckCircle2,
} from "lucide-react"
import Link from "next/link"
import { getSubjectLabel } from "@/lib/curriculum/subjects"
import { COMPETENCY_LABELS, BLOOM_LABELS, type Competency, type BloomLevel } from "@/lib/ai/lesson-types"
import type { LessonStage } from "@/types/lesson-plan"
import { LessonActivityCard } from "@/components/teacher/lesson-activity-card"
import { LessonPlanConvertDialog } from "@/components/teacher/lesson-plan-convert-dialog"

const LESSON_TYPE_LABELS: Record<string, string> = {
  nauja_tema: "Nauja tema",
  kartojimas: "Kartojimas",
  vertinimas: "Vertinimas",
  projektine_veikla: "Projektinė veikla",
}

const ACTIVITY_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  intro: { label: "Įvadas", color: "bg-secondary/10 text-secondary-ink" },
  challenge: { label: "Užduotis", color: "bg-primary/10 text-primary-ink" },
  discussion: { label: "Diskusija", color: "bg-accent/10 text-accent-ink" },
  reflection: { label: "Refleksija", color: "bg-highlight/15 text-steam-dark" },
}

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  draft: { label: "Juodraštis", variant: "outline" },
  saved: { label: "Išsaugotas", variant: "secondary" },
  converted: { label: "Paverstas veikla", variant: "default" },
}

interface PlanData {
  id: string
  title: string
  subject: string
  secondary_subject: string | null
  grade: number
  topic: string
  lesson_type: string
  duration: number
  goal: string
  curriculum_link: string
  stages: LessonStage[]
  competencies?: string[]
  reflection_prompt: string
  teacher_methodical_note: string
  status: string
  source_game_id: string | null
  created_at: string
}

interface LessonPlanDetailProps {
  plan: PlanData
  /** Open the "create activity" dialog right away (from the generator). */
  openConvert?: boolean
}

interface Draft {
  /** Stable keys for the stage cards, so moving one keeps its open editor. */
  keys: number[]
  title: string
  goal: string
  curriculum_link: string
  stages: LessonStage[]
  reflection_prompt: string
  teacher_methodical_note: string
}

/** The editable content of a draft: two drafts with the same content are equal. */
const draftContent = (d: Draft) =>
  JSON.stringify([d.title, d.goal, d.curriculum_link, d.stages, d.reflection_prompt, d.teacher_methodical_note])

let nextKey = 0

const draftOf = (plan: PlanData): Draft => ({
  keys: (plan.stages ?? []).map(() => nextKey++),
  title: plan.title,
  goal: plan.goal ?? "",
  curriculum_link: plan.curriculum_link ?? "",
  stages: (plan.stages ?? []).map((s) => ({ ...s })),
  reflection_prompt: plan.reflection_prompt ?? "",
  teacher_methodical_note: plan.teacher_methodical_note ?? "",
})

export function LessonPlanDetail({ plan: initialPlan, openConvert = false }: LessonPlanDetailProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [plan, setPlan] = useState(initialPlan)
  const [draft, setDraft] = useState<Draft | null>(null)
  // The draft as it was when editing started: a difference is unsaved work.
  const [draftBaseline, setDraftBaseline] = useState<string | null>(null)
  const session = useSessionExpired()
  const [saving, setSaving] = useState(false)
  const [convertOpen, setConvertOpen] = useState(openConvert)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const status = STATUS_LABELS[plan.status] || STATUS_LABELS.draft
  const stages = plan.stages || []
  const editing = draft !== null
  // Stays set while saving: the edits are safe only once the save succeeded.
  const dirty = draft !== null && draftBaseline !== null && draftContent(draft) !== draftBaseline
  useLeaveWarning(dirty)

  function startEditing() {
    const next = draftOf(plan)
    setDraft(next)
    setDraftBaseline(draftContent(next))
  }

  function cancelEditing() {
    if (dirty && !window.confirm("Plano pakeitimai neišsaugoti. Atmesti juos?")) return
    session.clear()
    setDraft(null)
    setDraftBaseline(null)
  }

  function updateStage(index: number, updated: LessonStage) {
    setDraft((d) => (d ? { ...d, stages: d.stages.map((s, i) => (i === index ? updated : s)) } : d))
  }

  function moveStage(index: number, direction: -1 | 1) {
    setDraft((d) => {
      if (!d) return d
      const target = index + direction
      if (target < 0 || target >= d.stages.length) return d
      const next = [...d.stages]
      const keys = [...d.keys]
      ;[next[index], next[target]] = [next[target], next[index]]
      ;[keys[index], keys[target]] = [keys[target], keys[index]]
      return { ...d, stages: next, keys }
    })
  }

  function removeStage(index: number) {
    setDraft((d) =>
      d ? { ...d, stages: d.stages.filter((_, i) => i !== index), keys: d.keys.filter((_, i) => i !== index) } : d
    )
  }

  async function save() {
    if (!draft) return
    setSaving(true)
    try {
      const res = await fetch(`/api/lesson-plans/${plan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draft.title,
          goal: draft.goal,
          curriculum_link: draft.curriculum_link,
          stages: draft.stages,
          reflection_prompt: draft.reflection_prompt,
          teacher_methodical_note: draft.teacher_methodical_note,
          competencies: plan.competencies ?? [],
        }),
      })
      // Session ended: the notice next to the save button explains what to
      // do, and the edits stay in the form.
      if (session.check(res)) return
      const data = (await res.json().catch(() => ({}))) as { lesson_plan?: PlanData; error?: string }
      if (!res.ok || !data.lesson_plan) {
        toast({ title: "Nepavyko išsaugoti", description: data.error ?? "Bandykite dar kartą.", variant: "destructive" })
        return
      }
      setPlan(data.lesson_plan)
      setDraft(null)
      setDraftBaseline(null)
      toast({ title: "Planas išsaugotas" })
      router.refresh()
    } catch {
      toast({ title: "Nepavyko išsaugoti", description: "Patikrinkite interneto ryšį.", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    setDeleting(true)
    try {
      const res = await fetch(`/api/lesson-plans/${plan.id}`, { method: "DELETE" })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        toast({ title: "Nepavyko ištrinti", description: data.error ?? "Bandykite dar kartą.", variant: "destructive" })
        return
      }
      toast({ title: "Planas ištrintas" })
      router.push("/lesson-plans")
      router.refresh()
    } catch {
      toast({ title: "Nepavyko ištrinti", description: "Patikrinkite interneto ryšį.", variant: "destructive" })
    } finally {
      setDeleting(false)
      setDeleteOpen(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <Link href="/lesson-plans" className="inline-block mb-6">
        <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Visi pamokų planai
        </Button>
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant={status.variant}>{status.label}</Badge>
            <span className="text-xs text-muted-foreground">
              {new Date(plan.created_at).toLocaleDateString("lt-LT", { timeZone: "Europe/Vilnius" })}
            </span>
          </div>
          {editing ? (
            <div className="space-y-1">
              <Label htmlFor="plan-title" className="text-xs text-muted-foreground">
                Pamokos pavadinimas
              </Label>
              <Input
                id="plan-title"
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                className="text-lg font-bold"
                maxLength={200}
              />
            </div>
          ) : (
            <h1 className="text-2xl font-bold text-steam-dark">{plan.title}</h1>
          )}
        </div>
        {!editing && (
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={startEditing}>
              <Pencil className="h-4 w-4" aria-hidden="true" />
              Redaguoti
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-accent-ink hover:text-accent-ink"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Ištrinti
            </Button>
          </div>
        )}
      </div>

      {/* Meta info */}
      <div className="flex flex-wrap gap-2 mb-6">
        <Badge variant="outline" className="gap-1">
          <GraduationCap className="h-3 w-3" aria-hidden="true" />
          {getSubjectLabel(plan.subject)}
        </Badge>
        {plan.secondary_subject && (
          <Badge variant="outline" className="gap-1 border-accent/40 text-accent-ink">
            <Sparkles className="h-3 w-3" aria-hidden="true" />
            {getSubjectLabel(plan.secondary_subject)}
          </Badge>
        )}
        <Badge variant="outline">{plan.grade} klasė</Badge>
        <Badge variant="outline" className="gap-1">
          <Clock className="h-3 w-3" aria-hidden="true" />
          {plan.duration} min.
        </Badge>
        <Badge variant="outline">{LESSON_TYPE_LABELS[plan.lesson_type] || plan.lesson_type}</Badge>
        <Badge variant="outline" className="gap-1">
          <FileText className="h-3 w-3" aria-hidden="true" />
          {(editing ? draft.stages : stages).length} etap.
        </Badge>
      </div>

      {editing && plan.status === "converted" && (
        <p className="mb-4 rounded-lg border border-secondary/30 bg-secondary/5 px-4 py-3 text-sm text-steam-dark">
          Pakeitimai liks plane. Veikla, jau sukurta iš šio plano, nepasikeis.
        </p>
      )}

      {/* Goal */}
      {editing ? (
        <div className="space-y-1 mb-4">
          <Label htmlFor="plan-goal" className="text-xs text-muted-foreground">
            Pamokos tikslas
          </Label>
          <Textarea id="plan-goal" value={draft.goal} onChange={(e) => setDraft({ ...draft, goal: e.target.value })} rows={2} />
        </div>
      ) : (
        plan.goal && (
          <Card className="border-border/50 bg-white mb-4">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-secondary-ink mb-1 flex items-center gap-1">
                <Target className="h-3 w-3" aria-hidden="true" />
                Pamokos tikslas
              </p>
              <p className="text-sm text-steam-dark">{plan.goal}</p>
            </CardContent>
          </Card>
        )
      )}

      {/* Curriculum link */}
      {editing ? (
        <div className="space-y-1 mb-6">
          <Label htmlFor="plan-curriculum" className="text-xs text-muted-foreground">
            Ryšys su ugdymo programa
          </Label>
          <Textarea
            id="plan-curriculum"
            value={draft.curriculum_link}
            onChange={(e) => setDraft({ ...draft, curriculum_link: e.target.value })}
            rows={2}
          />
        </div>
      ) : (
        plan.curriculum_link && (
          <Card className="border-secondary/20 bg-secondary/5 mb-6">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-secondary-ink mb-1 flex items-center gap-1">
                <Target className="h-3 w-3" aria-hidden="true" />
                Ryšys su ugdymo programa
              </p>
              <p className="text-sm text-muted-foreground">{plan.curriculum_link}</p>
            </CardContent>
          </Card>
        )
      )}

      {/* Plan competencies */}
      {!editing && (plan.competencies?.length ?? 0) > 0 && (
        <Card className="border-primary/20 bg-primary/5 mb-6">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-primary-ink mb-2 flex items-center gap-1">
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              Ugdomos kompetencijos
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(plan.competencies ?? []).map((c) =>
                COMPETENCY_LABELS[c as Competency] ? (
                  <span key={c} className="text-xs px-2 py-0.5 rounded-md bg-white border border-primary/20 text-primary-ink">
                    {COMPETENCY_LABELS[c as Competency]}
                  </span>
                ) : null
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stages / lesson flow */}
      <div className="mb-6">
        <h2 className="text-sm font-medium text-steam-dark flex items-center gap-2 mb-3">
          <Clock className="h-4 w-4 text-secondary-ink" aria-hidden="true" />
          Pamokos eiga
        </h2>

        {editing ? (
          <div>
            {draft.stages.map((stage, index) => (
              <LessonActivityCard
                key={draft.keys[index]}
                activity={stage}
                index={index}
                total={draft.stages.length}
                onUpdate={(updated) => updateStage(index, updated as LessonStage)}
                onRemove={() => removeStage(index)}
                onMoveUp={() => moveStage(index, -1)}
                onMoveDown={() => moveStage(index, 1)}
              />
            ))}
            {draft.stages.length === 0 && (
              <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                Plane turi likti bent vienas etapas.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {stages.map((stage, index) => {
              const typeInfo = ACTIVITY_TYPE_LABELS[stage.activity_type] || ACTIVITY_TYPE_LABELS.challenge
              return (
                <Card key={index} className="border-border/50 bg-white">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center text-sm font-bold text-secondary-ink shrink-0">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeInfo.color}`}>
                            {typeInfo.label}
                          </span>
                          <span className="text-xs text-muted-foreground">{stage.duration_minutes} min.</span>
                          {stage.difficulty && (
                            <span className="text-xs text-muted-foreground">
                              {stage.difficulty === "easy" ? "Lengva" : stage.difficulty === "medium" ? "Vidutinė" : "Sunki"}
                            </span>
                          )}
                        </div>
                        <h3 className="font-medium text-steam-dark text-sm">{stage.title}</h3>
                        <p className="text-xs text-muted-foreground mt-1">{stage.description}</p>
                        {stage.type === "multiple_choice" && (stage.options?.length ?? 0) > 0 && (
                          <ul className="mt-2 space-y-0.5 text-xs">
                            {(stage.options ?? []).map((option, i) => {
                              const correct = option.trim().toLowerCase() === stage.correct_answer?.trim().toLowerCase()
                              return (
                                <li key={i} className={correct ? "font-medium text-primary-ink" : "text-muted-foreground"}>
                                  {String.fromCharCode(65 + i)}. {option}
                                  {correct && (
                                    <>
                                      <CheckCircle2 className="ml-1 inline h-3 w-3" aria-hidden="true" />
                                      <span className="sr-only"> (teisingas)</span>
                                    </>
                                  )}
                                </li>
                              )
                            })}
                          </ul>
                        )}
                        {stage.correct_answer && stage.type !== "multiple_choice" && (
                          <p className="text-xs mt-2">
                            <span className="text-muted-foreground">Atsakymas: </span>
                            <span className="font-medium text-primary-ink">{stage.correct_answer}</span>
                          </p>
                        )}
                        {(stage.bloom_level || (stage.competencies?.length ?? 0) > 0) && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {stage.bloom_level && BLOOM_LABELS[stage.bloom_level as BloomLevel] && (
                              <span className="text-xs px-1.5 py-0.5 rounded-md bg-secondary/10 text-secondary-ink border border-secondary/20">
                                Bloom: {BLOOM_LABELS[stage.bloom_level as BloomLevel]}
                              </span>
                            )}
                            {(stage.competencies ?? []).map((c) =>
                              COMPETENCY_LABELS[c as Competency] ? (
                                <span
                                  key={c}
                                  className="text-xs px-1.5 py-0.5 rounded-md bg-primary/10 text-primary-ink border border-primary/20"
                                >
                                  {COMPETENCY_LABELS[c as Competency]}
                                </span>
                              ) : null
                            )}
                          </div>
                        )}
                        {stage.explanation && (
                          <p className="text-xs text-muted-foreground mt-2 italic">Paaiškinimas: {stage.explanation}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Reflection */}
      {editing ? (
        <div className="space-y-1 mb-4">
          <Label htmlFor="plan-reflection" className="text-xs text-muted-foreground">
            Refleksijos klausimas klasei
          </Label>
          <Textarea
            id="plan-reflection"
            value={draft.reflection_prompt}
            onChange={(e) => setDraft({ ...draft, reflection_prompt: e.target.value })}
            rows={2}
          />
        </div>
      ) : (
        plan.reflection_prompt && (
          <Card className="border-border/50 bg-white mb-4">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                <MessageSquare className="h-3 w-3" aria-hidden="true" />
                Refleksijos klausimas klasei
              </p>
              <p className="text-sm text-steam-dark">{plan.reflection_prompt}</p>
            </CardContent>
          </Card>
        )
      )}

      {/* Teacher note */}
      {editing ? (
        <div className="space-y-1 mb-6">
          <Label htmlFor="plan-note" className="text-xs text-muted-foreground">
            Metodinė pastaba vedėjui
          </Label>
          <Textarea
            id="plan-note"
            value={draft.teacher_methodical_note}
            onChange={(e) => setDraft({ ...draft, teacher_methodical_note: e.target.value })}
            rows={3}
          />
        </div>
      ) : (
        plan.teacher_methodical_note && (
          <Card className="border-highlight/30 bg-highlight/5 mb-6">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-highlight-ink mb-1 flex items-center gap-1">
                <BookOpen className="h-3 w-3" aria-hidden="true" />
                Metodinė pastaba vedėjui
              </p>
              <p className="text-sm text-muted-foreground">{plan.teacher_methodical_note}</p>
            </CardContent>
          </Card>
        )
      )}

      {editing && session.expired && (
        <SessionExpiredNotice className="mb-3" onRetry={() => void save()} retrying={saving} />
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 pt-2 pb-8">
        {editing ? (
          <>
            <Button
              onClick={() => void save()}
              disabled={saving || draft.stages.length === 0 || !draft.title.trim()}
              className="flex-1 gap-2"
              size="lg"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Save className="h-4 w-4" aria-hidden="true" />
              )}
              {saving ? "Išsaugoma..." : "Išsaugoti pakeitimus"}
            </Button>
            <Button variant="outline" size="lg" onClick={cancelEditing} disabled={saving}>
              Atšaukti
            </Button>
          </>
        ) : plan.status === "converted" && plan.source_game_id ? (
          <>
            <Link href={`/games/${plan.source_game_id}`} className="flex-1">
              <Button className="w-full gap-2" size="lg">
                <PlayCircle className="h-4 w-4" aria-hidden="true" />
                Atidaryti veiklą
              </Button>
            </Link>
            <Button
              variant="outline"
              size="lg"
              className="gap-2 border-accent/30 text-accent-ink hover:bg-accent/5"
              onClick={() => setConvertOpen(true)}
            >
              Sukurti dar vieną veiklą
            </Button>
          </>
        ) : (
          <Button
            onClick={() => setConvertOpen(true)}
            className="flex-1 gap-2 border-accent/30 text-accent-ink hover:bg-accent/5"
            variant="outline"
            size="lg"
          >
            <PlayCircle className="h-4 w-4" aria-hidden="true" />
            Sukurti veiklą dalyviams
          </Button>
        )}
      </div>

      {convertOpen && (
        <LessonPlanConvertDialog planId={plan.id} stages={stages} open={convertOpen} onOpenChange={setConvertOpen} />
      )}

      <Dialog open={deleteOpen} onOpenChange={(open) => !deleting && setDeleteOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ištrinti pamokos planą?</DialogTitle>
            <DialogDescription>
              Planas „{plan.title}“ bus ištrintas visam laikui.
              {plan.source_game_id ? " Iš jo sukurta veikla liks." : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              Atšaukti
            </Button>
            <Button variant="destructive" onClick={() => void remove()} disabled={deleting} className="gap-2">
              {deleting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Ištrinti
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
