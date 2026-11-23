import { readFile } from "node:fs/promises"
import {
  devices,
  expect,
  test,
  type Browser,
  type BrowserContext,
  type BrowserContextOptions,
  type Page,
} from "@playwright/test"
import account from "./teacher-account.json"

/**
 * One whole lesson against a throwaway local Supabase stack, with synthetic
 * data only (docs/e2e-local.md): a facilitator signs in, builds an activity
 * and runs it, three teams join without accounts and answer, and the
 * facilitator reads the results.
 *
 * The steps are one story and share the activity and the browser contexts,
 * so they run in order (serial). Nothing here presses a DI button: the stack
 * has no ANTHROPIC_API_KEY.
 */
test.describe.configure({ mode: "serial" })

// The same address as playwright.local.config.ts: contexts made by hand do
// not take it from the config.
const BASE_URL = process.env.E2E_LOCAL_URL || "http://localhost:3000"

const ACTIVITY = {
  title: "E2E pamoka: Lietuvos miestai",
  description: "Sintetinė veikla automatiniam testui.",
  minutes: 30,
}

// Task 1 is made in the builder UI, tasks 2 and 3 through the facilitator
// API, task 4 while the activity runs.
const TASKS = {
  capital: {
    title: "Sostinė",
    description: "Kuris miestas yra Lietuvos sostinė?",
    answer: "Vilnius",
    alternative: "Vilniaus miestas",
    hint: "Miesto vardas prasideda raide V ir baigiasi raide s.",
    points: 100,
    hintPenalty: 20,
  },
  number: {
    title: "Pusė penketo",
    description: "Kiek bus penki padalyti iš dviejų?",
    answer: "2.5",
    points: 50,
  },
  choice: {
    title: "Žolės spalva",
    description: "Kokios spalvos vasarą yra žolė?",
    options: ["Raudona", "Žalia", "Mėlyna"],
    answer: "Žalia",
    points: 30,
  },
  extra: {
    title: "Papildoma: dangaus šviesulys",
    description: "Kas šviečia dieną?",
    answer: "saulė",
    points: 40,
  },
}

const ANNOUNCEMENT = "Liko dešimt minučių, nepamirškite pasitarti komandoje."
const REFLECTION = "Kitą kartą atidžiau skaitytume užduočių sąlygas."

/** One /api response a participant's browser received (body null: it could not be read). */
type ApiExchange = { url: string; status: number; body: string | null }

type Participant = {
  team: string
  context: BrowserContext
  page: Page
  sessionToken: string
  teamId: string
  /** Every /api response this participant's browser received. */
  exchanges: Promise<ApiExchange>[]
}

let teacherContext: BrowserContext
let teacher: Page
let gameId = ""
let gameCode = ""
const taskIds: Record<keyof typeof TASKS, string> = { capital: "", number: "", choice: "", extra: "" }
const participants: Record<"alfa" | "beta" | "gama", Participant> = {} as Record<
  "alfa" | "beta" | "gama",
  Participant
>

async function newParticipant(browser: Browser, team: string, options: BrowserContextOptions = {}): Promise<Participant> {
  const context = await browser.newContext({ ...options, baseURL: BASE_URL, locale: "lt-LT" })
  const exchanges: Promise<ApiExchange>[] = []
  context.on("response", (response) => {
    const url = new URL(response.url())
    if (!url.pathname.startsWith("/api/")) return
    exchanges.push(
      response
        .text()
        // A response still on its way when the page reloads cannot be read.
        .catch(() => null)
        .then((body) => ({ url: `${response.request().method()} ${url.pathname}`, status: response.status(), body })),
    )
  })
  return { team, context, page: await context.newPage(), sessionToken: "", teamId: "", exchanges }
}

/** A request from the participant's own browser, as the page would send it. */
async function postFromBrowser(page: Page, path: string, body: unknown): Promise<{ status: number; body: Record<string, unknown> }> {
  return page.evaluate(
    async ({ path, body }) => {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      return { status: res.status, body: (await res.json().catch(() => ({}))) as Record<string, unknown> }
    },
    { path, body },
  )
}

/** The answer form of the task on screen. */
function taskHeading(page: Page, title: string) {
  return page.getByRole("heading", { name: title, exact: true })
}

async function submitTyped(page: Page, label: "Atsakymas" | "Atsakymas (skaičius)", value: string) {
  await page.getByLabel(label, { exact: true }).fill(value)
  await page.getByRole("button", { name: "Pateikti atsakymą" }).click()
}

