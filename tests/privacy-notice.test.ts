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

  it("is linked from the participant, login and consent screens", () => {
    for (const file of [
      "components/player/join-screen.tsx",
      "app/auth/login/login-form.tsx",
      "components/access/access-request-form.tsx",
      "app/onboarding/onboarding-form.tsx",
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

  it("stays public: the proxy does not treat it as a facilitator route", () => {
    expect(read("proxy.ts")).not.toContain('"/privatumas"')
  })
})
