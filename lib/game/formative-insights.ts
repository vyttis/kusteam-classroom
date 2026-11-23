import { pluralizeLt } from "@/lib/utils"
import type { DetailedChallengeStat } from "@/lib/game/detailed-stats"

// Rule-based reading of the task statistics for planning the next lesson.
// No DI: the same numbers always give the same sentence, and every sentence
// names the numbers it rests on. Pure and safe to import in the browser.

export interface TaskSignals {
  /** Teams in the activity. */
  total_teams: number
  /** Teams that answered the task at least once. */
  attempted_teams: number
  /** Teams that solved it. */
  solved_teams: number
  /** Teams whose first answer was right. */
  first_try_solves: number
  /** Teams that had a hint open when answering. */
  hint_teams: number
  /** Average answers up to the right one, for the teams that solved it. */
  avg_attempts_to_solve: number
}

export type InsightKind =
  | "no_attempts"
  | "few_reached"
  | "unsolved"
  | "hints"
  | "mastered"
  | "many_attempts"
  | "mixed"

export interface TaskInsight {
  kind: InsightKind
  /** Two or three words for a badge. */
  label: string
  /** One or two sentences with the numbers behind them. */
  text: string
  /** Fewer than three teams tried the task: read with care. */
  tentative: boolean
}

export const INSIGHT_LABELS: Record<InsightKind, string> = {
  no_attempts: "Nebandyta",
  few_reached: "Pritrūko laiko",
  unsolved: "Išspręsti kartu",
  hints: "Grįžti prie sąvokos",
  mastered: "Įvaldyta",
  many_attempts: "Aptarti sprendimo būdą",
  mixed: "Nevienodai",
}

/** Below this share of teams the task was reached by too few to judge it. */
const REACHED_SHARE = 0.5
/** From this share of first-try solves the class has the topic. */
const MASTERED_SHARE = 0.7
/** Below this share of first-try solves the method is worth a talk. */
const STRUGGLE_SHARE = 0.4
/** From this many answers per solve the method is worth a talk. */
const MANY_ATTEMPTS = 3
/** Fewer teams than this is too little to be sure. */
const TENTATIVE_TEAMS = 3

/** "iš 1 komandos", "iš 5 komandų", "iš 21 komandos". */
function ofTeams(n: number): string {
  return `${n} ${pluralizeLt(n, "komandos", "komandų", "komandų")}`
}

/** "1 komanda", "3 komandos", "10 komandų". */
function teamsCount(n: number): string {
  return `${n} ${pluralizeLt(n, "komanda", "komandos", "komandų")}`
}

function decimal(n: number): string {
  return String(Math.round(n * 10) / 10).replace(".", ",")
}

/**
 * What a task's numbers suggest for the next lesson. The first rule that
 * fits wins:
 *  1. nobody tried it: nothing can be said about its difficulty;
 *  2. fewer than half of the teams tried it: time ran out, not hardness;
 *  3. fewer than half of those who tried solved it: solve it together;
 *  4. at least half of those who tried used a hint: wording or concept;
 *  5. at least 70 % solved it with the first answer: mastered;
 *  6. three or more answers per solve, or under 40 % first-try: the method;
 *  7. otherwise: uneven, ask the teams what helped.
 */
export function interpretTask(s: TaskSignals): TaskInsight {
  const attempted = Math.max(0, s.attempted_teams)
  const make = (kind: InsightKind, text: string): TaskInsight => {
    const tentative = attempted > 0 && attempted < TENTATIVE_TEAMS
    return {
      kind,
      label: INSIGHT_LABELS[kind],
      text: tentative ? `${text} Duomenų nedaug, vertinkite atsargiai.` : text,
      tentative,
    }
  }

  if (attempted === 0) {
    return make(
      "no_attempts",
      "Šios užduoties nebandė nė viena komanda. Tikėtina, kad pritrūko laiko, tad apie jos sunkumą spręsti negalima."
    )
  }
  if (s.total_teams > 0 && attempted / s.total_teams < REACHED_SHARE) {
    return make(
      "few_reached",
      `Užduotį bandė ${attempted} iš ${ofTeams(s.total_teams)}. Tikėtina, kad kitoms pritrūko laiko, tad tai dar nereiškia, kad užduotis sunki.`
    )
  }
  if (s.solved_teams / attempted < 0.5) {
    return make(
      "unsolved",
      `Užduotį išsprendė ${s.solved_teams} iš ${attempted} bandžiusių komandų. Verta ją išspręsti kartu su klase.`
    )
  }
  if (s.hint_teams / attempted >= 0.5) {
    return make(
      "hints",
      `Užuominų prireikė ${s.hint_teams} iš ${attempted} bandžiusių komandų. Verta grįžti prie užduoties formuluotės arba sąvokos.`
    )
  }
  const firstTryShare = s.first_try_solves / attempted
  if (firstTryShare >= MASTERED_SHARE) {
    return make(
      "mastered",
      `Iš pirmo karto išsprendė ${s.first_try_solves} iš ${attempted} bandžiusių komandų. Klasė šią temą įvaldė.`
    )
  }
  if (s.avg_attempts_to_solve >= MANY_ATTEMPTS) {
    return make(
      "many_attempts",
      `Prieš išsprendžiant prireikė daug bandymų (vidutiniškai ${decimal(s.avg_attempts_to_solve)}). Verta aptarti sprendimo būdą.`
    )
  }
  if (firstTryShare < STRUGGLE_SHARE) {
    return make(
      "many_attempts",
      `Iš pirmo karto išsprendė tik ${s.first_try_solves} iš ${attempted} bandžiusių komandų. Verta aptarti sprendimo būdą.`
    )
  }
  return make(
    "mixed",
    `Iš pirmo karto išsprendė ${s.first_try_solves} iš ${attempted} bandžiusių komandų, kitoms prireikė kelių bandymų. Paklauskite komandų, kas padėjo rasti atsakymą.`
  )
}