/** Points in the header of the task page ("100 tšk."). */
function headerPoints(page: Page, points: number) {
  return page.getByText(`${points} tšk.`, { exact: true })
}

/** Minutes left on the participant's countdown ("29:41" gives 29). */
async function minutesLeft(page: Page): Promise<number> {
  const label = await page.locator('[aria-label^="Liko laiko"]').getAttribute("aria-label")
  const parts = (label ?? "").replace("Liko laiko ", "").split(":").map(Number)
  if (parts.some((n) => !Number.isFinite(n)) || parts.length < 2) return NaN
  return parts.length === 3 ? parts[0] * 60 + parts[1] : parts[0]
}

async function createTask(body: Record<string, unknown>): Promise<string> {
  const res = await teacher.request.post("/api/challenges", { data: { game_id: gameId, ...body } })
  expect(res.status(), await res.text()).toBe(201)
  const created = (await res.json()) as Record<string, unknown>
  // The facilitator API never returns the answer either.
  expect(Object.keys(created)).not.toContain("answer_hash")
  expect(Object.keys(created)).not.toContain("accepted_answer_hashes")
  return created.id as string
}

test.beforeAll(async ({ browser }) => {
  teacherContext = await browser.newContext({ baseURL: BASE_URL, locale: "lt-LT" })
  teacher = await teacherContext.newPage()
})

test.afterAll(async () => {
  for (const p of Object.values(participants)) await p.context.close()
  await teacherContext?.close()
})

// The run has no trace, so a failed step leaves what each screen showed.
test.afterEach(async ({}, testInfo) => {
  if (testInfo.status === testInfo.expectedStatus) return
  const pages: [string, Page][] = [["vedėjas", teacher], ...Object.values(participants).map((p): [string, Page] => [p.team, p.page])]
  for (const [name, page] of pages) {
    if (!page || page.isClosed()) continue
    const text = await page
      .locator("body")
      .innerText({ timeout: 5_000 })
      .catch(() => "(no text)")
    console.log(`--- ${name}: ${page.url()}\n${text.replace(/\n{2,}/g, "\n").slice(0, 1500)}`)
    const screenshot = await page.screenshot({ fullPage: true, timeout: 5_000 }).catch(() => null)
    if (screenshot) await testInfo.attach(`${name}.png`, { body: screenshot, contentType: "image/png" })
  }
})

test("the facilitator signs in with email and password", async () => {
  await teacher.goto("/dashboard")
  await expect(teacher).toHaveURL(/\/auth\/login$|\/vedejui$/)

  await teacher.goto("/vedejui")
  await expect(teacher.getByRole("heading", { name: "Prisijungimas" })).toBeVisible()
  await teacher.locator("#email").fill(account.email)
  await teacher.locator("#password").fill(account.password)
  await teacher.getByRole("button", { name: "Prisijungti", exact: true }).click()

  await expect(teacher).toHaveURL(/\/dashboard$/)
  await expect(teacher).toHaveTitle(/Mano veiklos/)
  await expect(teacher.getByText(`${account.firstName} ${account.lastName}`).first()).toBeVisible()
  // A facilitator without activities gets the first-run screen, one with
  // activities (a second run on the same stack) the list.
  await expect(
    teacher.getByRole("heading", { level: 1, name: /^(Pradėkite nuo paruoštos veiklos|Mano veiklos)$/ }),
  ).toBeVisible()
})

test("the facilitator creates an activity with a time limit", async () => {
  // "Kurti nuo nulio" on the first-run screen, "Nauja veikla" above the list.
  await teacher.getByRole("link", { name: /^(Kurti nuo nulio|Nauja veikla)$/ }).first().click()
  await expect(teacher.getByRole("heading", { name: "Nauja veikla" })).toBeVisible()

  await teacher.getByLabel("Veiklos pavadinimas *").fill(ACTIVITY.title)
  await teacher.getByLabel("Aprašymas", { exact: true }).fill(ACTIVITY.description)
  await teacher.getByLabel("Laiko limitas (min.)").fill(String(ACTIVITY.minutes))
  await teacher.getByRole("button", { name: "Sukurti veiklą" }).click()

  await expect(teacher).toHaveURL(/\/games\/[0-9a-f-]{36}$/)
  await expect(teacher.getByRole("heading", { name: ACTIVITY.title, level: 1 })).toBeVisible()
  gameId = new URL(teacher.url()).pathname.split("/").pop()!

  const res = await teacher.request.get(`/api/games/${gameId}`)
  expect(res.status()).toBe(200)
  const game = (await res.json()) as { game_code: string; status: string; settings: { time_limit_minutes: number } }
  gameCode = game.game_code
  expect(gameCode).toMatch(/^[A-Z0-9]{6}$/)
  expect(game.status).toBe("draft")
  expect(game.settings.time_limit_minutes).toBe(ACTIVITY.minutes)
  await expect(teacher.getByText(gameCode).first()).toBeVisible()

  // Nothing to run yet: the start button waits for the first task.
  await expect(teacher.getByRole("button", { name: "Pradėti veiklą" })).toBeDisabled()
  await expect(teacher.getByText("Dar nėra užduočių")).toBeVisible()
})

