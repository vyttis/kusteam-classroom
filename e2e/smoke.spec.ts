import { expect, test } from "@playwright/test"

// Read-only production checks. CLASSROOM is the canonical host; TEACHER and
// PLAY are the older split hosts that must keep working for bookmarks and
// printed QR codes (before the switch they serve pages, after it they
// redirect to CLASSROOM).
const CLASSROOM = process.env.CLASSROOM_URL || "https://pamokos.kusteam.app"
const TEACHER = process.env.TEACHER_URL || "https://app.kusteam.app"
const PLAY = process.env.PLAY_URL || "https://play.kusteam.app"

test.describe("canonical host", () => {
  test("the root offers both ways in", async ({ page }) => {
    await page.goto(`${CLASSROOM}/`)
    await expect(page.getByRole("link", { name: "Vesti veiklą" }).first()).toBeVisible()
    await expect(page.getByRole("link", { name: "Prisijungti prie veiklos" }).first()).toBeVisible()
  })

  test("participants enter a code at /prisijungti", async ({ page }) => {
    await page.goto(`${CLASSROOM}/prisijungti`)
    await expect(page.getByRole("heading", { name: "Prisijunkite prie veiklos" })).toBeVisible()
    await page.getByPlaceholder("KODAS").fill("ZZZZZZ")
    await page.getByPlaceholder("KODAS").press("Enter")
    await expect(page).toHaveURL(/\/play\/ZZZZZZ$/)
    await expect(page.getByText("Veikla nerasta")).toBeVisible()
  })

  test("the old /play entry lands on /prisijungti", async ({ page }) => {
    await page.goto(`${CLASSROOM}/play`)
    await expect(page).toHaveURL(/\/prisijungti$/)
  })

  test("signed-out facilitators get the login at /vedejui", async ({ page }) => {
    await page.goto(`${CLASSROOM}/dashboard`)
    await expect(page).toHaveURL(/\/vedejui$/)
    await expect(page.getByRole("button", { name: /Google/ })).toBeVisible()
    await expect(page.getByLabel("El. paštas")).toBeVisible()
    await expect(page.getByLabel("Slaptažodis", { exact: true })).toBeVisible()
  })

  test("the participant entry has no horizontal overflow on phones", async ({ page }) => {
    await page.goto(`${CLASSROOM}/prisijungti`)
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
  })

  test("health endpoint reports the database as reachable", async ({ request }) => {
    const res = await request.get(`${CLASSROOM}/api/health`)
    expect(res.status()).toBe(200)
    expect((await res.json()).status).toBe("ok")
  })
})

test.describe("old hosts", () => {
  test("the play host root reaches the code entry", async ({ page }) => {
    await page.goto(`${PLAY}/`)
    await expect(page).toHaveURL(/\/prisijungti$/)
    await expect(page.getByPlaceholder("KODAS")).toBeVisible()
  })

  test("old QR codes on the play host open the activity", async ({ page }) => {
    await page.goto(`${PLAY}/play/ZZZZZZ`)
    await expect(page).toHaveURL(/\/play\/ZZZZZZ$/)
    await expect(page.getByText("Veikla nerasta")).toBeVisible()
  })

  test("participant links on the facilitator host leave the login behind", async ({ request }) => {
    const res = await request.get(`${TEACHER}/play/ZZZZZZ`, { maxRedirects: 0 })
    expect([307, 308]).toContain(res.status())
    expect(res.headers()["location"]).toMatch(/\/\/(play|pamokos)\.kusteam\.app\/play\/ZZZZZZ$/)
  })

  test("the facilitator host still reaches a login", async ({ page }) => {
    await page.goto(`${TEACHER}/dashboard`)
    await expect(page).toHaveURL(/\/(auth\/login|vedejui)$/)
    await expect(page.getByRole("button", { name: /Google/ })).toBeVisible()
  })

  test("health endpoint answers on the facilitator host", async ({ request }) => {
    const res = await request.get(`${TEACHER}/api/health`)
    expect(res.status()).toBe(200)
    expect((await res.json()).status).toBe("ok")
  })
})
