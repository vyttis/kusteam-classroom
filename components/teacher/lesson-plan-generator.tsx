"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { AiQuotaNote } from "@/components/teacher/ai-quota-note"
import { useRouter, useSearchParams } from "next/navigation"
import { SUBJECTS, LESSON_TYPES, DURATIONS, getGradesForSubject, getSubjectLabel } from "@/lib/curriculum/subjects"
import { getTopicsForSubjectAndGrade, getCurriculumContext } from "@/lib/curriculum/topics"
import { getLessonTemplate } from "@/lib/curriculum/lesson-templates"
import { Switch } from "@/components/ui/switch"
import { SubjectCombobox } from "@/components/ui/subject-combobox"
import type { LessonStage } from "@/types/lesson-plan"
import { LessonActivityCard } from "./lesson-activity-card"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { useLeaveWarning } from "@/hooks/use-leave-warning"
import { useSessionExpired } from "@/hooks/use-session-expired"
import { SessionExpiredNotice } from "@/components/teacher/session-expired-notice"
import { motion, AnimatePresence } from "framer-motion"
import {
  Sparkles,
  Loader2,
  BookOpen,
  Save,
  RefreshCw,
  GraduationCap,
  Clock,
  Target,
  MessageSquare,
  PlayCircle,
} from "lucide-react"

type Phase = "input" | "preview" | "saving"

/**
 * Multi-stage progress indicator shown while the AI generates a lesson plan.
 * Lesson plan generation typically takes 20-40s with Opus 4.7 — a spinning
 * loader alone makes teachers think the system is stuck.
 */
function GenerationProgress() {
  const stages = [
    { at: 0, label: "Analizuojama ugdymo programa..." },
    { at: 5000, label: "Generuojamos pamokos veiklos..." },
    { at: 25000, label: "Finalizuojamas planas..." },
  ]
  const [elapsedMs, setElapsedMs] = useState(0)

  useEffect(() => {
    const start = Date.now()
    const id = setInterval(() => setElapsedMs(Date.now() - start), 250)
    return () => clearInterval(id)
  }, [])

  const currentStageIndex = stages.reduce(
    (acc, s, i) => (elapsedMs >= s.at ? i : acc),
    0,
  )
  // Progress: 0..95% — never hit 100 until response actually arrives.
  const progressPercent = Math.min(95, Math.floor((elapsedMs / 35000) * 100))

  return (
    <div className="rounded-lg border border-secondary/30 bg-secondary/5 p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-secondary-ink shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-steam-dark">
            {stages[currentStageIndex].label}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            DI ruošia pedagoginius pasiūlymus pagal Lietuvos BUP. Tai gali užtrukti iki 40 sek.
          </p>
        </div>
      </div>
      <div className="h-1.5 rounded-full bg-secondary/15 overflow-hidden">
        <motion.div
          className="h-full bg-secondary"
          initial={{ width: 0 }}
          animate={{ width: `${progressPercent}%` }}
          transition={{ ease: "linear", duration: 0.3 }}
        />
      </div>
    </div>
  )
}

// The generated plan, kept in this browser until it is saved (TCH-07), per
// facilitator; signing out removes it (clearLocalWork).
const PLAN_DRAFT_KEY = "ks-lesson-plan-draft:v1"
const PLAN_DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000

interface PlanDraft {
  savedAt: number
  form: {
    subject: string
    isIntegrated: boolean
    secondarySubject: string
    grade: number | null
    topicId: string
    customTopic: string
    lessonType: string
    duration: number
    learningGoal: string
  }
  plan: {
    title: string
    goal: string
    curriculumLink: string
    teacherNote: string
    reflection: string
    competencies: string[]
    stages: LessonStage[]
  }
}

function readPlanDraft(key: string): PlanDraft | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const draft = JSON.parse(raw) as PlanDraft
    const fresh = typeof draft?.savedAt === "number" && Date.now() - draft.savedAt < PLAN_DRAFT_TTL_MS
    if (!fresh || !Array.isArray(draft.plan?.stages) || draft.plan.stages.length === 0 || !draft.form) {
      localStorage.removeItem(key)
      return null
    }
    return draft
  } catch {
    return null
  }
}