test("a draft activity is not open to participants", async ({ browser }) => {
  const visitor = await browser.newContext({ baseURL: BASE_URL })
  const page = await visitor.newPage()
  await page.goto(`/play/${gameCode}`)
  await expect(page.getByRole("heading", { name: "Palaukite" })).toBeVisible()
  await expect(page.getByText("Veikla dar neprasidėjo.")).toBeVisible()
  const join = await postFromBrowser(page, "/api/teams", { game_code: gameCode, team_name: "Per anksti" })
  expect(join.status).toBe(404)
  await visitor.close()
})

test("the facilitator adds a text, a number and a choice task", async () => {
  await teacher.getByRole("link", { name: "Kurti užduotis" }).click()
  await expect(teacher).toHaveURL(new RegExp(`/games/${gameId}/builder$`))

  // Task 1 in the builder: text, with another accepted answer and a hint.
  await teacher.getByRole("button", { name: "Nauja", exact: true }).click()
  await expect(teacher.getByRole("heading", { name: "Nauja užduotis" })).toBeVisible()
  await teacher.getByLabel("Pavadinimas *").fill(TASKS.capital.title)
  await teacher.getByLabel("Aprašymas / klausimas").fill(TASKS.capital.description)
  await teacher.getByLabel(/^Teisingas atsakymas/).fill(TASKS.capital.answer)
  await teacher.getByRole("button", { name: "Pridėti kitą atsakymą" }).click()
  await teacher.getByLabel("Kitas priimamas atsakymas 1").fill(TASKS.capital.alternative)
  await teacher.getByRole("button", { name: "Pridėti užuominą" }).click()
  await teacher.getByPlaceholder("Užuomina 1").fill(TASKS.capital.hint)
  const saved = teacher.waitForResponse((r) => r.url().endsWith("/api/challenges") && r.request().method() === "POST")
  await teacher.getByRole("button", { name: "Pridėti užduotį" }).click()
  const savedResponse = await saved
  expect(savedResponse.status()).toBe(201)
  taskIds.capital = ((await savedResponse.json()) as { id: string }).id
  await expect(teacher.getByText("Užduotis sukurta!").first()).toBeVisible()
  await expect(teacher.getByText("1 užd. · 100 tšk.", { exact: true })).toBeVisible()

  // Tasks 2 and 3 through the same API the builder uses.
  taskIds.number = await createTask({
    title: TASKS.number.title,
    description: TASKS.number.description,
    type: "number",
    points: TASKS.number.points,
    correct_answer: TASKS.number.answer,
  })
  taskIds.choice = await createTask({
    title: TASKS.choice.title,
    description: TASKS.choice.description,
    type: "multiple_choice",
    points: TASKS.choice.points,
    options: TASKS.choice.options,
    correct_answer: TASKS.choice.answer,
  })

  await teacher.goto(`/games/${gameId}`)
  for (const task of [TASKS.capital, TASKS.number, TASKS.choice]) {
    await expect(teacher.getByRole("link", { name: `Redaguoti „${task.title}“` })).toBeVisible()
  }
  await expect(teacher.getByRole("link", { name: `Redaguoti „${TASKS.number.title}“` })).toContainText("Skaičius")
  await expect(teacher.getByRole("link", { name: `Redaguoti „${TASKS.choice.title}“` })).toContainText("Pasirinkimas")
  // 100 + 50 + 30 points in three tasks.
  await expect(teacher.getByText("Iš viso taškų").locator("xpath=..")).toContainText("180")
})

test("the facilitator starts the activity", async () => {
  await teacher.getByRole("button", { name: "Pradėti veiklą" }).click()
  const dialog = teacher.getByRole("dialog")
  await expect(dialog.getByRole("heading", { name: "Pradėti veiklą?" })).toBeVisible()
  await dialog.getByRole("button", { name: "Pradėti", exact: true }).click()

  await expect(teacher.getByText("Veikla pradėta!").first()).toBeVisible()
  await expect(teacher.getByRole("heading", { name: "Valdymo centras" })).toBeVisible()
  await expect(teacher.getByText("Dar nėra prisijungusių komandų")).toBeVisible()
  await expect(teacher.getByRole("button", { name: "Pristabdyti", exact: true })).toBeVisible()
})

