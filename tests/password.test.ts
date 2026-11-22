import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { PASSWORD_MIN, passwordErrorMessage, passwordIssue, passwordSchema } from "@/lib/access/password"
import { accountActivatedEmail, accountInviteEmail } from "@/lib/email/templates"

describe("passwordSchema", () => {
  it("accepts a passphrase", () => {
    expect(passwordSchema.safeParse("jūra kopos vėjas").success).toBe(true)
  })
  it("refuses short, padded, repetitive and over-long passwords", () => {
    expect(passwordSchema.safeParse("a".repeat(PASSWORD_MIN - 1)).success).toBe(false)
    expect(passwordSchema.safeParse(" jūra kopos vėjas").success).toBe(false)
    expect(passwordSchema.safeParse("aaaaaaaaaaaa").success).toBe(false)
    expect(passwordSchema.safeParse("ą".repeat(40)).success).toBe(false) // 80 bytes, bcrypt stops at 72
  })
})

describe("passwordIssue", () => {
  it("is null for a good pair", () => {
    expect(passwordIssue("jūra kopos vėjas", "jūra kopos vėjas", "ona@mokykla.lt")).toBeNull()
  })
  it("names a mismatch and a password built on the email", () => {
    expect(passwordIssue("jūra kopos vėjas", "jūra kopos vejas")).toBe("Slaptažodžiai nesutampa.")
    expect(passwordIssue("mokytoja.ona-2026", "mokytoja.ona-2026", "mokytoja.ona@mokykla.lt")).toMatch(/el\. pašto/)
  })
})

describe("passwordErrorMessage", () => {
  it("never passes the provider's English text on", () => {
    for (const error of [{ code: "weak_password" }, { code: "same_password" }, { code: "x", message: "Database error" }, null]) {
      const text = passwordErrorMessage(error)
      expect(text).not.toMatch(/database|password|error/i)
      expect(text.length).toBeGreaterThan(10)
    }
  })
})

describe("account emails", () => {
  const invite = accountInviteEmail("ona@mokykla.lt", "Ona", "https://pamokos.kusteam.app/auth/confirm?token_hash=abc&type=magiclink&next=%2Fonboarding", "https://pamokos.kusteam.app/vedejui")
  it("the invitation has one button to the one-time link and explains the fallback", () => {
    expect(invite.html.match(/token_hash=abc/g)).toHaveLength(1)
    expect(invite.text).toContain("Užbaigti registraciją: https://pamokos.kusteam.app/auth/confirm?token_hash=abc")
    expect(invite.text).toContain("Pamiršau slaptažodį")
    expect(invite.html).not.toContain("—")
  })
  it("the activation email carries no token and mentions the password", () => {
    const mail = accountActivatedEmail("ona@mokykla.lt", "Ona", "https://pamokos.kusteam.app/vedejui")
    expect(mail.html).not.toContain("token_hash")
    expect(mail.text).toContain("slaptažodžiu")
  })
})

describe("sign-in wiring", () => {
  it("the invitation link is spent only on a click, never on page load", () => {
    const source = readFileSync("app/auth/confirm/page.tsx", "utf8")
    const effect = source.slice(source.indexOf("useEffect(() => {"), source.indexOf("async function confirm()"))
    expect(effect).not.toContain("verifyOtp")
    expect(source).toContain("onClick={confirm}")
  })
  it("the password route refuses staff, whose password belongs to TEAM", () => {
    const source = readFileSync("app/api/account/password/route.ts", "utf8")
    expect(source.indexOf('profile.role === "staff"')).toBeGreaterThan(-1)
    expect(source.indexOf('profile.role === "staff"')).toBeLessThan(source.indexOf("updateUser"))
  })
  it("facilitator APIs wait for onboarding, and the password API is a facilitator API", () => {
    const source = readFileSync("proxy.ts", "utf8")
    expect(source).toMatch(/FACILITATOR_API =\s*\n\s*\/\^\\\/api\\\/\(account\|/)
    expect(source.match(/!gate\.onboarded && !ONBOARDING_API\.test/g)).toHaveLength(2)
  })
})
