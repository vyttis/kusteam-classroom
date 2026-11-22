import { canonicalNumber } from "@/lib/game/number-answer"

/**
 * Rule-based check that a hint does not give the answer away. It is exact
 * and free, so it runs before (and regardless of) the model check: a model
 * verifier once passed a task whose last hint read "Tikslus skaičius artimas
 * 1584 km²" for the answer 1584.
 *
 * It only catches what can be read off the text: the answer itself, an
 * inflected form of it, the answer number, a range too narrow to leave a
 * choice, and a hint that names the correct choice or rules out all the
 * others. A paraphrase is left to the model check and the facilitator.
 */

export type HintLeakReason = "answer" | "inflected" | "number" | "range" | "elimination"

export interface HintLeak {
  /** Index of the hint in the task's hint list. */
  index: number
  reason: HintLeakReason
}

export interface HintLeakInput {
  type: string
  correct_answer: string
  hints: readonly string[]
  options?: readonly string[] | null
  /** Numbers the task text already gives are data, not a leak. */
  description?: string | null
}

/** Lower case, no diacritics, punctuation as spaces. */
function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
}

// Words too common in running Lithuanian text to count as a leak.
const COMMON_WORDS = new Set(["taip", "ne", "tiesa", "netiesa", "yra", "nera"])

// Case endings without diacritics, longest first.
const ENDINGS = [
  "iuose", "iams", "iems", "iais", "iose", "uose", "omis", "emis", "imis", "umis",
  "ams", "ais", "ems", "oms", "ims", "ums", "yje", "oje", "eje", "uje", "ius", "iai", "iui", "ose", "ese", "yse",
  "iu", "io", "ia", "ie", "as", "is", "ys", "us", "es", "os", "ai", "ei", "ui", "am", "om", "em", "um", "uo",
  "a", "e", "i", "o", "u", "y",
]

function stem(word: string): string {
  for (const ending of ENDINGS) {
    if (word.endsWith(ending) && word.length - ending.length >= 4) {
      return word.slice(0, -ending.length)
    }
  }
  return word
}

function containsPhrase(foldedText: string, foldedPhrase: string): boolean {
  return ` ${foldedText} `.includes(` ${foldedPhrase} `)
}

type TextLeak = "answer" | "inflected" | null

function textLeak(foldedHint: string, foldedAnswer: string): TextLeak {
  if (foldedAnswer.length < 3 || COMMON_WORDS.has(foldedAnswer)) return null
  if (containsPhrase(foldedHint, foldedAnswer)) return "answer"

  // Another case of the same word(s): "Nemunas" in "Nemuno žemupyje".
  const answerWords = foldedAnswer.split(" ").filter((w) => w.length >= 5 && !/^\d+$/.test(w))
  if (answerWords.length === 0 || answerWords.length !== foldedAnswer.split(" ").length) return null
  const hintStems = new Set(foldedHint.split(" ").map(stem))
  return answerWords.every((w) => hintStems.has(stem(w))) ? "inflected" : null
}

interface NumberToken {
  value: number
  canonical: string
  start: number
  end: number
}

// "1584", "1 584", "2,5", "0.75"; thousands may be split by a (non-breaking) space.
const NUMBER_IN_TEXT = /(?<![\d.,])(?:\d{1,3}(?:[   ]\d{3})+(?!\d)|\d+)(?:[.,]\d+)?/g

function numbersIn(text: string): NumberToken[] {
  const tokens: NumberToken[] = []
  for (const match of text.matchAll(NUMBER_IN_TEXT)) {
    const canonical = canonicalNumber(match[0].replace(/[  ]/g, " "))
    if (canonical === null) continue
    tokens.push({
      value: Number(canonical),
      canonical,
      start: match.index,
      end: match.index + match[0].length,
    })
  }
  return tokens
}

/** "1500-1600", "tarp 1580 ir 1590", "nuo 6 iki 8". */
const RANGE_JOINER = /^[^\d]{0,12}?(?:[-–]|\bir\b|\biki\b)[^\d]{0,3}$/