test("three teams join with the code and start their clock", async ({ browser }) => {
  test.setTimeout(150_000)
  participants.alfa = await newParticipant(browser, "Alfa")
  participants.beta = await newParticipant(browser, "Beta", { ...devices["iPhone 13"] })
  participants.gama = await newParticipant(browser, "Gama")

  for (const p of Object.values(participants)) {
    await p.page.goto(`/play/${gameCode}`)
    await expect(p.page.getByText(ACTIVITY.title)).toBeVisible()
    await expect(p.page.getByText(gameCode)).toBeVisible()

    if (p.team === "Beta") {
      // A name another team already has is refused, with a reason.
      await p.page.getByLabel("Komandos vardas").fill("Alfa")
      await p.page.getByRole("button", { name: "Prisijungti prie veiklos" }).click()
      await expect(p.page.getByText("Šis komandos vardas jau užimtas. Pasirinkite kitą.").first()).toBeVisible()
    }
    await p.page.getByLabel("Komandos vardas").fill(p.team)
    await p.page.getByRole("button", { name: "Prisijungti prie veiklos" }).click()

    // A timed activity: the team sees how many tasks wait, not the tasks.
    await expect(p.page).toHaveURL(new RegExp(`/play/${gameCode}/play$`))
    await expect(p.page.getByRole("heading", { name: "Pasiruošę?" })).toBeVisible()
    await expect(p.page.getByText(`${ACTIVITY.minutes} min.`)).toBeVisible()
    await expect(p.page.getByText("Užduočių skaičius: 3")).toBeVisible()
    await expect(p.page.getByText(`Komanda: ${p.team}`)).toBeVisible()
    await expect(taskHeading(p.page, TASKS.capital.title)).toHaveCount(0)

    const session = await p.page.evaluate(
      (code) => JSON.parse(localStorage.getItem(`ctf_session_${code}`) ?? "{}") as { session_token?: string; team_id?: string },
      gameCode,
    )
    expect(session.session_token).toBeTruthy()
    expect(session.team_id).toBeTruthy()
    p.sessionToken = session.session_token!
    p.teamId = session.team_id!

    await p.page.getByRole("button", { name: "Pradėti", exact: true }).click()
    await expect(taskHeading(p.page, TASKS.capital.title)).toBeVisible()
    await expect(p.page.getByText("Užduotis 1 iš 3")).toBeVisible()
    await expect(p.page.getByText(TASKS.capital.description)).toBeVisible()
    await expect(headerPoints(p.page, 0)).toBeVisible()
    expect(await minutesLeft(p.page)).toBeLessThan(ACTIVITY.minutes + 1)
  }

  // The phone layout fits its screen.
  const overflow = await participants.beta.page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)

  // The facilitator's control centre lists the teams as they come in.
  // (Realtime; the page also reads everything again every 45 s.)
  await expect(teacher.getByText("3 komandos", { exact: true }).first()).toBeVisible({ timeout: 60_000 })
  for (const p of Object.values(participants)) {
    await expect(teacher.getByRole("button", { name: `Tvarkyti komandą: ${p.team}` })).toBeVisible()
  }
})

test("a wrong answer is rejected, correct text, decimal-comma and choice answers score", async () => {
  const { page } = participants.alfa

  await submitTyped(page, "Atsakymas", "Kaunas")
  await expect(page.getByRole("alert").filter({ hasText: "Neteisingai. Bandykite dar kartą!" })).toBeVisible()
  await expect(headerPoints(page, 0)).toBeVisible()
  await expect(taskHeading(page, TASKS.capital.title)).toBeVisible()

  // Capitals and spaces do not matter.
  await submitTyped(page, "Atsakymas", "  vilnius ")
  await expect(page.getByText("Teisingai! +100 taškų")).toBeVisible()
  await expect(headerPoints(page, 100)).toBeVisible()

  // The number is stored as 2.5; a Lithuanian keypad types 2,5.
  await expect(taskHeading(page, TASKS.number.title)).toBeVisible()
  await expect(page.getByText("Užduotis 2 iš 3")).toBeVisible()
  await submitTyped(page, "Atsakymas (skaičius)", "2,5")
  await expect(page.getByText("Teisingai! +50 taškų")).toBeVisible()
  await expect(headerPoints(page, 150)).toBeVisible()

  await expect(taskHeading(page, TASKS.choice.title)).toBeVisible()
  for (const option of TASKS.choice.options) {
    await expect(page.getByRole("button", { name: option })).toBeVisible()
  }
  await page.getByRole("button", { name: TASKS.choice.answer }).click()
  await page.getByRole("button", { name: "Pateikti atsakymą" }).click()
  await expect(page.getByText("Teisingai! +30 taškų")).toBeVisible()

  // Every task solved: the team's end screen with its total.
  await expect(page.getByRole("heading", { name: /Sveikiname!/ })).toBeVisible()
  await expect(page.getByText("Jūs išsprendėte visas užduotis!")).toBeVisible()
  await expect(page.getByText("surinktų taškų").locator("xpath=..")).toContainText("180")
})