function writePlanDraft(key: string, draft: PlanDraft) {
  try {
    localStorage.setItem(key, JSON.stringify(draft))
  } catch {
    // Storage full or blocked: the leave warning still protects the plan.
  }
}

function clearPlanDraft(key: string) {
  try {
    localStorage.removeItem(key)
  } catch {
    // Nothing stored.
  }
}

export function LessonPlanGenerator({ userId }: { userId: string }) {
  const draftKey = `${PLAN_DRAFT_KEY}:${userId}`
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  // Form state
  const [subject, setSubject] = useState("")
  const [isIntegrated, setIsIntegrated] = useState(false)
  const [secondarySubject, setSecondarySubject] = useState("")
  const [grade, setGrade] = useState<number | null>(null)
  const [topicId, setTopicId] = useState("")
  const [customTopic, setCustomTopic] = useState("")
  const [lessonType, setLessonType] = useState("")
  const [duration, setDuration] = useState<number>(45)
  const [learningGoal, setLearningGoal] = useState("")

  // Generation state
  const [phase, setPhase] = useState<Phase>("input")
  const [loading, setLoading] = useState(false)
  const [converting, setConverting] = useState(false)
  const session = useSessionExpired()

  // Prefill from a template (lesson-plans list "Pavyzdžiai", ?template=)
  const applyTemplate = useCallback((templateId: string) => {
    const t = getLessonTemplate(templateId)
    if (!t) return
    setSubject(t.subject)
    setIsIntegrated(true)
    setSecondarySubject(t.secondary_subject)
    setGrade(t.grade)
    setCustomTopic(t.topic)
    setLessonType(t.lesson_type)
    setDuration(t.duration)
    setLearningGoal(t.learning_goal)
    toast({
      title: "Pavyzdys įkeltas",
      description: "Peržiūrėkite parametrus ir spauskite „Generuoti“.",
    })
  }, [toast])

  // Editable lesson plan state
  const [editTitle, setEditTitle] = useState("")
  const [editGoal, setEditGoal] = useState("")
  const [editTeacherNote, setEditTeacherNote] = useState("")
  const [editReflection, setEditReflection] = useState("")
  const [editCurriculumLink, setEditCurriculumLink] = useState("")
  const [editCompetencies, setEditCompetencies] = useState<string[]>([])
  const [stages, setStages] = useState<LessonStage[]>([])
  // When the plan on screen was restored from this browser (not saved yet).
  const [restoredAt, setRestoredAt] = useState<number | null>(null)
  // A template asked for while an unsaved plan was waiting: it comes after
  // that plan is saved or thrown away, never over it.
  const [pendingTemplate, setPendingTemplate] = useState<string | null>(null)

  // A generated plan is minutes of DI work: leaving or reloading before it
  // is saved asks first, and the plan is kept in this browser until saved.
  useLeaveWarning(loading || (phase === "preview" && stages.length > 0))

  useEffect(() => {
    const templateId = searchParams.get("template")
    const draft = readPlanDraft(draftKey)
    if (!draft) {
      if (templateId) applyTemplate(templateId)
      return
    }
    if (templateId) setPendingTemplate(templateId)
    const f = draft.form
    setSubject(f.subject)
    setIsIntegrated(f.isIntegrated)
    setSecondarySubject(f.secondarySubject)
    setGrade(f.grade)
    setTopicId(f.topicId)
    setCustomTopic(f.customTopic)
    setLessonType(f.lessonType)
    setDuration(f.duration)
    setLearningGoal(f.learningGoal)
    const p = draft.plan
    setEditTitle(p.title)
    setEditGoal(p.goal)
    setEditCurriculumLink(p.curriculumLink)
    setEditTeacherNote(p.teacherNote)
    setEditReflection(p.reflection)
    setEditCompetencies(p.competencies)
    setStages(p.stages)
    setRestoredAt(draft.savedAt)
    setPhase("preview")
  }, [searchParams, draftKey, applyTemplate])

  useEffect(() => {
    if (phase !== "preview" || stages.length === 0) return
    writePlanDraft(draftKey, {
      savedAt: restoredAt ?? Date.now(),
      form: { subject, isIntegrated, secondarySubject, grade, topicId, customTopic, lessonType, duration, learningGoal },
      plan: {
        title: editTitle,
        goal: editGoal,
        curriculumLink: editCurriculumLink,
        teacherNote: editTeacherNote,
        reflection: editReflection,
        competencies: editCompetencies,
        stages,
      },
    })
  }, [
    draftKey, phase, restoredAt, subject, isIntegrated, secondarySubject, grade, topicId, customTopic, lessonType,
    duration, learningGoal, editTitle, editGoal, editCurriculumLink, editTeacherNote, editReflection,
    editCompetencies, stages,
  ])

  // Derived
  const curriculumTopics = useMemo(
    () => (subject && grade && !isIntegrated ? getTopicsForSubjectAndGrade(subject, grade) : []),
    [subject, grade, isIntegrated]
  )
  const curriculumContext = useMemo(() => {
    const parts: string[] = []
    if (subject && grade) parts.push(getCurriculumContext(subject, grade, topicId || undefined))
    if (isIntegrated && secondarySubject && grade) {
      const sec = getCurriculumContext(secondarySubject, grade)
      if (sec) parts.push(`\n--- Antrasis dalykas (${getSubjectLabel(secondarySubject)}) ---\n${sec}`)
    }
    return parts.filter(Boolean).join("\n")
  }, [subject, secondarySubject, grade, topicId, isIntegrated])

  const effectiveTopic = topicId
    ? curriculumTopics.find((t) => t.id === topicId)?.label ?? customTopic
    : customTopic

  const canGenerate =
    subject &&
    grade &&
    effectiveTopic.trim() &&
    lessonType &&
    duration &&
    !loading &&
    (!isIntegrated || (!!secondarySubject && secondarySubject !== subject))

  async function handleGenerate() {
    if (!canGenerate) return

    setLoading(true)
    try {
      const res = await fetch("/api/lesson-plans/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          secondary_subject: isIntegrated && secondarySubject ? secondarySubject : null,
          grade,
          topic: effectiveTopic,
          lesson_type: lessonType,
          duration,
          learning_goal: learningGoal || undefined,
          curriculum_context: curriculumContext || undefined,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => null)
        if (res.status === 429) {
          throw new Error(err?.error || "Per daug užklausų. Palaukite minutę ir bandykite vėl.")
        }
        throw new Error(err?.error || "Generavimas nepavyko")
      }

      const data = await res.json()
      const plan = data.lesson_plan

      setEditTitle(plan.title)
      setEditGoal(plan.goal)
      setEditCurriculumLink(plan.curriculum_link)
      setEditTeacherNote(plan.teacher_methodical_note)
      setEditReflection(plan.reflection_prompt)
      setEditCompetencies(plan.competencies ?? [])
      setStages(plan.stages.map((s: LessonStage) => ({ ...s })))
      setRestoredAt(null)
      setPhase("preview")
    } catch (err) {
      toast({
        title: "Generavimas nepavyko",
        description: err instanceof Error ? err.message : "Nežinoma klaida",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  function handleRemoveStage(index: number) {
    setStages((prev) => prev.filter((_, i) => i !== index))
  }

  function handleMoveStage(index: number, direction: "up" | "down") {
    setStages((prev) => {
      const next = [...prev]
      const targetIndex = direction === "up" ? index - 1 : index + 1
      if (targetIndex < 0 || targetIndex >= next.length) return prev
      ;[next[index], next[targetIndex]] = [next[targetIndex], next[index]]
      return next
    })
  }

  function handleUpdateStage(index: number, updated: LessonStage) {
    setStages((prev) => prev.map((a, i) => (i === index ? updated : a)))
  }

  async function handleSave() {
    if (stages.length === 0) return

    setPhase("saving")
    try {
      const res = await fetch("/api/lesson-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle,
          subject,
          secondary_subject: isIntegrated && secondarySubject ? secondarySubject : null,
          grade,
          topic: effectiveTopic,
          lesson_type: lessonType,
          duration,
          goal: editGoal,
          curriculum_link: editCurriculumLink,
          competencies: editCompetencies,
          stages,
          reflection_prompt: editReflection,
          teacher_methodical_note: editTeacherNote,
        }),
      })

      // Session ended: the plan stays on the screen (and in this browser),
      // the notice above the buttons says how to sign in and save again.
      if (session.check(res)) {
        setPhase("preview")
        return
      }
      const data = (await res.json().catch(() => ({}))) as { lesson_plan?: { id: string }; error?: string }
      if (!res.ok || !data.lesson_plan) throw new Error(data.error || "Nepavyko išsaugoti")
      clearPlanDraft(draftKey)

      toast({
        title: "Pamokos planas išsaugotas!",
        description: "Galite jį rasti pamokų planų sąraše.",
      })
      router.push(`/lesson-plans/${data.lesson_plan.id}`)
      router.refresh()
    } catch (err) {
      toast({
        title: "Klaida",
        description: err instanceof Error ? err.message : "Nepavyko išsaugoti",
        variant: "destructive",
      })
      setPhase("preview")
    }
  }

  async function handleConvertToActivity() {
    if (stages.length === 0) return

    setConverting(true)
    try {
      // Save first; the stages that become tasks are chosen on the plan page.
      const saveRes = await fetch("/api/lesson-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle,
          subject,
          secondary_subject: isIntegrated && secondarySubject ? secondarySubject : null,
          grade,
          topic: effectiveTopic,
          lesson_type: lessonType,
          duration,
          goal: editGoal,
          curriculum_link: editCurriculumLink,
          competencies: editCompetencies,
          stages,
          reflection_prompt: editReflection,
          teacher_methodical_note: editTeacherNote,
        }),
      })

      if (session.check(saveRes)) {
        setConverting(false)
        return
      }
      const saveData = (await saveRes.json().catch(() => ({}))) as { lesson_plan?: { id: string }; error?: string }
      if (!saveRes.ok || !saveData.lesson_plan) throw new Error(saveData.error || "Nepavyko išsaugoti")
      clearPlanDraft(draftKey)

      router.push(`/lesson-plans/${saveData.lesson_plan.id}?convert=1`)
    } catch (err) {
      toast({
        title: "Klaida",
        description: err instanceof Error ? err.message : "Nepavyko",
        variant: "destructive",
      })
      setConverting(false)
    }
  }

  function handleRegenerate() {
    clearPlanDraft(draftKey)
    setRestoredAt(null)
    setPhase("input")
    setStages([])
    if (pendingTemplate) {
      applyTemplate(pendingTemplate)
      setPendingTemplate(null)
    }
  }

  // --- Input phase ---
  if (phase === "input") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <Card className="border-border/50 bg-white">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-secondary-ink" />
              Pamokos parametrai
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Subject */}
            <div className="space-y-2">
              <Label htmlFor="lp-subject">
                Dalykas <span className="text-accent-ink" aria-hidden="true">*</span>
              </Label>
              <SubjectCombobox
                id="lp-subject"
                value={subject}
                options={SUBJECTS.map((s) => ({ value: s.id, label: s.label }))}
                placeholder="Pasirinkite dalyką"
                searchPlaceholder="Ieškoti dalyko..."
                emptyText="Dalyko nerasta"
                onChange={(v) => {
                  setSubject(v)
                  setGrade(null)
                  setTopicId("")
                  setSecondarySubject("")
                  setIsIntegrated(false)
                }}
              />
              {subject && (
                <p className="text-xs text-muted-foreground">
                  Dėstoma {getGradesForSubject(subject)[0]}–{getGradesForSubject(subject).slice(-1)[0]} klasėse
                </p>
              )}
            </div>

            {/* Grade — show all grades for selected subject */}
            {subject && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="space-y-2"
              >
                <Label htmlFor="lp-grade">
                  Klasė <span className="text-accent-ink" aria-hidden="true">*</span>
                </Label>
                <Select
                  value={grade?.toString() ?? ""}
                  onValueChange={(v) => {
                    setGrade(parseInt(v, 10))
                    setTopicId("")
                    // Reset secondary subject if it doesn't cover the new grade
                    if (
                      secondarySubject &&
                      !getGradesForSubject(secondarySubject).includes(parseInt(v, 10))
                    ) {
                      setSecondarySubject("")
                    }
                  }}
                >
                  <SelectTrigger id="lp-grade">
                    <SelectValue placeholder="Pasirinkite klasę" />
                  </SelectTrigger>
                  <SelectContent>
                    {getGradesForSubject(subject).map((g) => (
                      <SelectItem key={g} value={g.toString()}>
                        {g} klasė
                        {g <= 4 && " (pradinis ugdymas)"}
                        {g >= 5 && g <= 8 && " (pagrindinis ugdymas)"}
                        {g >= 9 && g <= 10 && " (pagrindinis ugdymas)"}
                        {g >= 11 && " (vidurinis ugdymas)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </motion.div>
            )}

            {/* Integrated STEAM toggle — secondary subject filtered by chosen grade */}
            {subject && grade && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="space-y-3"
              >
                <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/30 p-3">
                  <Switch
                    id="integrated"
                    checked={isIntegrated}
                    onCheckedChange={(v) => {
                      setIsIntegrated(v)
                      if (!v) {
                        setSecondarySubject("")
                      }
                    }}
                  />
                  <Label htmlFor="integrated" className="cursor-pointer text-sm font-normal">
                    <Sparkles className="inline h-3.5 w-3.5 text-accent-ink mr-1" />
                    Integruoti su antru dalyku (STEAM veikla)
                  </Label>
                </div>

                {isIntegrated && (() => {
                  const compatibleSubjects = SUBJECTS.filter(
                    (s) => s.id !== subject && s.grades.includes(grade)
                  )
                  return (
                    <div className="space-y-2">
                      <Label htmlFor="lp-secondary-subject">Antrasis dalykas</Label>
                      {compatibleSubjects.length === 0 ? (
                        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                          <span className="text-base leading-none">⚠️</span>
                          <p>
                            {grade} klasėje nėra kitų dalykų, kuriais būtų galima integruoti su &bdquo;{getSubjectLabel(subject)}&ldquo;.
                          </p>
                        </div>
                      ) : (
                        <>
                          <SubjectCombobox
                            id="lp-secondary-subject"
                            value={secondarySubject}
                            options={compatibleSubjects.map((s) => ({
                              value: s.id,
                              label: s.label,
                            }))}
                            placeholder="Pasirinkite antrą dalyką"
                            searchPlaceholder="Ieškoti dalyko..."
                            emptyText="Dalyko nerasta"
                            onChange={(v) => {
                              setSecondarySubject(v)
                              setTopicId("")
                            }}
                          />
                          <p className="text-xs text-muted-foreground">
                            Rodomi tik dalykai, dėstomi {grade} klasėje
                          </p>
                        </>
                      )}
                    </div>
                  )
                })()}
              </motion.div>
            )}

            {/* Topic */}
            {subject && grade && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="space-y-2"
              >
                <Label htmlFor="lp-topic">
                  Tema <span className="text-accent-ink" aria-hidden="true">*</span>
                </Label>
                {curriculumTopics.length > 0 && (
                  <Select
                    value={topicId}
                    onValueChange={(v) => {
                      setTopicId(v)
                      if (v) {
                        const topic = curriculumTopics.find((t) => t.id === v)
                        if (topic) setCustomTopic(topic.label)
                      }
                    }}
                  >
                    <SelectTrigger id="lp-topic">
                      <SelectValue placeholder="Pasirinkite iš programos arba rašykite žemiau" />
                    </SelectTrigger>
                    <SelectContent>
                      {curriculumTopics.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Input
                  placeholder="Arba įveskite savo temą..."
                  value={customTopic}
                  onChange={(e) => {
                    setCustomTopic(e.target.value)
                    if (e.target.value !== curriculumTopics.find((t) => t.id === topicId)?.label) {
                      setTopicId("")
                    }
                  }}
                />
              </motion.div>
            )}

            {/* Lesson type */}
            <div className="space-y-2">
              <Label htmlFor="lp-type">
                Pamokos tipas <span className="text-accent-ink" aria-hidden="true">*</span>
              </Label>
              <Select value={lessonType} onValueChange={setLessonType}>
                <SelectTrigger id="lp-type">
                  <SelectValue placeholder="Pasirinkite tipą" />
                </SelectTrigger>
                <SelectContent>
                  {LESSON_TYPES.map((lt) => (
                    <SelectItem key={lt.id} value={lt.id}>
                      {lt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Duration */}
            <div className="space-y-2">
              <Label htmlFor="lp-duration">
                Trukmė <span className="text-accent-ink" aria-hidden="true">*</span>
              </Label>
              <Select
                value={duration.toString()}
                onValueChange={(v) => setDuration(parseInt(v, 10))}
              >
                <SelectTrigger id="lp-duration">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DURATIONS.map((d) => (
                    <SelectItem key={d.value} value={d.value.toString()}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Learning goal */}
            <div className="space-y-2">
              <Label htmlFor="lp-goal">
                Mokymosi tikslas{" "}
                <span className="text-muted-foreground font-normal">(neprivaloma)</span>
              </Label>
              <Textarea
                id="lp-goal"
                placeholder="Pvz.: Mokiniai gebės apskaičiuoti trikampio plotą..."
                value={learningGoal}
                onChange={(e) => setLearningGoal(e.target.value)}
                rows={2}
              />
            </div>

            {/* Curriculum context preview */}
            {curriculumContext && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-lg bg-secondary/5 border border-secondary/20 p-3"
              >
                <p className="text-xs font-medium text-secondary-ink mb-1 flex items-center gap-1">
                  <BookOpen className="h-3 w-3" />
                  Programos kontekstas
                </p>
                <p className="text-xs text-muted-foreground whitespace-pre-line">
                  {curriculumContext}
                </p>
              </motion.div>
            )}

            {/* Generate button */}
            <Button
              onClick={handleGenerate}
              disabled={!canGenerate}
              className="w-full bg-secondary-ink hover:bg-secondary-ink/90 text-white gap-2"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generuojamas pamokos planas...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Sugeneruoti pamokos planą
                </>
              )}
            </Button>
            <AiQuotaNote className="text-center" refreshKey={loading} />
          </CardContent>
        </Card>

        {/* Loading: multi-stage status + skeleton */}
        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
              aria-live="polite"
            >
              <GenerationProgress />
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-20 rounded-lg bg-muted/50 animate-pulse border border-border/30"
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    )
  }

  // --- Preview & Edit phase ---
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {restoredAt !== null && (
        <div
          role="status"
          className="flex flex-col gap-3 rounded-lg border border-secondary/30 bg-secondary/5 px-4 py-3 text-sm text-steam-dark sm:flex-row sm:items-center sm:justify-between"
        >
          <p>
            Atkurtas neišsaugotas planas, sugeneruotas{" "}
            {new Date(restoredAt).toLocaleString("lt-LT", {
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "Europe/Vilnius",
            })}
            . Išsaugokite jį arba išmeskite.
            {pendingTemplate && " Išmetus bus įkeltas pasirinktas pavyzdys."}
          </p>
          <Button variant="outline" size="sm" className="shrink-0" onClick={handleRegenerate}>
            Išmesti
          </Button>
        </div>
      )}
      {/* Lesson plan header */}
      <Card className="border-secondary/30 bg-white">
        <CardHeader className="pb-3">
          <div className="flex-1 space-y-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Pamokos pavadinimas</Label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                maxLength={200}
                className="text-lg font-bold border-dashed"
              />
            </div>

            {/* Meta info */}
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span className="bg-secondary/10 text-secondary-ink px-2 py-0.5 rounded-full">
                {getSubjectLabel(subject)}
              </span>
              {isIntegrated && secondarySubject && (
                <span className="bg-accent/10 text-accent-ink px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  {getSubjectLabel(secondarySubject)}
                </span>
              )}
              <span className="bg-secondary/10 text-secondary-ink px-2 py-0.5 rounded-full">
                {grade} klasė
              </span>
              <span className="bg-secondary/10 text-secondary-ink px-2 py-0.5 rounded-full">
                {LESSON_TYPES.find((lt) => lt.id === lessonType)?.label}
              </span>
              <span className="bg-secondary/10 text-secondary-ink px-2 py-0.5 rounded-full">
                {duration} min.
              </span>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Pamokos tikslas</Label>
              <Textarea
                value={editGoal}
                onChange={(e) => setEditGoal(e.target.value)}
                rows={2}
                className="border-dashed"
              />
            </div>
          </div>
        </CardHeader>
        {editCurriculumLink && (
          <CardContent className="pt-0">
            <div className="rounded-lg bg-secondary/5 border border-secondary/20 p-3">
              <p className="text-xs font-medium text-secondary-ink mb-1 flex items-center gap-1">
                <Target className="h-3 w-3" />
                Ryšys su ugdymo programa
              </p>
              <Textarea
                value={editCurriculumLink}
                onChange={(e) => setEditCurriculumLink(e.target.value)}
                rows={2}
                className="border-dashed border-secondary/30 bg-transparent text-sm"
              />
            </div>
          </CardContent>
        )}
      </Card>

      {/* Stages */}
      <div className="space-y-1">
        <h3 className="text-sm font-medium text-steam-dark flex items-center gap-2 mb-3">
          <Clock className="h-4 w-4 text-secondary-ink" />
          Pamokos eiga ({stages.length} veiklos)
        </h3>

        <AnimatePresence>
          {stages.map((stage, index) => (
            <motion.div
              key={`${stage.title}-${index}`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10, height: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <LessonActivityCard
                activity={stage}
                index={index}
                total={stages.length}
                onUpdate={(updated) => handleUpdateStage(index, updated as LessonStage)}
                onRemove={() => handleRemoveStage(index)}
                onMoveUp={() => handleMoveStage(index, "up")}
                onMoveDown={() => handleMoveStage(index, "down")}
              />
            </motion.div>
          ))}
        </AnimatePresence>

        {stages.length === 0 && (
          <Card className="border-dashed border-2 border-border/50">
            <CardContent className="p-8 text-center text-muted-foreground">
              Visos veiklos pašalintos. Generuokite iš naujo.
            </CardContent>
          </Card>
        )}
      </div>

      {/* Reflection */}
      <Card className="border-border/50 bg-white">
        <CardContent className="p-4 space-y-2">
          <Label className="text-xs text-muted-foreground flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            Refleksijos klausimas klasei
          </Label>
          <Textarea
            value={editReflection}
            onChange={(e) => setEditReflection(e.target.value)}
            rows={2}
            className="border-dashed"
          />
        </CardContent>
      </Card>

      {/* Teacher note */}
      <Card className="border-highlight/30 bg-highlight/5">
        <CardContent className="p-4 space-y-2">
          <Label className="text-xs text-highlight-ink flex items-center gap-1">
            <BookOpen className="h-3 w-3" />
            Metodinė pastaba vedėjui
          </Label>
          <Textarea
            value={editTeacherNote}
            onChange={(e) => setEditTeacherNote(e.target.value)}
            rows={3}
            className="border-dashed border-highlight/30"
          />
        </CardContent>
      </Card>

      {/* Actions — lesson plan specific */}
      <div className="flex flex-col gap-3 pt-2">
        {session.expired && (
          <SessionExpiredNotice onRetry={() => void handleSave()} retrying={phase === "saving"} />
        )}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={handleSave}
            disabled={stages.length === 0 || phase === "saving"}
            className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
            size="lg"
          >
            {phase === "saving" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Išsaugoma...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Išsaugoti pamokos planą
              </>
            )}
          </Button>
          <Button
            onClick={handleRegenerate}
            variant="outline"
            size="lg"
            className="gap-2"
            disabled={phase === "saving"}
          >
            <RefreshCw className="h-4 w-4" />
            Generuoti iš naujo
          </Button>
        </div>

        {/* Convert to student activity */}
        <Button
          onClick={handleConvertToActivity}
          disabled={stages.length === 0 || converting || phase === "saving"}
          variant="outline"
          size="lg"
          className="gap-2 border-accent/30 text-accent-ink hover:bg-accent/5"
        >
          {converting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Išsaugoma...
            </>
          ) : (
            <>
              <PlayCircle className="h-4 w-4" />
              Sukurti veiklą dalyviams
            </>
          )}
        </Button>
      </div>
    </motion.div>
  )
}
