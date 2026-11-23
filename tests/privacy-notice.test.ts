import { describe, expect, it } from "vitest"
import { readFileSync } from "fs"
import path from "path"
import { PRIVACY_NOTICE_STATUS } from "@/lib/privacy"

const root = path.join(__dirname, "..")
const read = (file: string) => readFileSync(path.join(root, file), "utf8")
const page = read("app/privatumas/page.tsx")

describe("privacy notice (CLS-013)", () => {
  it("names the verified controller and every external service", () => {
    expect(page).toContain("211951150")
    for (const service of ["Supabase", "Vercel", "Anthropic", "Resend", "Google"]) {
      expect(page).toContain(service)
    }
  })

  // R-18 (readiness audit 2026-11-22): the notice left out things the
  // platform does. Each sentence below is tied to the code that makes it true.
  it("says what each processor receives", () => {
    const text = page.replace(/\s+/g, " ")
    // Supabase: database, uploaded files and sign-in (passwords are kept by Supabase Auth).
    expect(text).toMatch(/Supabase \(duomenų bazė, įkelti failai ir prisijungimas/)
    expect(text).toMatch(/Slaptažodį saugo prisijungimo paslauga \(Supabase\) ne atviru tekstu/)
    expect(text).toContain("Vercel (svetainės talpinimas)")
    expect(text).toMatch(/Resend gauna gavėjo el\. pašto adresą ir laiško turinį/)
    expect(text).toMatch(/Anthropic gauna tai, ką vedėjas pateikia/)
    expect(text).toMatch(/dalyvių atsakymų Anthropic nesiunčiame/)
    expect(text).toMatch(/iš Google gauname el\. pašto adresą, vardą ir profilio nuotraukos adresą/)
  })

  it("covers every way to sign in that the login form offers", () => {
    const form = read("app/auth/login/login-form.tsx")
    for (const method of ["signInWithPassword", "signInWithOAuth", "signInWithOtp"]) expect(form).toContain(method)
    expect(page.replace(/\s+/g, " ")).toContain("el. paštu ir slaptažodžiu, per Google arba vienkartiniu kodu iš laiško")
  })

  it("keeps the DI sentence true: no participant route calls Anthropic", () => {
    const callers = [
      "app/api/submissions/route.ts",
      "app/api/teams/route.ts",
      "app/api/play/state/route.ts",
      "app/api/play/hint/route.ts",
      "app/api/play/rejoin/route.ts",
    ]
    for (const file of callers) {
      expect(read(file), file).not.toMatch(/getAnthropicClient|@anthropic-ai\/sdk|verifySuggestion/)
    }
  })

  it("describes the map as it works: nothing from Google before the click", () => {
    const map = read("components/shared/maps-embed.tsx")
    expect(map).toContain("Rodyti žemėlapį")
    expect(map).toMatch(/\{shown \? \(\s*<iframe/)
    expect(page.replace(/\s+/g, " ")).toContain("iš Google jis įkeliamas tik paspaudus „Rodyti žemėlapį“")
  })

  it("describes retention as the code runs it: counting unless deletion is switched on", async () => {
    const { retentionMode } = await import("@/lib/retention")
    expect(retentionMode(undefined)).toBe("report")
    const text = page.replace(/\s+/g, " ")
    expect(text).toContain("Automatinis trynimas pagal terminą veikia tik atskirai jį įjungus")
    expect(text).toContain("Šiuo metu jis neįjungtas")
    // No retention periods on the page until deletion really runs.
    expect(text).not.toMatch(/90 dienų|6 mėnes|12 mėnes/)
  })

  it("names what is kept in the browser and for how long", () => {
    const text = page.replace(/\s+/g, " ")
    expect(text).toContain("naršyklės vietinėje atmintyje")
    expect(read("lib/game/session.ts")).toContain("24 * 60 * 60 * 1000")
    expect(text).toContain("Po 24 valandų")
    expect(read("components/teacher/lesson-plan-generator.tsx")).toContain("7 * 24 * 60 * 60 * 1000")
    expect(text).toContain("iki 7 dienų")
  })

  it("tells participants and facilitators that administrators can see results", () => {
    expect(page.replace(/\s+/g, " ")).toContain("Platformos administratoriai mato visų veiklų sąrašą")
  })

  it("uses no long dashes", () => {
    expect(page).not.toMatch(/[—–]/)
  })

  it("makes no claims that were not verified (docs/privacy-review.md)", () => {
    // The rate-limit key is an HMAC of the address, not encryption.
    expect(page).not.toMatch(/šifruot/i)
    // Resend's region was not checked in the Resend account.
    expect(page).not.toMatch(/Resend[^<]*ES regionas/)
    expect(page).toContain("dpo@ku.lt")
  })

  it("is short and plain: contacts and legal basis, no technical terms", () => {
    expect(page).toContain("steam@ku.lt")
    expect(page.replace(/\s+/g, " ")).toContain("6 straipsnio 1 dalies e punktas")
    for (const term of ["HMAC", "RLS", "access_requests", "ai_usage", "admin_audit_log", "auth.audit_log"]) {
      expect(page, term).not.toContain(term)
    }
  })

  it("does not present the form checkbox as consent (the basis is a public task)", () => {
    const fields = read("lib/access/profile-fields.ts")
    expect(fields).not.toMatch(/Sutinku/)
    expect(fields).toContain("Susipažinau su privatumo pranešimu")
    expect(page).not.toMatch(/sutikim/i)
  })

  it("is linked from the participant, login and consent screens", () => {
    for (const file of [
      "components/player/join-screen.tsx",
      "app/auth/login/login-form.tsx",
      "components/access/access-request-form.tsx",
      "app/onboarding/onboarding-form.tsx",
      "app/play/[gameCode]/page.tsx",
    ]) {
      expect(read(file), file).toContain("<PrivacyLink />")
    }
  })

  it("cannot be marked approved while open questions remain", () => {
    if (PRIVACY_NOTICE_STATUS === "approved") {
      expect(page).not.toMatch(/<Question>/)
    } else {
      expect(page).toMatch(/Projektas/)
    }
  })

  it("tells participants they need no account and no real names", () => {
    expect(read("app/play/[gameCode]/page.tsx")).toContain("be tikrų vardų ir pavardžių. Paskyros nereikia.")
  })

  it("stays public: the proxy does not treat it as a facilitator route", () => {
    expect(read("proxy.ts")).not.toContain('"/privatumas"')
  })
})