test("the other accepted answer scores, and two correct answers at once score once", async () => {
  const { page, sessionToken } = participants.beta

  await submitTyped(page, "Atsakymas", TASKS.capital.alternative)
  await expect(page.getByText("Teisingai! +100 taškų")).toBeVisible()
  await expect(taskHeading(page, TASKS.number.title)).toBeVisible()
  await expect(headerPoints(page, 100)).toBeVisible()

  // Two phones of the team send the same correct answer at the same moment
  // (with the decimal comma, as typed).
  const submission = { session_token: sessionToken, challenge_id: taskIds.number, answer: "2,5", hints_used: 0 }
  const results = await page.evaluate(async (body) => {
    const send = async () => {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      return { status: res.status, body: (await res.json()) as { is_correct?: boolean; points_awarded?: number; already_solved?: boolean } }
    }
    return Promise.all([send(), send()])
  }, submission)
  expect(results.map((r) => r.status)).toEqual([200, 200])
  expect(results.map((r) => r.body.is_correct)).toEqual([true, true])
  expect(results.map((r) => r.body.points_awarded).sort()).toEqual([0, TASKS.number.points])
  expect(results.filter((r) => r.body.already_solved === true)).toHaveLength(1)

  // The page was not the one that answered: after a reload it shows the
  // points once and moves on to the next task.
  await page.reload()
  await expect(taskHeading(page, TASKS.choice.title)).toBeVisible()
  await expect(page.getByText("Užduotis 3 iš 3")).toBeVisible()
  await expect(page.getByText("2 išspręsta")).toBeVisible()
  await expect(headerPoints(page, 150)).toBeVisible()
})

test("an opened hint is shown and the task then scores less", async () => {
  const { page } = participants.gama

  await expect(page.getByText(TASKS.capital.hint)).toHaveCount(0)
  const hintButton = page.getByRole("button", { name: /Reikia užuominos\?/ })
  await expect(hintButton).toContainText(`(-${TASKS.capital.hintPenalty} tšk.)`)
  await hintButton.click()
  // The price is said first and nothing is spent yet: the hint needs a
  // second, explicit step.
  await expect(page.getByText(`Užuomina kainuos ${TASKS.capital.hintPenalty} tšk.`)).toBeVisible()
  await expect(
    page.getByText(
      `Už teisingą atsakymą tada gausite ${TASKS.capital.points - TASKS.capital.hintPenalty} tšk. vietoj ${TASKS.capital.points}.`,
    ),
  ).toBeVisible()
  await expect(page.getByText(TASKS.capital.hint)).toHaveCount(0)
  await page.getByRole("button", { name: `Atverti už ${TASKS.capital.hintPenalty} tšk.` }).click()
  await expect(page.getByText(TASKS.capital.hint)).toBeVisible()
  // The only hint is open: no further one is offered.
  await expect(page.getByRole("button", { name: /užuomin/i })).toHaveCount(0)

  await submitTyped(page, "Atsakymas", TASKS.capital.answer)
  await expect(page.getByText("Teisingai! +80 taškų")).toBeVisible()
  await expect(headerPoints(page, 80)).toBeVisible()
  await expect(taskHeading(page, TASKS.number.title)).toBeVisible()
})