export interface DigestLine {
  key: "hardest" | "misconception" | "went_well"
  label: string
  text: string
}

type DigestTask = Pick<
  DetailedChallengeStat,
  "challenge_id" | "title" | "attempted_teams" | "solves" | "first_try_solves" | "wrong_answers" | "insight"
>

function taskName(index: number, title: string): string {
  return `${index + 1}. „${title}“`
}

/**
 * The three lines of "Ką aptarti su klase": the hardest task, the most
 * common misconception and one thing that went well. null while no team
 * has answered anything. `wrongAnswersIncluded` is false when the reader
 * may not see the answers (not the owner) or they could not be read.
 */
export function buildDigest(tasks: readonly DigestTask[], wrongAnswersIncluded: boolean): DigestLine[] | null {
  const tried = tasks
    .map((task, index) => ({ task, index }))
    .filter(({ task }) => task.attempted_teams > 0)
  if (tried.length === 0) return null

  const solvedShare = (t: DigestTask) => t.solves / t.attempted_teams
  const firstShare = (t: DigestTask) => t.first_try_solves / t.attempted_teams

  // Hardest: the smallest share of solvers, then of first-try solvers. A
  // task few teams reached says more about time than about difficulty, so
  // it is named only when nothing else was tried.
  const judged = tried.filter(({ task }) => task.insight.kind !== "few_reached")
  const hardestPool = judged.length > 0 ? judged : tried
  const hardest = [...hardestPool].sort(
    (a, b) =>
      solvedShare(a.task) - solvedShare(b.task) || firstShare(a.task) - firstShare(b.task) || a.index - b.index
  )[0]
  const nothingHard = hardest.task.insight.kind === "mastered"
  const hardestLine: DigestLine = {
    key: "hardest",
    label: "Sunkiausia užduotis",
    text: nothingHard
      ? "Sunkių užduočių nebuvo: tai, ką bandė, dauguma komandų išsprendė iš pirmo karto."
      : `${taskName(hardest.index, hardest.task.title)}: išsprendė ${hardest.task.solves} iš ${hardest.task.attempted_teams} bandžiusių komandų, iš pirmo karto ${hardest.task.first_try_solves}.`,
  }

  // Misconception: the wrong answer most teams gave, when at least two did.
  let common: { index: number; title: string; text: string; teams: number } | null = null
  for (const { task, index } of tried) {
    for (const wrong of task.wrong_answers) {
      if (wrong.teams >= 2 && (!common || wrong.teams > common.teams)) {
        common = { index, title: task.title, text: wrong.text, teams: wrong.teams }
      }
    }
  }
  const misconceptionLine: DigestLine = {
    key: "misconception",
    label: "Dažniausia klaida",
    text: !wrongAnswersIncluded
      ? "Klaidingų atsakymų tekstus mato tik veiklos vedėjas."
      : common
        ? `„${common.text}“ (${taskName(common.index, common.title)}): taip atsakė ${teamsCount(common.teams)}.`
        : "Pasikartojančių klaidingų atsakymų nebuvo: komandos klydo skirtingai arba neklydo.",
  }

  // Went well: the best first-try share among the other tasks (at least half).
  const well = tried
    .filter(({ task }) => nothingHard || task.challenge_id !== hardest.task.challenge_id)
    .filter(({ task }) => firstShare(task) >= 0.5)
    .sort(
      (a, b) =>
        firstShare(b.task) - firstShare(a.task) || b.task.attempted_teams - a.task.attempted_teams || a.index - b.index
    )[0]
  const wentWellLine: DigestLine = {
    key: "went_well",
    label: "Kas pavyko",
    text: well
      ? `${taskName(well.index, well.task.title)}: iš pirmo karto išsprendė ${well.task.first_try_solves} iš ${well.task.attempted_teams} bandžiusių komandų.`
      : "Kol kas nėra kitos užduoties, kurią bent pusė komandų būtų išsprendusios iš pirmo karto.",
  }

  return [hardestLine, misconceptionLine, wentWellLine]
}

