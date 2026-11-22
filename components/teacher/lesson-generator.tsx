"use client"

import { useState, useMemo } from "react"
import { AiQuotaNote } from "@/components/teacher/ai-quota-note"
import { useRouter } from "next/navigation"
import { Challenge } from "@/types/game"
import { SUBJECTS, LESSON_TYPES, DURATIONS, getGradesForSubject } from "@/lib/curriculum/subjects"
import { getTopicsForSubjectAndGrade, getCurriculumContext } from "@/lib/curriculum/topics"
import type { GeneratedLesson, LessonActivity } from "@/lib/ai/lesson-types"
import type { VerificationResult } from "@/lib/ai/types"
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
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { useLeaveWarning } from "@/hooks/use-leave-warning"
import { useSessionExpired } from "@/hooks/use-session-expired"
import { SessionExpiredNotice } from "@/components/teacher/session-expired-notice"
import { addFailureReason, partialAddSummary, type AddFailure } from "@/components/teacher/task-add-result"
import { pluralizeLt } from "@/lib/utils"
import { motion, AnimatePresence } from "framer-motion"
import {
  Sparkles,
  Loader2,
  BookOpen,
  Check,
  RefreshCw,
  GraduationCap,
  Clock,
  Target,
  MessageSquare,
  FileText,
  AlertTriangle,
} from "lucide-react"

interface LessonGeneratorProps {
  gameId: string
  gameTitle: string
  gameDescription: string | null
  existingChallenges: Challenge[]
}

type ActivityWithVerification = LessonActivity & {
  verification?: VerificationResult
}

type GeneratedLessonWithVerification = Omit<GeneratedLesson, "activities"> & {
  activities: ActivityWithVerification[]
}

type Phase = "input" | "preview" | "creating"