test("the leaderboard orders the teams by points", async () => {
  const { page, teamId } = participants.gama

  await page.getByRole("link", { name: "Lentelė" }).click()
  await expect(page).toHaveURL(new RegExp(`/play/${gameCode}/leaderboard$`))
  await expect(page.getByRole("heading", { name: "Rezultatų lentelė" })).toBeVisible()
  await expect(page.getByText("3 komandos")).toBeVisible()

  // Alfa 180, Beta 150, Gama 80, top to bottom; the team's own row is marked.
  const rows = async () => {
    const text = (await page.locator("body").innerText()).replace(/\s+/g, " ")
    return text.slice(Math.max(0, text.indexOf("Alfa")))
  }
  await expect
    .poll(rows)
    .toMatch(
      /^Alfa 3 užd\. išspręsta .*180 taškų Beta 2 užd\. išspręsta .*150 taškų Gama Jūs 1 užd\. išspręsta .*80 taškų/,
    )

  const board = await page.evaluate(async (code) => {
    const res = await fetch(`/api/play/leaderboard?game_code=${code}`, { cache: "no-store" })
    return (await res.json()) as { state: string; teams: { id: string; name: string; total_points: number; solved: number }[] }
  }, gameCode)
  expect(board.state).toBe("ok")
  expect(board.teams.map((t) => [t.name, t.total_points, t.solved])).toEqual([
    ["Alfa", 180, 3],
    ["Beta", 150, 2],
    ["Gama", 80, 1],
  ])
  expect(board.teams[2].id).toBe(teamId)

  await page.getByRole("link", { name: "Veikla", exact: true }).click()
  await expect(taskHeading(page, TASKS.number.title)).toBeVisible()
})

test("a pause stops the teams and refuses an answer", async () => {
  const { page, sessionToken } = participants.gama

  await teacher.getByRole("button", { name: "Pristabdyti", exact: true }).click()
  await expect(teacher.getByText("Dalyviai matys pauzės pranešimą.").first()).toBeVisible()
  await expect(teacher.getByText("Pristabdyta", { exact: true })).toBeVisible()
  await expect(teacher.getByRole("button", { name: "Tęsti", exact: true })).toBeVisible()

  await expect(page.getByRole("heading", { name: "Veikla pristabdyta" })).toBeVisible()
  await expect(page.getByText("Komanda: Gama")).toBeVisible()
  await expect(page.getByText("80 tšk.")).toBeVisible()
  await expect(taskHeading(page, TASKS.number.title)).toHaveCount(0)

  const refused = await postFromBrowser(page, "/api/submissions", {
    session_token: sessionToken,
    challenge_id: taskIds.number,
    answer: TASKS.number.answer,
    hints_used: 0,
  })
  expect(refused.status).toBe(403)
  expect(refused.body.error).toBe("Veikla pristabdyta. Palaukite, kol vedėjas tęs.")
  expect(refused.body).not.toHaveProperty("is_correct")
})

test("the facilitator resumes and extends the time", async () => {
  const { page } = participants.gama

  await teacher.getByRole("button", { name: "Tęsti", exact: true }).click()
  await expect(teacher.getByRole("button", { name: "Pristabdyti", exact: true })).toBeVisible()
  await expect(taskHeading(page, TASKS.number.title)).toBeVisible()
  await expect(headerPoints(page, 80)).toBeVisible()
  // Still the 30 minutes the activity started with (the pause is given back).
  expect(await minutesLeft(page)).toBeLessThan(ACTIVITY.minutes + 1)

  await teacher.getByLabel("Kiek minučių pridėti").fill("10")
  await teacher.getByRole("button", { name: "Pratęsti", exact: true }).click()
  await expect(teacher.getByText("Pridėta 10 min.").first()).toBeVisible()
  await expect(teacher.getByText(`Laiko limitas dabar ${ACTIVITY.minutes + 10} min.`).first()).toBeVisible()
  await expect(teacher.getByText("Laiko limitas", { exact: true }).locator("xpath=..")).toContainText(
    `${ACTIVITY.minutes + 10} min.`,
  )

  // The team's countdown follows within one status poll.
  await expect.poll(() => minutesLeft(page), { timeout: 20_000 }).toBeGreaterThan(ACTIVITY.minutes + 4)
})

test("an announcement reaches a team", async () => {
  await teacher.getByPlaceholder("Rašykite pranešimą komandoms...").fill(ANNOUNCEMENT)
  await teacher.getByRole("button", { name: "Siųsti", exact: true }).click()
  await expect(teacher.getByText(ANNOUNCEMENT)).toBeVisible()
  await expect(teacher.getByPlaceholder("Rašykite pranešimą komandoms...")).toHaveValue("")

  await expect(participants.gama.page.getByText(ANNOUNCEMENT)).toBeVisible()
})