function numberLeak(hint: string, answer: string, given: ReadonlySet<string>): HintLeakReason | null {
  const canonical = canonicalNumber(answer)
  if (canonical === null) return null
  const unsigned = canonical.replace(/^-/, "")
  if (given.has(unsigned)) return null

  const tokens = numbersIn(hint)
  if (tokens.some((t) => t.canonical === unsigned)) return "number"

  const value = Math.abs(Number(canonical))
  const isInteger = !canonical.includes(".")
  for (let i = 0; i + 1 < tokens.length; i++) {
    const low = tokens[i]
    const high = tokens[i + 1]
    if (!RANGE_JOINER.test(hint.slice(low.end, high.start).toLowerCase())) continue
    if (low.value > value || high.value < value) continue
    const width = high.value - low.value
    // Narrow enough to name the answer: at most three whole numbers to try,
    // or a span within 5 % of the answer.
    if ((isInteger && width <= 2) || width <= value * 0.05) return "range"
  }
  return null
}

/** The hints that give the answer away, in hint order (one reason per hint). */
export function findHintLeaks(task: HintLeakInput): HintLeak[] {
  const leaks: HintLeak[] = []
  const answer = task.correct_answer.trim()
  if (!answer) return leaks

  const foldedAnswer = fold(answer)
  const answerIsNumber = canonicalNumber(answer) !== null
  const given = new Set(numbersIn(task.description ?? "").map((t) => t.canonical))
  const distractors =
    task.type === "multiple_choice"
      ? (task.options ?? []).map(fold).filter((o) => o !== foldedAnswer && o.length >= 3 && !COMMON_WORDS.has(o))
      : []
  const distractorCount =
    task.type === "multiple_choice" ? (task.options ?? []).filter((o) => fold(o) !== foldedAnswer).length : 0

  task.hints.forEach((hint, index) => {
    if (typeof hint !== "string") return
    if (answerIsNumber) {
      const reason = numberLeak(hint, answer, given)
      if (reason) leaks.push({ index, reason })
      return
    }
    const foldedHint = fold(hint)
    const reason = textLeak(foldedHint, foldedAnswer)
    if (reason) {
      leaks.push({ index, reason })
      return
    }
    // A choice task: naming every wrong choice leaves only the right one.
    if (
      distractorCount > 0 &&
      distractors.length === distractorCount &&
      distractors.every((d) => containsPhrase(foldedHint, d))
    ) {
      leaks.push({ index, reason: "elimination" })
    }
  })

  return leaks
}

/**
 * What the facilitator reads about a leaking hint. Never quotes the answer:
 * verification notes are stored on the task.
 */
export function hintLeakIssue(leak: HintLeak): string {
  const which = `Užuomina nr. ${leak.index + 1}`
  switch (leak.reason) {
    case "answer":
      return `${which} atskleidžia atsakymą: jis joje parašytas. Perrašykite arba pašalinkite ją.`
    case "inflected":
      return `${which} tikriausiai atskleidžia atsakymą: joje yra kita to paties žodžio forma. Patikrinkite ją.`
    case "number":
      return `${which} atskleidžia atsakymą: joje parašytas teisingas skaičius. Perrašykite arba pašalinkite ją.`
    case "range":
      return `${which} nurodo tokį siaurą skaičių intervalą, kad atsakymą galima atspėti. Perrašykite arba pašalinkite ją.`
    case "elimination":
      return `${which} išvardija visus neteisingus variantus, todėl lieka tik teisingas. Perrašykite arba pašalinkite ją.`
  }
}

/** The hints with the leaking ones removed, and how many were removed. */
export function dropLeakingHints(task: HintLeakInput): { hints: string[]; dropped: number } {
  const leaking = new Set(findHintLeaks(task).map((l) => l.index))
  const hints = task.hints.filter((_, i) => !leaking.has(i))
  return { hints, dropped: task.hints.length - hints.length }
}
