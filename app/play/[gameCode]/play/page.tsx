"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import type { PlayerSession, GameSettings, AchievementType } from "@/types/game"
import { getPlayerSession, clearPlayerSession, readStored, savePlayerSession } from "@/lib/game/session"
import { ConnectionBanner, loadRetryDelayMs, useConnection } from "@/components/player/connection"
import { type GameClock, secondsLeft, serverNowMs } from "@/lib/game/clock"
import { remapTaskIndex } from "@/lib/game/tasks-version"
import { normalizeNumericAnswer, openedHintCount, sheetKey } from "@/lib/game/play-format"
import { AnnouncementBanner, type AnnouncementItem } from "@/components/player/announcement-banner"
import { AchievementToast } from "@/components/player/achievement-toast"
import { ChallengeGrid } from "@/components/player/challenge-grid"
import { ChallengeDetailModal } from "@/components/player/challenge-detail-modal"
import type { AnswerNotice } from "@/components/player/answer-feedback"
import { taskSegments } from "@/components/player/play-progress"
import { SCREEN, SegmentedProgress } from "@/components/player/play-ui"
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
  PlaySessionMoved,
  TeamFooter,
} from "@/components/player/play-screens"

// Stamp the team's server-side start (idempotent) and return it with the
// pause offset, so the countdown runs on the same deadline the server
// enforces. null when the request fails; the page keeps asking (see the
// effect that confirms the run). "no-team": the server does not know this
// session (the team was removed, or moved to another device).
async function stampGameStart(
  token: string
): Promise<{ startedAtMs: number; offsetMs: number } | "no-team" | null> {
  try {
    const res = await fetch("/api/play/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_token: token }),
    })
    if (res.status === 404) return "no-team"
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
  // Wrong answers so far (each one shakes the field), and the reply to an
  // answer that was not checked at all (time over, pause, no connection).
  const [wrongAttempts, setWrongAttempts] = useState(0)
  const [notice, setNotice] = useState<AnswerNotice | null>(null)
  // One answer on its way at a time, whatever the button's state says.
  const submittingRef = useRef(false)
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
  // The facilitator's rejoin link moved this team to another device: its
  // name, shown on the screen that says so (null: not moved).
  const [movedTeamName, setMovedTeamName] = useState<string | null>(null)
  // Raised when a request finds no team for this session: the state is read
  // again, which tells a moved or removed team from a failed read.
  const [sessionCheck, setSessionCheck] = useState(0)
  // Automatic retries of a failed load made so far (components/player/connection.tsx).
  const [loadRetries, setLoadRetries] = useState(0)
  // "No connection" notice: two failed status polls in a row, or the browser
  // says it is offline; the first poll that gets through removes it.
  const { offline, report: reportPoll } = useConnection()
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
    if (readStored(`ctf_reflection_${gameCode}`)) setReflectionDone(true)
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
    if (runConfirmed || !sessionToken || gameFinished || movedTeamName !== null) return
    let cancelled = false
    let inFlight = false
    const confirm = async () => {
      if (inFlight) return
      inFlight = true
      const server = await stampGameStart(sessionToken)
      inFlight = false
      if (cancelled) return
      if (server === "no-team") setSessionCheck((n) => n + 1)
      else if (server) setRun({ ...server, confirmed: true })
    }
    void confirm()
    const interval = setInterval(confirm, 5000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [runConfirmed, sessionToken, gameFinished, movedTeamName])

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

  // A request found no team for this session: read the state again.
  useEffect(() => {
    if (sessionCheck === 0 || !session || movedTeamName !== null) return
    void loadChallenges(session, true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionCheck])

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
          headers: { "x-session-token": session.session_token, "x-team-id": session.team_id },
          cache: "no-store",
        })
        if (!res.ok) return
        const state = (await res.json()) as {
          team_started_at?: string | null
          challenge_count?: number
          session_moved?: boolean
        }
        if (typeof state.challenge_count === "number") setTaskCount(state.challenge_count)
        if (state.team_started_at || state.session_moved) void loadChallenges(session, state.session_moved === true)
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

  // quiet: an automatic retry from the error screen, which stays up until
  // the load succeeds instead of flashing the spinner.
  async function loadChallenges(s: PlayerSession, quiet = false) {
    // Single round-trip via /api/play/state (game + challenges + solved submissions)
    if (!quiet) setLoadError(false)
    type PlayState = {
      game: { id: string; status?: string; settings: GameSettings | null } | null
      challenges: PlayerChallenge[]
      team: { id: string; name: string } | null
      solved: { challenge_id: string; points_awarded: number }[]
      tasks_version?: string | null
      challenge_count?: number
      awaiting_start?: boolean
      team_started_at?: string | null
      team_pause_offset_ms?: number
      /** The team continues on another device (a rejoin link was used). */
      session_moved?: boolean
    }
    const fetchState = async (): Promise<PlayState | null> => {
      try {
        const res = await fetch(
          `/api/play/state?game_code=${encodeURIComponent(gameCode)}`,
          { headers: { "x-session-token": s.session_token, "x-team-id": s.team_id }, cache: "no-store" }
        )
        if (!res.ok) return null
        return (await res.json()) as PlayState
      } catch {
        return null
      }
    }

    let state = await fetchState()
    if (!state || !state.game) {
      setLoadError(true)
      return
    }

    // Session token no longer matches a team in this game (team deleted,
    // token from another game/device) — without this check every submit 401s
    // with no way out, because the join page redirects back here while any
    // stored session exists. Dropping the session locks the team out of its
    // name, so the server is asked a second time first: one answer without
    // the team may be a failed read, not a missing team.
    if (state.team === null && state.game.status !== "draft") {
      const again = await fetchState()
      if (!again || !again.game) {
        setLoadError(true)
        return
      }
      if (again.team === null && again.game.status !== "draft") {
        clearPlayerSession(gameCode)
        // Moved to another device by the facilitator's rejoin link: say so
        // here. A removed team goes back to the join page.
        if (again.session_moved) setMovedTeamName(s.team_name || "")
        else router.replace(`/play/${gameCode}`)
        return
      }
      state = again
    }
    if (!state.game) return // always set here; narrows the type
    setLoadError(false)
    setLoadRetries(0)

    // The facilitator may have renamed the team: show the current name.
    if (state.team && state.team.name && state.team.name !== s.team_name) {
      const renamed = { ...s, team_name: state.team.name }
      setSession(renamed)
      // If storage is blocked, the name still shows for this visit.
      savePlayerSession(gameCode, renamed)
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

  // The load-error screen retries by itself a few times, further and further
  // apart, and at once when the browser says the network is back. The
  // session is never dropped here: a Wi-Fi blip must not cost the team its
  // place (its name would then be "already taken").
  const retriesLeft = loadError && loadRetryDelayMs(loadRetries) !== null
  useEffect(() => {
    if (!loadError || !session) return
    const delay = loadRetryDelayMs(loadRetries)
    const retry = () => void loadChallenges(session, true)
    window.addEventListener("online", retry)
    const timer =
      delay === null
        ? null
        : setTimeout(() => {
            setLoadRetries((n) => n + 1)
            retry()
          }, delay)
    return () => {
      window.removeEventListener("online", retry)
      if (timer) clearTimeout(timer)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadError, loadRetries, session])

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
        // 401: the server did not find the team; the state is read again.
        if (res.status === 401) setSessionCheck((n) => n + 1)
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
        headers: { "x-session-token": s.session_token, "x-team-id": s.team_id },
        cache: "no-store",
      })
      if (!res.ok) return
      const state = (await res.json()) as {
        session_moved?: boolean
        challenges?: PlayerChallenge[]
        solved?: { challenge_id: string; points_awarded?: number }[]
        team?: { total_points?: number } | null
        tasks_version?: string | null
        awaiting_start?: boolean
        challenge_count?: number
      }
      if (state.session_moved) {
        setSessionCheck((n) => n + 1)
        return
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
          setNotice(null)
        }
      } else {
        const index = firstUnsolved >= 0 ? firstUnsolved : next.length
        setCurrentIndex(index)
        currentIndexRef.current = index
        setAnswer("")
        setFeedback(null)
        setNotice(null)
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
        if (!res.ok) {
          if (!disposed) reportPoll(false)
          return
        }
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
        if (disposed) return
        reportPoll(true)
        if (!data.status) return
        // Clock correction: the server's time is compared with the middle of
        // the round trip, and only from a quick one, so network delay or a
        // suspended tab is not mistaken for this device's clock being off.
        const receivedAt = Date.now()
        // An answer shared by the CDN is up to 2 s old: Age adds it back.
        const serverNow = serverNowMs(data.now, res.headers.get("age"))
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
        // Network hiccup or timeout: the next poll retries; two in a row
        // show the "no connection" notice.
        if (!disposed) reportPoll(false)
      } finally {
        inFlight = false
      }
    }

    void checkStatus()
    const interval = setInterval(checkStatus, 5000)
    const onVisible = () => {
      if (document.visibilityState === "visible") void checkStatus()
    }
    // The network is back: ask at once, so the notice goes away.
    const onOnline = () => void checkStatus()
    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("online", onOnline)

    return () => {
      disposed = true
      clearInterval(interval)
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("online", onOnline)
    }
  }, [gameCode, endedByTeacher, applyClock, reloadTasks, reportPoll])

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
  // An answer that was not checked comes back with `notice`, so the sheet
  // does not show it as a wrong answer.
  async function handleFreeSubmit(
    submittedAnswer: string,
    hintsUsed: number
  ): Promise<ExtendedSubmissionResult & { notice?: AnswerNotice["kind"] }> {
    if (!session || selectedChallengeIndex === null) {
      return { is_correct: false, points_awarded: 0, message: "Nepavyko pateikti atsakymo. Bandykite dar kartą.", notice: "connection" }
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
        return { is_correct: false, points_awarded: 0, message: "Per daug bandymų. Palaukite minutę.", notice: "wait" }
      }

      // Error responses carry { error } — surface the message instead of an
      // empty red feedback box; a dead session gets a way out.
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null
        // 401: the server did not find the team. The reload asks again and
        // drops the session only when the team is really gone.
        if (res.status === 401) void loadChallenges(session, true)
        return {
          is_correct: false,
          points_awarded: 0,
          message:
            (res.status !== 401 && err?.error) || "Nepavyko pateikti atsakymo. Bandykite dar kartą.",
          notice: res.status === 403 ? "wait" : "connection",
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
          // The sheet shows the result; closing it ends the activity
          // (closeFreeTask), so the team is not pulled away while reading.
        }
      }

      return result
    } catch {
      return {
        is_correct: false,
        points_awarded: 0,
        message: "Nepavyko pateikti atsakymo. Patikrinkite interneto ryšį ir bandykite dar kartą.",
        notice: "connection",
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submittingRef.current) return
    if (!answer.trim() || !session || !challenges[currentIndex] || timeExpired) return

    submittingRef.current = true
    setLoading(true)
    setFeedback(null)
    setNotice(null)
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
        setNotice({
          kind: "wait",
          title: "Per daug bandymų",
          text: "Palaukite minutę ir bandykite dar kartą.",
        })
        return
      }

      // Error responses carry { error }, not a SubmissionResult: the answer
      // was not checked, so it is not shown as a wrong one.
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null
        // 401: the server did not find the team. The reload asks again and
        // drops the session only when the team is really gone.
        if (res.status === 401) void loadChallenges(session, true)
        setNotice({
          // 403: paused, finished or out of time; nothing is broken.
          kind: res.status === 403 ? "wait" : "connection",
          title: res.status === 403 ? "Atsakymas nepriimtas" : "Nepavyko pateikti atsakymo",
          text: (res.status !== 401 && err?.error) || "Bandykite dar kartą.",
        })
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
        // The form goes away: close the phone keyboard with it.
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
        setTotalPoints(result.total_points || totalPoints + result.points_awarded)
        setSolvedIds((prev) => {
          const next = new Set(Array.from(prev))
          next.add(task.id)
          return next
        })
        setAnswer("")

        // With an explanation the team reads it and presses the button;
        // without one the result moves on by itself (LinearTask).
        if (result.explanation) {
          setCurrentExplanation(result.explanation)
          setShowExplanation(true)
        }
      } else {
        // The typed answer stays; LinearTask shakes the field and selects it.
        setWrongAttempts((n) => n + 1)
      }
    } catch {
      setNotice({
        kind: "connection",
        title: "Nepavyko pateikti atsakymo",
        text: "Patikrinkite interneto ryšį ir bandykite dar kartą.",
      })
    } finally {
      submittingRef.current = false
      setLoading(false)
    }
  }

  // Editing the answer after a wrong one starts a new attempt: the note and
  // the mark on the wrong choice go away.
  function changeAnswer(value: string) {
    setAnswer(value)
    setNotice(null)
    setFeedback((current) => (current && !current.is_correct ? null : current))
  }

  // Free mode: the sheet closed. If that was the last task, finish.
  function closeFreeTask() {
    setSelectedChallengeIndex(null)
    const list = challengesRef.current
    if (list.length > 0 && list.every((c) => solvedIdsRef.current.has(c.id))) setGameFinished(true)
  }

  // Only from "Išeiti" in the footer, which asks first (LeaveTeamButton):
  // leaving drops the team's session on this device.
  const leaveTeam = () => {
    clearPlayerSession(gameCode)
    router.replace(`/play/${gameCode}`)
  }

  // The team continues on another device: nothing else applies here.
  if (movedTeamName !== null) {
    return <PlaySessionMoved teamName={movedTeamName} gameCode={gameCode} />
  }

  // Load error state (network failure or game unavailable). The screen says
  // what is wrong itself, so no connection notice on top of it.
  if (loadError) {
    return (
      <PlayLoadError
        retrying={retriesLeft}
        onRetry={() => {
          if (!session) return
          setLoadRetries(0)
          void loadChallenges(session)
        }}
      />
    )
  }

  // Every other state carries the "no connection" notice. It sits in the
  // same place of each return, so its live region stays mounted.
  const withConnection = (screen: React.ReactNode) => (
    <>
      {screen}
      <ConnectionBanner offline={offline} />
    </>
  )

  // Loading state
  if (!session || !stateLoaded) {
    return withConnection(<PlayLoading />)
  }

  // "Pradėti" pressed, the tasks are on their way (they follow the server's
  // start; the page keeps asking until it has it).
  if (awaitingStart && gameStarted && gameStatus !== "draft") {
    return withConnection(<PlayPreparing />)
  }

  // The game was reverted to draft, or has no challenges (e.g. the teacher
  // deleted them mid-game) — an explicit message instead of a forever-spinner.
  if (gameStatus === "draft" || (challenges.length === 0 && !gameFinished && !awaitingStart)) {
    return withConnection(
      <PlayNotReady draft={gameStatus === "draft"} onRefresh={() => session && loadChallenges(session)} />
    )
  }

  // Paused by the teacher — full-screen overlay until the game resumes
  if (gameStatus === "paused" && !gameFinished) {
    return withConnection(
      <PlayPaused gameId={gameId} announcement={announcement} totalPoints={totalPoints} teamName={session.team_name} />
    )
  }

  const endProps = {
    solved: solvedIds.size,
    total: challenges.length,
    totalPoints,
    teamName: session.team_name,
    teamId: session.team_id,
    gameCode,
    sessionToken: session.session_token,
    challenges: challenges.map((c) => ({ id: c.id, title: c.title })),
    solvedIds,
    final: endedByTeacher,
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
    return withConnection(<PlayEnd reason="time_up" {...endProps} />)
  }

  // "Ready to start?" screen (only when time limit exists and not yet started)
  if (timeLimitMinutes && !gameStarted) {
    return withConnection(
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
    return withConnection(<PlayEnd reason={reason} {...endProps} />)
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
  // Points, time and progress stay in sight while the team scrolls a long
  // task, so the count-up after a correct answer is seen. Not on a screen
  // too low for it (a phone held sideways).
  const stickyTop =
    "top-0 z-40 -mx-4 mb-4 bg-muted/95 px-4 pb-3 pt-3 backdrop-blur [@media(min-height:560px)]:sticky"
  const solvedCount = challenges.filter((c) => solvedIds.has(c.id)).length

  // Free mode: show challenge grid
  if (pathMode === "free") {
    const selected = selectedChallengeIndex !== null ? challenges[selectedChallengeIndex] : undefined
    return withConnection(
      <div className={`${SCREEN} px-4 pb-24`}>
        <div className="max-w-2xl mx-auto">
          <div className={stickyTop}>
            {banners}
            {header}
          </div>

          <ChallengeGrid
            challenges={challenges}
            solvedIds={solvedIds}
            onSelectChallenge={(index) => setSelectedChallengeIndex(index)}
          />

          <ChallengeDetailModal
            key={sheetKey(selected)}
            challenge={selected ?? null}
            open={selectedChallengeIndex !== null}
            onOpenChange={(open) => { if (!open) closeFreeTask() }}
            onSubmit={handleFreeSubmit}
            isSolved={selected ? solvedIds.has(selected.id) : false}
            lastTask={solvedCount >= challenges.length}
            onRevealHint={(idx) => (selected ? revealHint(selected.id, idx) : Promise.resolve(false))}
          />

          <TeamFooter teamName={session.team_name} gameCode={gameCode} onLeave={leaveTeam} className="mt-6" />
        </div>
      </div>
    )
  }

  const currentChallenge = challenges[currentIndex]

  return withConnection(
    <div className={`${SCREEN} px-4 pb-24`}>
      <div className="max-w-lg mx-auto">
        <div className={stickyTop}>
          {banners}
          {header}

          {/* Progress: which task is open and how many are solved */}
          <div className="mt-3">
            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
              <h1 className="font-bold text-foreground">Užduotis {currentIndex + 1} iš {challenges.length}</h1>
              <span className="text-muted-foreground">{solvedCount} išspręsta</span>
            </div>
            <SegmentedProgress
              segments={taskSegments(challenges.map((c) => c.id), solvedIds, currentChallenge.id).map((state, i) => ({
                id: challenges[i].id,
                state,
              }))}
            />
          </div>
        </div>

        <LinearTask
          challenge={currentChallenge}
          index={currentIndex}
          answer={answer}
          onAnswerChange={changeAnswer}
          loading={loading}
          feedback={feedback}
          wrongAttempts={wrongAttempts}
          notice={notice}
          explanation={showExplanation ? currentExplanation : null}
          lastTask={solvedCount >= challenges.length}
          onSubmit={handleSubmit}
          onRevealHint={(index) => revealHint(currentChallenge.id, index)}
          onNext={() => {
            setFeedback(null)
            setNotice(null)
            setShowExplanation(false)
            setCurrentExplanation(null)
            goToNextTask()
          }}
        />

        <TeamFooter teamName={session.team_name} gameCode={gameCode} onLeave={leaveTeam} />
      </div>
    </div>
  )
}