test("a task added during the activity reaches the teams", async () => {
  taskIds.extra = await createTask({
    title: TASKS.extra.title,
    description: TASKS.extra.description,
    type: "text",
    points: TASKS.extra.points,
    correct_answer: TASKS.extra.answer,
  })

  // Gama keeps its open task and sees one more in the count.
  const gama = participants.gama.page
  await expect(gama.getByText("Užduotis 2 iš 4")).toBeVisible()
  await expect(taskHeading(gama, TASKS.number.title)).toBeVisible()

  // Alfa had finished: it is brought back for the new task.
  const alfa = participants.alfa.page
  await expect(taskHeading(alfa, TASKS.extra.title)).toBeVisible()
  await expect(alfa.getByText("Užduotis 4 iš 4")).toBeVisible()
  await expect(headerPoints(alfa, 180)).toBeVisible()
  // Lithuanian letters are optional on a phone keyboard.
  await submitTyped(alfa, "Atsakymas", "Saule")
  await expect(alfa.getByText("Teisingai! +40 taškų")).toBeVisible()
  await expect(alfa.getByRole("heading", { name: /Sveikiname!/ })).toBeVisible()
  await expect(alfa.getByText("surinktų taškų").locator("xpath=..")).toContainText("220")
})

test("a team that reloads the page is still in the activity", async () => {
  const { page, sessionToken } = participants.gama

  await page.reload()
  await expect(taskHeading(page, TASKS.number.title)).toBeVisible()
  await expect(page.getByText("Užduotis 2 iš 4")).toBeVisible()
  await expect(page.getByText("1 išspręsta")).toBeVisible()
  await expect(headerPoints(page, 80)).toBeVisible()
  await expect(page.getByText("Komanda: Gama")).toBeVisible()
  // No second "Pradėti": the clock kept running from the first start.
  await expect(page.getByRole("heading", { name: "Pasiruošę?" })).toHaveCount(0)
  expect(await minutesLeft(page)).toBeGreaterThan(ACTIVITY.minutes + 4)

  const stored = await page.evaluate((code) => localStorage.getItem(`ctf_session_${code}`) ?? "", gameCode)
  expect(stored).toContain(sessionToken)
})

test("the facilitator finishes the activity and answers are refused", async () => {
  const { page, sessionToken } = participants.gama

  await teacher.getByRole("button", { name: "Baigti veiklą" }).click()
  const dialog = teacher.getByRole("dialog")
  await expect(dialog.getByRole("heading", { name: "Baigti veiklą?" })).toBeVisible()
  await dialog.getByRole("button", { name: "Baigti veiklą" }).click()

  await expect(teacher.getByText("Rezultatai ir analitika paruošti peržiūrai.").first()).toBeVisible()
  await expect(teacher.getByRole("button", { name: "Pristabdyti", exact: true })).toHaveCount(0)
  await expect(teacher.getByRole("region", { name: "Komandų rezultatai" })).toBeVisible()

  await expect(page.getByRole("heading", { name: "Veikla baigta!" })).toBeVisible()
  await expect(page.getByText("Vedėjas užbaigė veiklą. Išsprendėte 1 iš 4 užduočių.")).toBeVisible()
  await expect(page.getByText("surinktų taškų").locator("xpath=..")).toContainText("80")

  const refused = await postFromBrowser(page, "/api/submissions", {
    session_token: sessionToken,
    challenge_id: taskIds.number,
    answer: TASKS.number.answer,
    hints_used: 0,
  })
  expect(refused.status).toBe(403)
  expect(refused.body.error).toBe("Veikla baigta.")

  // Nobody joins a finished activity either.
  const late = await postFromBrowser(page, "/api/teams", { game_code: gameCode, team_name: "Per vėlai" })
  expect(late.status).toBe(404)
})

test("a team submits its reflection", async () => {
  const { page } = participants.gama

  await expect(page.getByRole("heading", { name: "Trumpa refleksija" })).toBeVisible()
  await page.getByRole("combobox").click()
  await page.getByRole("option", { name: TASKS.number.title }).click()
  await page.getByPlaceholder(/daugiau tartumėmės komandoje/).fill(REFLECTION)
  await page.getByPlaceholder(/buvo smagu dirbti komandoje/).fill("Patiko dirbti kartu.")
  await page.getByRole("button", { name: "Išsaugoti refleksiją" }).click()
  await expect(page.getByText("Refleksija išsaugota")).toBeVisible()
  await expect(page.getByRole("heading", { name: "Trumpa refleksija" })).toHaveCount(0)

  // One reflection per team.
  const again = await postFromBrowser(page, "/api/reflections", {
    session_token: participants.gama.sessionToken,
    hardest_challenge_id: null,
    improvement_text: "Antras bandymas",
  })
  expect(again.status).toBe(409)
})

