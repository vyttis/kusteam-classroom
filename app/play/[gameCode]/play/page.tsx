"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"
import type { PlayerSession, GameSettings, AchievementType } from "@/types/game"
import { getPlayerSession, clearPlayerSession, savePlayerSession } from "@/lib/game/session"
import { type GameClock, secondsLeft } from "@/lib/game/clock"
import { remapTaskIndex } from "@/lib/game/tasks-version"
import { normalizeNumericAnswer, openedHintCount, sheetKey } from "@/lib/game/play-format"
import { AnnouncementBanner, type AnnouncementItem } from "@/components/player/announcement-banner"
import { AchievementToast } from "@/components/player/achievement-toast"
import { ChallengeGrid } from "@/components/player/challenge-grid"
import { ChallengeDetailModal } from "@/components/player/challenge-detail-modal"
import { LinearTask, type ExtendedSubmissionResult, type PlayerChallenge } from "@/components/player/linear-task"
import {
  PlayEnd,
  PlayHeader,
  PlayLoadError,
  PlayLoading,
  PlayNotReady,
  PlayPaused,
  PlayPreparing,
  PlayReadyToStart,
  TeamFooter,
} from "@/components/player/play-screens"

// Stamp the team's server-side start (idempotent) and return it with the
// pause offset, so the countdown runs on the same deadline the server
// enforces. null when the request fails; the page keeps asking (see the
// effect that confirms the run).
async function stampGameStart(token: string): Promise<{ startedAtMs: number; offsetMs: number } | null> {
  try {
    const res = await fetch("/api/play/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_token: token }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { started_at?: string | null; pause_offset_ms?: number }
    if (!data.started_at) return null
    return { startedAtMs: Date.parse(data.started_at), offsetMs: Number(data.pause_offset_ms ?? 0) }
  } catch {
    return null
  }
}

export default function PlayPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const gameCode = (params.gameCode as string).toUpperCase()

  const [session, setSession] = useState<PlayerSession | null>(null)
  const [challenges, setChallenges] = useState<PlayerChallenge[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answer, setAnswer] = useState("")
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState<ExtendedSubmissionResult | null>(null)
  const [totalPoints, setTotalPoints] = useState(0)
  const [solvedIds, setSolvedIds] = useState<Set<string>>(new Set())
  const [showExplanation, setShowExplanation] = useState(false)
  const [currentExplanation, setCurrentExplanation] = useState<string | null>(null)
  const [gameFinished, setGameFinished] = useState(false)
  const [reflectionDone, setReflectionDone] = useState(false)
  // Live game status: paused shows a full-screen overlay, finished ends the
  // game even mid-play (teacher-ended)
  const [gameStatus, setGameStatus] = useState<string>("active")
  // Marker of the tasks on screen (lib/game/tasks-version.ts): when the
  // status poll reports another one, the facilitator changed a task and the
  // tasks reload in place.
  const tasksVersionRef = useRef<string | null>(null)
  const challengesRef = useRef<PlayerChallenge[]>([])
  const reloadingTasksRef = useRef(false)
  // Latest solved tasks and open task, read by timers and the reload.
  const solvedIdsRef = useRef<Set<string>>(new Set())
  const currentIndexRef = useRef(0)
  const showExplanationRef = useRef(false)
  // The first load finished: only then may a poll start a reload.
  const tasksLoadedRef = useRef(false)
  const [endedByTeacher, setEndedByTeacher] = useState(false)
  const [loadError, setLoadError] = useState(false)
  // Distinguishes "still loading" from "loaded, but the game has no challenges"
  const [stateLoaded, setStateLoaded] = useState(false)
  const [showLeaderboard, setShowLeaderboard] = useState(true)

  // Free mode state
  const [pathMode, setPathMode] = useState<"linear" | "free">("linear")
  const [selectedChallengeIndex, setSelectedChallengeIndex] = useState<number | null>(null)
  const [gameId, setGameId] = useState<string | null>(null)
  // The facilitator's latest fresh announcement, from the status poll.
  const [announcement, setAnnouncement] = useState<AnnouncementItem | null>(null)

  // Achievement state
  const [achievementQueue, setAchievementQueue] = useState<{ type: AchievementType; metadata?: Record<string, unknown> }[]>([])
  const pendingAchievement = achievementQueue.length > 0 ? achievementQueue[0] : null
  const dismissAchievement = () => setAchievementQueue((q) => q.slice(1))

  useEffect(() => {
    challengesRef.current = challenges
    solvedIdsRef.current = solvedIds
    currentIndexRef.current = currentIndex
    showExplanationRef.current = showExplanation
  }, [challenges, solvedIds, currentIndex, showExplanation])

  // Check if reflection already done
  useEffect(() => {
    const stored = localStorage.getItem(`ctf_reflection_${gameCode}`)
    if (stored) setReflectionDone(true)
  }, [gameCode])

  // Timer state. The clock follows lib/game/clock.ts: pauses stop it, and
  // the deadline is the server's (team start + limit + pause time inside
  // the run), corrected for this device's clock.
  const [clock, setClock] = useState<GameClock>({ limitMinutes: null, pausedMs: 0, pausedAt: null })
  const timeLimitMinutes = clock.limitMinutes
  // confirmed: the start and pause offset came from the server. Until then
  // the countdown runs from this device's start and keeps asking.
  const [run, setRun] = useState<{ startedAtMs: number; offsetMs: number; confirmed: boolean } | null>(null)
  const skewMsRef = useRef(0)
  const [gameStarted, setGameStarted] = useState(false)
  // A timed activity sends its tasks only after the server has the team's
  // start; until then the team knows how many there are.
  const [awaitingStart, setAwaitingStart] = useState(false)
  const [taskCount, setTaskCount] = useState(0)
  const [timeExpired, setTimeExpired] = useState(false)
  const [allowAccessRequests, setAllowAccessRequests] = useState(false)
  const [remainingSeconds, setRemainingSeconds] = useState(0)

  const applyClock = useCallback(
    (data: { time_limit_minutes?: number | null; paused_ms?: number | string | null; paused_at?: string | null }) => {
      setClock((c) => ({
        limitMinutes:
          data.time_limit_minutes === undefined
            ? c.limitMinutes
            : typeof data.time_limit_minutes === "number" && data.time_limit_minutes > 0
              ? data.time_limit_minutes
              : null,
        pausedMs: data.paused_ms === undefined || data.paused_ms === null ? c.pausedMs : Number(data.paused_ms) || 0,
        pausedAt: data.paused_at === undefined ? c.pausedAt : data.paused_at,
      }))
    },
    []
  )

  // Timer tick. Keeps running after the time is up, so an extension made
  // while this phone slept brings the team back in.
  useEffect(() => {
    if (!gameStarted || !timeLimitMinutes || !run || gameFinished) return

    function tick() {
      const left = secondsLeft(clock, run!.startedAtMs, run!.offsetMs, Date.now() + skewMsRef.current) ?? 0
      setRemainingSeconds(left)
      setTimeExpired(left <= 0)
    }

    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [gameStarted, timeLimitMinutes, run, clock, gameFinished])

  // Anchor the countdown on the server's start and pause offset. A failed
  // request is retried every few seconds; otherwise a late team that
  // reloaded could keep a countdown that credits pauses from before its
  // start, while the server rejects its answers.
  const sessionToken = session?.session_token
  const runConfirmed = run?.confirmed ?? true
  useEffect(() => {
    if (runConfirmed || !sessionToken || gameFinished) return
    let cancelled = false
    let inFlight = false
    const confirm = async () => {
      if (inFlight) return
      inFlight = true
      const server = await stampGameStart(sessionToken)
      inFlight = false
      if (!cancelled && server) setRun({ ...server, confirmed: true })
    }
    void confirm()
    const interval = setInterval(confirm, 5000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [runConfirmed, sessionToken, gameFinished])

  useEffect(() => {
    const s = getPlayerSession(gameCode)
    if (!s) {
      router.replace(`/play/${gameCode}`)
      return
    }

    setSession(s)
    loadChallenges(s)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameCode, router])

  // The tasks of a timed activity come once the server has the team's start.
  useEffect(() => {
    if (!awaitingStart || !run?.confirmed || !session) return
    void loadChallenges(session)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [awaitingStart, run?.confirmed, session])

  // On the ready screen, another device of the team may press "Pradėti":
  // ask every few seconds, and join its clock as soon as it started.
  useEffect(() => {
    if (!awaitingStart || gameStarted || !session) return
    let busy = false
    const poll = async () => {
      if (busy || document.visibilityState !== "visible") return
      busy = true
      try {
        const res = await fetch(`/api/play/state?game_code=${encodeURIComponent(gameCode)}`, {
          headers: { "x-session-token": session.session_token },
          cache: "no-store",
        })
        if (!res.ok) return
        const state = (await res.json()) as { team_started_at?: string | null; challenge_count?: number }
        if (typeof state.challenge_count === "number") setTaskCount(state.challenge_count)
        if (state.team_started_at) void loadChallenges(session)
      } catch {
        // Network hiccup: the next round retries.
      } finally {
        busy = false
      }
    }
    const interval = setInterval(poll, 5000)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [awaitingStart, gameStarted, session, gameCode])

  async function loadChallenges(s: PlayerSession) {
    // Single round-trip via /api/play/state (game + challenges + solved submissions)
    setLoadError(false)
    let state: {
      game: { id: string; status?: string; settings: GameSettings | null } | null
      challenges: PlayerChallenge[]
      team: { id: string; name: string } | null
      solved: { challenge_id: string; points_awarded: number }[]
      tasks_version?: string | null
      challenge_count?: number
      awaiting_start?: boolean
      team_started_at?: string | null
      team_pause_offset_ms?: number
    }
    try {
      const res = await fetch(
        `/api/play/state?game_code=${encodeURIComponent(gameCode)}`,
        { headers: { "x-session-token": s.session_token } }
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      state = await res.json()
    } catch {
      setLoadError(true)
      return
    }

    if (!state.game) {
      setLoadError(true)
      return
    }

    // Session token no longer matches a team in this game (team deleted,
    // token from another game/device) — without this check every submit 401s
    // with no way out, because the join page redirects back here while any
    // stored session exists.
    if (state.team === null && state.game.status !== "draft") {
      clearPlayerSession(gameCode)
      router.replace(`/play/${gameCode}`)
      return
    }

    // The facilitator may have renamed the team: show the current name.
    if (state.team && state.team.name && state.team.name !== s.team_name) {
      const renamed = { ...s, team_name: state.team.name }
      setSession(renamed)
      try {
        savePlayerSession(gameCode, renamed)
      } catch {
        // Storage blocked: the name still shows for this visit.
      }
    }

    setGameId(state.game.id)
    if (state.game.status) {
      setGameStatus(state.game.status)
      if (state.game.status === "finished") {
        setEndedByTeacher(true)
        setGameFinished(true)
      }
    }

    const settings = state.game.settings
    const timeLimit = settings?.time_limit_minutes ?? null
    applyClock({ time_limit_minutes: timeLimit })
    setPathMode(settings?.challenge_path_mode || "linear")
    setShowLeaderboard(settings?.show_leaderboard !== false)
    setAllowAccessRequests(settings?.allow_access_requests === true)

    const storageKey = `ctf_start_${gameCode}`
    let existingStart: string | null = null
    try {
      existingStart = localStorage.getItem(storageKey)
    } catch {
      // Storage blocked: the server start below still applies.
    }
    if (!timeLimit || existingStart) {
      setGameStarted(true)
      if (timeLimit && existingStart) {
        // Already started on this device: run from the local start until the
        // server answers with the real one (idempotent stamp).
        setRun((r) => r ?? { startedAtMs: parseInt(existingStart!, 10), offsetMs: 0, confirmed: false })
      }
    }
    const serverStart = state.team_started_at ? Date.parse(state.team_started_at) : NaN
    if (timeLimit && Number.isFinite(serverStart)) {
      // The team already started, here or on another device (a rejoin link):
      // its clock runs from the server's start, no "Pradėti" again.
      setGameStarted(true)
      setRun({ startedAtMs: serverStart, offsetMs: state.team_pause_offset_ms ?? 0, confirmed: true })
      try {
        localStorage.setItem(storageKey, String(serverStart))
      } catch {
        // Storage blocked: the server start still applies.
      }
    }
    setAwaitingStart(state.awaiting_start === true)
    setTaskCount(state.challenge_count ?? state.challenges.length)

    setChallenges(state.challenges)
    challengesRef.current = state.challenges
    tasksVersionRef.current = state.tasks_version ?? null

    const solved = new Set(state.solved.map((sub) => sub.challenge_id))
    setSolvedIds(solved)
    solvedIdsRef.current = solved
    const points = state.solved.reduce((sum, sub) => sum + sub.points_awarded, 0)
    setTotalPoints(points)

    const firstUnsolved = state.challenges.findIndex((c) => !solved.has(c.id))
    setCurrentIndex(firstUnsolved >= 0 ? firstUnsolved : state.challenges.length)
    if (state.challenges.length > 0 && firstUnsolved < 0) setGameFinished(true)
    setStateLoaded(true)
    tasksLoadedRef.current = true
  }

  // Open a hint: the server records it (the penalty counts from that row) and
  // returns its text, which stays with the task until the page is closed and
  // comes back with the play state after a reload.
  const revealHint = useCallback(
    async (challengeId: string, index: number): Promise<boolean> => {
      const s = getPlayerSession(gameCode)
      if (!s) return false
      try {
        const res = await fetch("/api/play/hint", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_token: s.session_token, challenge_id: challengeId, hint_index: index }),
        })
        if (!res.ok) return false
        const data = (await res.json()) as { hint?: unknown }
        if (typeof data.hint !== "string") return false
        const text = data.hint
        setChallenges((prev) =>
          prev.map((c) => (c.id === challengeId ? { ...c, hints: c.hints.map((h, i) => (i === index ? text : h)) } : c))
        )
        return true
      } catch {
        return false
      }
    },
    [gameCode]
  )

  // Reload the tasks after the facilitator changed one. Only the tasks are
  // replaced: answers already counted, the timer and the team stay. The open
  // task stays open (found by its id); if it was removed, the team goes to
  // its first unsolved task with an empty answer. A task added after the
  // team finished brings it back to the tasks.
  const reloadTasks = useCallback(async (polledVersion: string) => {
    const s = getPlayerSession(gameCode)
    if (!s || reloadingTasksRef.current) return
    reloadingTasksRef.current = true
    try {
      const res = await fetch(`/api/play/state?game_code=${encodeURIComponent(gameCode)}`, {
        headers: { "x-session-token": s.session_token },
        cache: "no-store",
      })
      if (!res.ok) return
      const state = (await res.json()) as {
        challenges?: PlayerChallenge[]
        solved?: { challenge_id: string; points_awarded?: number }[]
        team?: { total_points?: number } | null
        tasks_version?: string | null
        awaiting_start?: boolean
        challenge_count?: number
      }
      if (typeof state.challenge_count === "number") setTaskCount(state.challenge_count)
      // Tasks held back until the team's start (on the ready screen, or a
      // limit set while the team was already working): keep what it has;
      // its first answer starts the clock on the server.
      if (!Array.isArray(state.challenges) || state.awaiting_start) return
      // Without a marker in the answer (its read failed), keep the polled
      // one: the tasks are now at least that new, and change detection goes on.
      tasksVersionRef.current = state.tasks_version ?? polledVersion
      const prev = challengesRef.current
      const next = state.challenges
      if (JSON.stringify(prev) === JSON.stringify(next)) return

      // Solved: what the server counted plus what this page solved meanwhile,
      // only for tasks that still exist.
      const ids = new Set(next.map((c) => c.id))
      const solved = new Set<string>()
      for (const sub of state.solved ?? []) if (ids.has(sub.challenge_id)) solved.add(sub.challenge_id)
      solvedIdsRef.current.forEach((id) => {
        if (ids.has(id)) solved.add(id)
      })
      const firstUnsolved = next.findIndex((c) => !solved.has(c.id))
      const kept = remapTaskIndex(prev, next, currentIndexRef.current)

      challengesRef.current = next
      solvedIdsRef.current = solved
      setChallenges(next)
      setSolvedIds(solved)
      // Answers counted elsewhere (the same team on another device) bring
      // their points; the score never goes down here, so an answer this page
      // is still sending keeps its points too.
      const serverPoints =
        typeof state.team?.total_points === "number"
          ? state.team.total_points
          : (state.solved ?? []).reduce((sum, sub) => sum + (sub.points_awarded ?? 0), 0)
      setTotalPoints((points) => Math.max(points, serverPoints))
      // The open task changed what an answer looks like (type or choices):
      // a typed or selected answer no longer fits, so it is cleared.
      const before = prev[currentIndexRef.current]
      const after = kept !== null ? next[kept] : undefined
      const shapeChanged =
        before !== undefined &&
        after !== undefined &&
        (before.type !== after.type || JSON.stringify(before.options) !== JSON.stringify(after.options))
      // The open task was solved elsewhere (the same team on another device)
      // and nothing here is showing its result: move on like after a solve.
      const keptSolvedElsewhere =
        kept !== null && solved.has(next[kept].id) && !showExplanationRef.current && firstUnsolved >= 0
      if (kept !== null && !keptSolvedElsewhere) {
        setCurrentIndex(kept)
        currentIndexRef.current = kept
        if (shapeChanged) {
          setAnswer("")
          setFeedback(null)
        }
      } else {
        const index = firstUnsolved >= 0 ? firstUnsolved : next.length
        setCurrentIndex(index)
        currentIndexRef.current = index
        setAnswer("")
        setFeedback(null)
        setShowExplanation(false)
        setCurrentExplanation(null)
      }
      setSelectedChallengeIndex((i) => remapTaskIndex(prev, next, i))
      // Every task solved (perhaps on another device, or an answer whose
      // reply was lost): finish, unless the team is reading an explanation,
      // whose "Toliau" finishes it.
      if (firstUnsolved >= 0) setGameFinished(false)
      else if (next.length > 0 && (kept === null || !showExplanationRef.current)) setGameFinished(true)
      toast({ title: "Vedėjas atnaujino užduotis", description: "Matote naujausią jų versiją." })
    } catch {
      // The next poll that still sees a new marker tries again.
    } finally {
      reloadingTasksRef.current = false
    }
  }, [gameCode, toast])

  // Linear mode moves on to the first task not solved yet, so a task added
  // during the activity is reached wherever it sits in the list.
  const goToNextTask = useCallback(() => {
    const list = challengesRef.current
    const next = list.findIndex((c) => !solvedIdsRef.current.has(c.id))
    if (next >= 0) {
      setCurrentIndex(next)
    } else {
      setCurrentIndex(list.length)
      setGameFinished(true)
    }
  }, [])

  // Status polling: participants cannot read the activity with the anon key
  // (20261107120000), so pauses, more time, task edits and announcements
  // reach the page through /api/play/status.
  // 5 s keeps a teacher's pause visible to participants almost at once;
  // the request is a tiny status read, and it also re-runs when the tab
  // becomes visible again (phones suspend timers in the background).
  useEffect(() => {
    // A team that solved everything keeps polling, so a task added later
    // reaches it; once the facilitator ends the activity, polling stops.
    if (endedByTeacher) return

    // One request at a time: overlapping polls could finish out of order and
    // an older "active" would hide the pause overlay. A hung request is cut
    // off so it cannot block the next polls.
    let inFlight = false
    let disposed = false
    const checkStatus = async () => {
      if (inFlight) return
      inFlight = true
      const sentAt = Date.now()
      try {
        const res = await fetch(
          `/api/play/status?game_code=${encodeURIComponent(gameCode)}`,
          {
            cache: "no-store",
            // AbortSignal.timeout is missing on older phones (iOS < 16)
            signal: typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(8000) : undefined,
          }
        )
        if (!res.ok) return
        const data = (await res.json()) as {
          status: string | null
          allow_access_requests?: boolean
          time_limit_minutes?: number | null
          paused_ms?: number
          paused_at?: string | null
          now?: string
          tasks_version?: string | null
          announcement?: AnnouncementItem | null
        }
        if (disposed || !data.status) return
        // Clock correction: the server's time is compared with the middle of
        // the round trip, and only from a quick one, so network delay or a
        // suspended tab is not mistaken for this device's clock being off.
        const receivedAt = Date.now()
        const serverNow = data.now ? Date.parse(data.now) : NaN
        if (Number.isFinite(serverNow) && receivedAt - sentAt < 2000) {
          skewMsRef.current = serverNow - (sentAt + receivedAt) / 2
        }
        applyClock(data)
        setGameStatus(data.status)
        if (typeof data.allow_access_requests === "boolean") setAllowAccessRequests(data.allow_access_requests)
        if (data.announcement !== undefined) setAnnouncement(data.announcement)
        if (data.status === "finished") {
          setEndedByTeacher(true)
          setGameFinished(true)
        } else if (
          data.tasks_version &&
          tasksLoadedRef.current &&
          data.tasks_version !== tasksVersionRef.current
        ) {
          // Also when the page has no marker yet (its read failed): the
          // reload brings the tasks and the marker.
          void reloadTasks(data.tasks_version)
        }
      } catch {
        // Network hiccup or timeout: the next poll retries
      } finally {
        inFlight = false
      }
    }

    void checkStatus()
    const interval = setInterval(checkStatus, 5000)
    const onVisible = () => {
      if (document.visibilityState === "visible") void checkStatus()
    }
    document.addEventListener("visibilitychange", onVisible)

    return () => {
      disposed = true
      clearInterval(interval)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [gameCode, endedByTeacher, applyClock, reloadTasks])

  function handleStart() {
    const storageKey = `ctf_start_${gameCode}`
    const now = Date.now()
    try {
      localStorage.setItem(storageKey, now.toString())
    } catch {
      // Storage blocked: the server start still anchors the deadline.
    }
    // The server-side start is stamped by the effect that confirms the run.
    setRun({ startedAtMs: now + skewMsRef.current, offsetMs: clock.pausedMs, confirmed: false })
    setGameStarted(true)
  }

  // Free mode: handle submission from challenge detail modal
  async function handleFreeSubmit(submittedAnswer: string, hintsUsed: number): Promise<{ is_correct: boolean; points_awarded: number; message: string; explanation?: string | null }> {
    if (!session || selectedChallengeIndex === null) {
      return { is_correct: false, points_awarded: 0, message: "Klaida" }
    }
    const challenge = challenges[selectedChallengeIndex]
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_token: session.session_token,
          challenge_id: challenge.id,
          answer:
            challenge.type === "number"
              ? normalizeNumericAnswer(submittedAnswer)
              : submittedAnswer.trim(),
          hints_used: hintsUsed,
        }),
      })

      if (res.status === 429) {
        return { is_correct: false, points_awarded: 0, message: "Per daug bandymų. Palaukite minutę." }
      }

      // Error responses carry { error } — surface the message instead of an
      // empty red feedback box; a dead session gets a way out.
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null
        if (res.status === 401) {
          clearPlayerSession(gameCode)
          router.replace(`/play/${gameCode}`)
        }
        return {
          is_correct: false,
          points_awarded: 0,
          message: err?.error || "Nepavyko pateikti atsakymo. Bandykite dar kartą.",
        }
      }

      const result: ExtendedSubmissionResult & {
        achievements?: { type: AchievementType; metadata?: Record<string, unknown> }[]
        total_points?: number
      } = await res.json()

      if (result.is_correct) {
        setTotalPoints(result.total_points || totalPoints + result.points_awarded)
        setSolvedIds((prev) => {
          const next = new Set(Array.from(prev))
          next.add(challenge.id)
          return next
        })
        // Show achievement if earned
        if (result.achievements && result.achievements.length > 0) {
          const earned = result.achievements
          setAchievementQueue((q) => [...q, ...earned])
        }
        // Check if all solved (tasks as they are now, this one included)
        const solvedNow = new Set(solvedIdsRef.current)
        solvedNow.add(challenge.id)
        if (challengesRef.current.every((c) => solvedNow.has(c.id))) {
          setTimeout(() => {
            // A task added in these two seconds keeps the team playing.
            if (!challengesRef.current.every((c) => solvedIdsRef.current.has(c.id))) return
            setSelectedChallengeIndex(null)
            setGameFinished(true)
          }, 2000)
        }
      }

      return result
    } catch {
      return { is_correct: false, points_awarded: 0, message: "Tinklo klaida. Bandykite dar kartą." }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // Close the phone keyboard so the result below the button is visible.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    if (!answer.trim() || !session || !challenges[currentIndex] || timeExpired) return

    setLoading(true)
    setFeedback(null)
    const task = challenges[currentIndex]

    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_token: session.session_token,
          challenge_id: task.id,
          answer:
            task.type === "number"
              ? normalizeNumericAnswer(answer)
              : answer.trim(),
          hints_used: openedHintCount(challenges[currentIndex]),
        }),
      })

      if (res.status === 429) {
        toast({
          title: "Per daug bandymų",
          description: "Palaukite minutę ir bandykite dar kartą.",
          variant: "destructive",
        })
        setLoading(false)
        return
      }

      // Error responses carry { error }, not a SubmissionResult — showing
      // them as feedback rendered an empty red box with no message.
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null
        if (res.status === 401) {
          clearPlayerSession(gameCode)
          router.replace(`/play/${gameCode}`)
          return
        }
        toast({
          title: "Nepavyko pateikti atsakymo",
          description: err?.error || "Bandykite dar kartą.",
          variant: "destructive",
        })
        setLoading(false)
        return
      }

      const result: ExtendedSubmissionResult & {
        achievements?: { type: AchievementType; metadata?: Record<string, unknown> }[]
      } = await res.json()

      // A reload may have replaced the open task while the answer was on its
      // way: the points still count, but the result belongs to that task,
      // not to the one now on screen.
      if (challengesRef.current[currentIndexRef.current]?.id !== task.id) {
        if (result.is_correct) {
          setTotalPoints((points) => Math.max(points, result.total_points ?? points + result.points_awarded))
          if (challengesRef.current.some((c) => c.id === task.id)) {
            setSolvedIds((prev) => new Set(prev).add(task.id))
          }
        }
        return
      }
      setFeedback(result)

      // Show achievement toast if earned
      if (result.achievements && result.achievements.length > 0) {
        const earned = result.achievements
        setAchievementQueue((q) => [...q, ...earned])
      }

      if (result.is_correct) {
        setTotalPoints(result.total_points || totalPoints + result.points_awarded)
        setSolvedIds((prev) => {
          const next = new Set(Array.from(prev))
          next.add(task.id)
          return next
        })
        setAnswer("")

        // Show explanation if available
        if (result.explanation) {
          setCurrentExplanation(result.explanation)
          setShowExplanation(true)
          // Don't auto-advance — wait for user to click "Toliau"
        } else {
          setTimeout(() => {
            setFeedback(null)
            goToNextTask()
          }, 2000)
        }
      }
    } catch {
      toast({
        title: "Klaida",
        description: "Nepavyko pateikti atsakymo",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const rejoin = () => {
    clearPlayerSession(gameCode)
    router.replace(`/play/${gameCode}`)
  }

  // Load error state (network failure or game unavailable)
  if (loadError) {
    return <PlayLoadError onRetry={() => session && loadChallenges(session)} onRejoin={rejoin} />
  }

  // Loading state
  if (!session || !stateLoaded) {
    return <PlayLoading />
  }

  // "Pradėti" pressed, the tasks are on their way (they follow the server's
  // start; the page keeps asking until it has it).
  if (awaitingStart && gameStarted && gameStatus !== "draft") {
    return <PlayPreparing />
  }

  // The game was reverted to draft, or has no challenges (e.g. the teacher
  // deleted them mid-game) — an explicit message instead of a forever-spinner.
  if (gameStatus === "draft" || (challenges.length === 0 && !gameFinished && !awaitingStart)) {
    return <PlayNotReady draft={gameStatus === "draft"} onRefresh={() => session && loadChallenges(session)} />
  }

  // Paused by the teacher — full-screen overlay until the game resumes
  if (gameStatus === "paused" && !gameFinished) {
    return <PlayPaused gameId={gameId} announcement={announcement} totalPoints={totalPoints} teamName={session.team_name} />
  }

  const endProps = {
    solved: solvedIds.size,
    total: challenges.length,
    totalPoints,
    teamName: session.team_name,
    gameCode,
    sessionToken: session.session_token,
    challenges: challenges.map((c) => ({ id: c.id, title: c.title })),
    showLeaderboard,
    showReflection: !reflectionDone,
    // The form shows its own "Refleksija išsaugota" (or nothing after
    // "Praleisti"); hiding it here unmounted that confirmation at once. A
    // reload still hides it (reflectionDone is read from storage).
    onReflectionDone: () => {},
    allowAccessRequests,
  }

  // Time expired screen
  if (timeExpired && !gameFinished) {
    return <PlayEnd reason="time_up" {...endProps} />
  }

  // "Ready to start?" screen (only when time limit exists and not yet started)
  if (timeLimitMinutes && !gameStarted) {
    return (
      <PlayReadyToStart
        minutes={timeLimitMinutes}
        taskCount={taskCount}
        teamName={session.team_name}
        onStart={handleStart}
      />
    )
  }

  // Game finished screen
  if (gameFinished) {
    const reason = endedByTeacher && solvedIds.size < challenges.length ? "ended_by_facilitator" : "all_solved"
    return <PlayEnd reason={reason} {...endProps} />
  }

  const header = (
    <PlayHeader
      gameCode={gameCode}
      totalPoints={totalPoints}
      timeLimitMinutes={timeLimitMinutes}
      remainingSeconds={remainingSeconds}
      showLeaderboard={showLeaderboard}
    />
  )
  const banners = (
    <>
      {/* Announcement banner */}
      {gameId && <AnnouncementBanner gameId={gameId} latest={announcement} />}

      {/* Achievement toast */}
      {pendingAchievement && (
        <AchievementToast
          achievement={pendingAchievement}
          onDismiss={dismissAchievement}
        />
      )}
    </>
  )

  // Free mode: show challenge grid
  if (pathMode === "free") {
    const selected = selectedChallengeIndex !== null ? challenges[selectedChallengeIndex] : undefined
    return (
      <div className="min-h-screen p-4 pb-8">
        <div className="max-w-2xl mx-auto">
          {banners}
          {header}

          <ChallengeGrid
            challenges={challenges}
            solvedIds={solvedIds}
            onSelectChallenge={(index) => setSelectedChallengeIndex(index)}
          />

          <ChallengeDetailModal
            key={sheetKey(selected)}
            challenge={selected ?? null}
            open={selectedChallengeIndex !== null}
            onOpenChange={(open) => { if (!open) setSelectedChallengeIndex(null) }}
            onSubmit={handleFreeSubmit}
            isSolved={selected ? solvedIds.has(selected.id) : false}
            onRevealHint={(idx) => (selected ? revealHint(selected.id, idx) : Promise.resolve(false))}
          />

          <TeamFooter teamName={session.team_name} onLeave={rejoin} className="mt-4" />
        </div>
      </div>
    )
  }

  const currentChallenge = challenges[currentIndex]
  const progressValue = (solvedIds.size / challenges.length) * 100

  return (
    <div className="min-h-screen p-4 pb-8">
      <div className="max-w-lg mx-auto">
        {banners}
        {header}

        {/* Progress */}
        <div className="mb-6">
          <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
            <span>Užduotis {currentIndex + 1} iš {challenges.length}</span>
            <span>{solvedIds.size} išspręsta</span>
          </div>
          <Progress value={Math.round(progressValue)} className="h-2" aria-label="Išspręstos užduotys" />
        </div>

        <LinearTask
          challenge={currentChallenge}
          index={currentIndex}
          answer={answer}
          onAnswerChange={setAnswer}
          loading={loading}
          feedback={feedback}
          explanation={showExplanation ? currentExplanation : null}
          onSubmit={handleSubmit}
          onRevealHint={(index) => revealHint(currentChallenge.id, index)}
          onNext={() => {
            setFeedback(null)
            setShowExplanation(false)
            setCurrentExplanation(null)
            goToNextTask()
          }}
        />

        <TeamFooter teamName={session.team_name} onLeave={rejoin} />
      </div>
    </div>
  )
}