export function LessonGenerator({
  gameId,
  existingChallenges,
}: LessonGeneratorProps) {
  const router = useRouter()
  const { toast } = useToast()

  // Form state
  const [subject, setSubject] = useState("")
  const [grade, setGrade] = useState<number | null>(null)
  const [topicId, setTopicId] = useState("")
  const [customTopic, setCustomTopic] = useState("")
  const [lessonType, setLessonType] = useState("")
  const [duration, setDuration] = useState<number>(45)
  const [learningGoal, setLearningGoal] = useState("")

  // Generation state
  const [phase, setPhase] = useState<Phase>("input")
  const [loading, setLoading] = useState(false)
  const [lesson, setLesson] = useState<GeneratedLessonWithVerification | null>(null)

  // Editable lesson state
  const [editTitle, setEditTitle] = useState("")
  const [editGoal, setEditGoal] = useState("")
  const [editTeacherNote, setEditTeacherNote] = useState("")
  const [editReflection, setEditReflection] = useState("")
  const [activities, setActivities] = useState<ActivityWithVerification[]>([])
  // The last "add" run: how many tasks were saved and which were not. The
  // ones that failed stay in `activities`, so adding again retries only them.
  const [addedCount, setAddedCount] = useState(0)
  const [failures, setFailures] = useState<AddFailure[]>([])
  const session = useSessionExpired()

  // A generated lesson is minutes of DI work and exists only on this page
  // until its tasks are added: leaving or reloading asks first.
  useLeaveWarning(loading || (phase !== "input" && activities.length > 0))

  // Derived
  const availableGrades = useMemo(() => getGradesForSubject(subject), [subject])
  const curriculumTopics = useMemo(
    () => (subject && grade ? getTopicsForSubjectAndGrade(subject, grade) : []),
    [subject, grade]
  )
  const curriculumContext = useMemo(
    () =>
      subject && grade
        ? getCurriculumContext(subject, grade, topicId || undefined)
        : "",
    [subject, grade, topicId]
  )

  const effectiveTopic = topicId
    ? curriculumTopics.find((t) => t.id === topicId)?.label ?? customTopic
    : customTopic

  const canGenerate =
    subject && grade && effectiveTopic.trim() && lessonType && duration && !loading

  async function handleGenerate() {
    if (!canGenerate) return

    setLoading(true)
    try {
      const res = await fetch("/api/lessons/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          game_id: gameId,
          subject,
          grade,
          topic: effectiveTopic,
          lesson_type: lessonType,
          duration,
          learning_goal: learningGoal || undefined,
          curriculum_context: curriculumContext || undefined,
          existing_challenges: existingChallenges.map((c) => ({
            title: c.title,
            type: c.type,
            points: c.points,
          })),
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.error || "Generavimas nepavyko")
      }

      const data = await res.json()
      const generated = data.lesson as GeneratedLessonWithVerification

      setLesson(generated)
      setEditTitle(generated.title)
      setEditGoal(generated.goal)
      setEditTeacherNote(generated.teacher_note)
      setEditReflection(generated.reflection_question)
      setActivities([...generated.activities])
      setFailures([])
      setAddedCount(0)
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

  function handleRemoveActivity(index: number) {
    setActivities((prev) => prev.filter((_, i) => i !== index))
  }

  function handleMoveActivity(index: number, direction: "up" | "down") {
    setActivities((prev) => {
      const next = [...prev]
      const targetIndex = direction === "up" ? index - 1 : index + 1
      if (targetIndex < 0 || targetIndex >= next.length) return prev
      ;[next[index], next[targetIndex]] = [next[targetIndex], next[index]]
      return next
    })
  }

  function handleUpdateActivity(index: number, updated: ActivityWithVerification) {
    setActivities((prev) => prev.map((a, i) => (i === index ? updated : a)))
  }

  async function handleAddToGame() {
    if (activities.length === 0) return

    setPhase("creating")
    const failed: { activity: ActivityWithVerification; reason: string }[] = []
    let saved = 0
    let sessionEnded = false

    for (const activity of activities) {
      // Once the session has ended every further request fails the same way.
      if (sessionEnded) {
        failed.push({ activity, reason: addFailureReason(401) })
        continue
      }
      try {
        const res = await fetch("/api/challenges", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            game_id: gameId,
            title: activity.title,
            description: activity.description || "",
            type: activity.type,
            points: Number(activity.points) || 100,
            correct_answer: String(activity.correct_answer),
            hints: (activity.hints || []).slice(0, 10),
            options:
              activity.type === "multiple_choice" ? activity.options : null,
            explanation: activity.explanation || null,
            difficulty: activity.difficulty || null,
            generated_by_di: true,
            verification_verdict: activity.verification?.verdict ?? null,
            verification_issues: activity.verification?.issues ?? [],
            verification_confidence: activity.verification?.confidence ?? null,
          }),
        })

        if (res.ok) {
          saved++
          continue
        }
        if (res.status === 401) sessionEnded = true
        const body = (await res.json().catch(() => null)) as { error?: unknown } | null
        failed.push({ activity, reason: addFailureReason(res.status, body?.error) })
      } catch {
        failed.push({ activity, reason: addFailureReason(null) })
      }
    }

    session.check({ status: sessionEnded ? 401 : 200 })
    const totalSaved = addedCount + saved

    if (failed.length === 0) {
      // Everything is saved: nothing is left to lose, so leaving is free.
      setActivities([])
      setFailures([])
      toast({
        title: "Užduotys pridėtos",
        description: `Į veiklą ${pluralizeLt(totalSaved, "pridėta", "pridėtos", "pridėta")} ${totalSaved} ${pluralizeLt(totalSaved, "užduotis", "užduotys", "užduočių")}.`,
      })
      router.push(`/games/${gameId}/builder`)
      router.refresh()
      return
    }

    // Stay here: only the tasks that were not saved remain in the list, each
    // named with its reason, and the button below tries them again.
    setAddedCount(totalSaved)
    setActivities(failed.map((f) => f.activity))
    setFailures(failed.map((f) => ({ title: f.activity.title, reason: f.reason })))
    setPhase("preview")
    toast({
      title: saved > 0 ? "Pridėtos ne visos užduotys" : "Užduočių pridėti nepavyko",
      description: partialAddSummary(totalSaved, failed.length),
      variant: "destructive",
    })
    if (saved > 0) router.refresh()
  }

  function handleRegenerate() {
    setPhase("input")
    setLesson(null)
    setActivities([])
    setFailures([])
    setAddedCount(0)
    session.clear()
  }

  // --- Render ---

  if (phase === "input") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* Activity context */}
        {existingChallenges.length > 0 && (
          <Card className="border-border/50 bg-white">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="h-4 w-4" />
                <span>Veikloje jau yra:</span>
                <Badge variant="outline" className="ml-auto">
                  {existingChallenges.length}{" "}
                  {pluralizeLt(existingChallenges.length, "užduotis", "užduotys", "užduočių")}
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Form */}
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
              <Label>Dalykas</Label>
              <Select
                value={subject}
                onValueChange={(v) => {
                  setSubject(v)
                  setGrade(null)
                  setTopicId("")
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pasirinkite dalyką" />
                </SelectTrigger>
                <SelectContent>
                  {SUBJECTS.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Grade */}
            {subject && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="space-y-2"
              >
                <Label>Klasė</Label>
                <Select
                  value={grade?.toString() ?? ""}
                  onValueChange={(v) => {
                    setGrade(parseInt(v, 10))
                    setTopicId("")
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pasirinkite klasę" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableGrades.map((g) => (
                      <SelectItem key={g} value={g.toString()}>
                        {g} klasė
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </motion.div>
            )}

            {/* Topic */}
            {subject && grade && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="space-y-2"
              >
                <Label>Tema</Label>
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
                    <SelectTrigger>
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
              <Label>Pamokos tipas</Label>
              <Select value={lessonType} onValueChange={setLessonType}>
                <SelectTrigger>
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
              <Label>Trukmė</Label>
              <Select
                value={duration.toString()}
                onValueChange={(v) => setDuration(parseInt(v, 10))}
              >
                <SelectTrigger>
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
              <Label>
                Mokymosi tikslas{" "}
                <span className="text-muted-foreground font-normal">(neprivaloma)</span>
              </Label>
              <Textarea
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
                  Generuojama...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Sugeneruoti pamoką
                </>
              )}
            </Button>
            <AiQuotaNote className="text-center" refreshKey={loading} />
          </CardContent>
        </Card>

        {/* Loading skeleton */}
        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
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
      {/* Lesson header */}
      <Card className="border-secondary/30 bg-white">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Pamokos pavadinimas</Label>
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="text-lg font-bold border-dashed"
                />
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
          </div>
        </CardHeader>
        {lesson?.curriculum_link && (
          <CardContent className="pt-0">
            <div className="rounded-lg bg-secondary/5 border border-secondary/20 p-3">
              <p className="text-xs font-medium text-secondary-ink mb-1 flex items-center gap-1">
                <Target className="h-3 w-3" />
                Programos ryšys
              </p>
              <p className="text-sm text-muted-foreground">
                {lesson.curriculum_link}
              </p>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Activities */}
      <div className="space-y-1">
        <h3 className="text-sm font-medium text-steam-dark flex items-center gap-2 mb-3">
          <Clock className="h-4 w-4 text-secondary-ink" />
          Veiklų seka ({activities.length}{" "}
          {pluralizeLt(activities.length, "veikla", "veiklos", "veiklų")})
        </h3>

        <AnimatePresence>
          {activities.map((activity, index) => (
            <motion.div
              key={`${activity.title}-${index}`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10, height: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <LessonActivityCard
                activity={activity}
                index={index}
                total={activities.length}
                onUpdate={(updated) => handleUpdateActivity(index, updated)}
                onRemove={() => handleRemoveActivity(index)}
                onMoveUp={() => handleMoveActivity(index, "up")}
                onMoveDown={() => handleMoveActivity(index, "down")}
              />
            </motion.div>
          ))}
        </AnimatePresence>

        {activities.length === 0 && phase !== "creating" && (
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

      {/* Result of the last attempt: what was saved, what was not and why */}
      {failures.length > 0 && (
        <div role="alert" className="rounded-lg border border-accent/40 bg-accent/5 p-4 text-sm text-steam-dark">
          <p className="flex items-center gap-2 font-medium text-accent-ink">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            {partialAddSummary(addedCount, failures.length)}
          </p>
          <p className="mt-1">
            {addedCount > 0
              ? "Pridėtos užduotys jau yra veikloje. Sąraše aukščiau liko tik nepridėtos:"
              : "Nė viena užduotis neišsaugota. Jos visos liko sąraše aukščiau:"}
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {failures.map((f, i) => (
              <li key={`${f.title}-${i}`}>
                <span className="font-medium">„{f.title}“</span>: {f.reason}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            Jei reikia, pataisykite užduotį ir spauskite „Bandyti dar kartą“. Bus pridėtos tik šios užduotys.
          </p>
        </div>
      )}
      {session.expired && (
        <SessionExpiredNotice
          onRetry={() => void handleAddToGame()}
          retrying={phase === "creating"}
          retryLabel="Bandyti pridėti dar kartą"
        />
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <Button
          onClick={handleAddToGame}
          disabled={activities.length === 0 || phase === "creating"}
          className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
          size="lg"
        >
          {phase === "creating" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Kuriamos užduotys...
            </>
          ) : (
            <>
              <Check className="h-4 w-4" />
              {failures.length > 0
                ? `Bandyti dar kartą (${activities.length})`
                : `Pridėti užduotis (${activities.length})`}
            </>
          )}
        </Button>
        <Button
          onClick={handleRegenerate}
          variant="outline"
          size="lg"
          className="gap-2"
          disabled={phase === "creating"}
        >
          <RefreshCw className="h-4 w-4" />
          Generuoti iš naujo
        </Button>
      </div>
    </motion.div>
  )
}