test("the analytics page shows the right totals", async () => {
  await teacher.getByRole("link", { name: "Analitika" }).click()
  await expect(teacher).toHaveURL(new RegExp(`/games/${gameId}/analytics$`))
  await expect(teacher.getByRole("heading", { name: "Veiklos analitika" })).toBeVisible()

  // Answers stored: Alfa 5 (one wrong), Beta 2, Gama 1. The two refused
  // answers and the lost half of the double answer left no row.
  const card = (label: string) => teacher.getByText(label, { exact: true }).locator("xpath=..")
  await expect(card("Komandos")).toHaveText(/^3\s*Komandos$/)
  await expect(card("Atsakymų iš viso")).toHaveText(/^8\s*Atsakymų iš viso$/)
  await expect(card("Teisingi atsakymai")).toHaveText(/^7 \(88\s?%\)\s*Teisingi atsakymai$/)

  const results = teacher.getByRole("region", { name: "Komandų rezultatai" })
  const cells = async (team: string) =>
    (await results.getByRole("row").filter({ hasText: team }).getByRole("cell").allInnerTexts()).slice(0, 6)
  // Place, team, points, solved, attempts, hints.
  expect(await cells("Alfa")).toEqual(["1", "Alfa", "220", "4 / 4", "5", "0"])
  expect(await cells("Beta")).toEqual(["2", "Beta", "150", "2 / 4", "2", "0"])
  expect(await cells("Gama")).toEqual(["3", "Gama", "80", "1 / 4", "1", "1"])

  const stats = await teacher.request.get(`/api/games/${gameId}/analytics`)
  expect(stats.status()).toBe(200)
  expect(await stats.json()).toMatchObject({ total_teams: 3, total_submissions: 8, correct_submissions: 7 })

  await teacher.getByRole("tab", { name: "Refleksijos" }).click()
  await expect(teacher.getByText(REFLECTION)).toBeVisible()
  await expect(teacher.getByText("Gama").first()).toBeVisible()
})

test("the results export is a CSV with a BOM and the team names", async () => {
  await teacher.getByRole("tab", { name: "Statistika" }).click()
  const downloadPromise = teacher.waitForEvent("download")
  await teacher.getByRole("button", { name: "Eksportuoti CSV" }).first().click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^rezultatai_e2e-pamoka-lietuvos-miestai_\d{4}-\d{2}-\d{2}\.csv$/)

  const file = await readFile((await download.path())!)
  expect([...file.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
  const lines = file.subarray(3).toString("utf8").split("\n")
  expect(lines).toHaveLength(4)
  expect(lines[0]).toBe(
    '"Vieta";"Komanda";"Taškai";"Išspręsta užduočių";"Bandymai";"Panaudota užuominų";"Prisijungė";"Paskutinis atsakymas"',
  )
  expect(lines[1]).toMatch(/^"1";"Alfa";"220";"4 \/ 4";"5";"0";/)
  expect(lines[2]).toMatch(/^"2";"Beta";"150";"2 \/ 4";"2";"0";/)
  expect(lines[3]).toMatch(/^"3";"Gama";"80";"1 \/ 4";"1";"1";/)
})

test("no participant response carried an answer hash, a hidden hint or another team's token", async () => {
  const all = Object.values(participants)
  for (const p of all) {
    const exchanges = await Promise.all(p.exchanges)
    const read = exchanges.filter((e): e is ApiExchange & { body: string } => e.body !== null)
    // The lesson really went through the participant routes, and their
    // answers were read here.
    const routes = new Set(read.map((e) => e.url))
    const expected = ["POST /api/teams", "GET /api/play/state", "GET /api/play/status", "POST /api/play/start"]
    if (p.team !== "Gama") expected.push("POST /api/submissions")
    if (p.team === "Gama") expected.push("POST /api/play/hint", "GET /api/play/leaderboard", "POST /api/reflections")
    for (const route of expected) expect([...routes], `${p.team} called ${route}`).toContain(route)

    const otherTokens = all.filter((o) => o !== p).map((o) => o.sessionToken)
    for (const e of read) {
      expect(e.body, `${p.team} ${e.url}`).not.toContain("answer_hash")
      expect(e.body, `${p.team} ${e.url}`).not.toContain("accepted_answer")
      for (const token of otherTokens) expect(e.body, `${p.team} ${e.url}`).not.toContain(token)
      // Only the team that paid for the hint ever received its text.
      if (p.team !== "Gama") expect(e.body, `${p.team} ${e.url}`).not.toContain(TASKS.capital.hint)
    }
    // Its own token came back when the team was created.
    expect(read.filter((e) => e.body.includes(p.sessionToken)).map((e) => e.url)).toContain("POST /api/teams")
  }
})