export const AUTO_DIFFICULTY_LABELS: Record<DetailedChallengeStat["auto_difficulty"], string> = {
  easy: "Lengva",
  medium: "Vidutinė",
  hard: "Sunki",
  unknown: "Per mažai duomenų",
}

/** How the difficulty column is worked out, for a legend under the table. */
export const AUTO_DIFFICULTY_LEGEND =
  "Sunkumas skaičiuojamas pagal teisingų atsakymų dalį tarp visų bandymų: nuo 70 % lengva, nuo 30 % vidutinė, mažiau sunki. Kai bandymų mažiau nei trys, duomenų per mažai."

/** Headers and rows of the task statistics CSV (see lib/csv.ts for the escaping). */
export function challengeStatsCsv(stats: readonly DetailedChallengeStat[]): {
  headers: string[]
  rows: (string | number)[][]
} {
  return {
    headers: [
      "#",
      "Užduotis",
      "Taškai",
      "Bandymai",
      "Bandė (komandų)",
      "Išsprendė (komandų)",
      "Tikslumas %",
      "Užbaigimo %",
      "Iš pirmo karto %",
      "Vid. bandymų iki sprendimo",
      "Sunkumas (pagal rezultatus)",
      "Dažniausias klaidingas atsakymas",
      "Taip atsakė (komandų)",
      "Ką aptarti",
    ],
    rows: stats.map((s, i) => [
      i + 1,
      s.title,
      s.points,
      s.total_attempts,
      s.attempted_teams,
      s.solves,
      s.accuracy,
      s.completion_rate,
      s.first_try_rate ?? "-",
      s.avg_attempts_to_solve || "-",
      AUTO_DIFFICULTY_LABELS[s.auto_difficulty],
      s.wrong_answers[0]?.text ?? "-",
      s.wrong_answers[0]?.teams ?? "-",
      s.insight.text,
    ]),
  }
}

export interface ReflectionSummaryInput {
  hardest_challenge_title: string | null
}

/** How many teams named each task as the hardest, most named first. */
export function countHardestTasks(reflections: readonly ReflectionSummaryInput[]): {
  named: { title: string; count: number }[]
  unnamed: number
} {
  const counts = new Map<string, number>()
  let unnamed = 0
  for (const r of reflections) {
    const title = r.hardest_challenge_title?.trim()
    if (!title) {
      unnamed += 1
      continue
    }
    counts.set(title, (counts.get(title) ?? 0) + 1)
  }
  const named = [...counts.entries()]
    .map(([title, count]) => ({ title, count }))
    .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title, "lt"))
  return { named, unnamed }
}

/** "45 s", "1 min.", "12 min."; "-" when there is nothing to average. */
export function formatAverageTime(seconds: number | null | undefined): string {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return "-"
  if (seconds < 60) return `${Math.round(seconds)} s`
  return `${Math.round(seconds / 60)} min.`
}

/** The class-wide numbers of the summary block, from the per-task statistics. */
export function summarizeClass(
  challengeStats: readonly Pick<DetailedChallengeStat, "solves" | "total_attempts" | "correct_attempts">[],
  totalTeams: number,
): {
  solved: number
  possible: number
  completion_pct: number
  attempts: number
  correct: number
  accuracy_pct: number
} {
  const solved = challengeStats.reduce((sum, c) => sum + c.solves, 0)
  const attempts = challengeStats.reduce((sum, c) => sum + c.total_attempts, 0)
  const correct = challengeStats.reduce((sum, c) => sum + c.correct_attempts, 0)
  const possible = challengeStats.length * totalTeams
  return {
    solved,
    possible,
    completion_pct: possible > 0 ? Math.round((solved / possible) * 100) : 0,
    attempts,
    correct,
    accuracy_pct: attempts > 0 ? Math.round((correct / attempts) * 100) : 0,
  }
}
