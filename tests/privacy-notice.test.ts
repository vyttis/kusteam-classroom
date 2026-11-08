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
