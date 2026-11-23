/**
 * Transactional email through Resend (EU region domain kusteam.app).
 * Supabase Auth sends its own emails (login code, invitation) through the
 * same account over SMTP; this module sends the platform's notices.
 *
 * Email never fails the action that triggered it: without RESEND_API_KEY,
 * or when Resend is down, the notice is skipped and logged (subject only,
 * never the address). Callers that must tell a person whether the email
 * went out (account invitations) await the result and pass it through
 * emailDelivery().
 */

const ENDPOINT = "https://api.resend.com/emails"

export const EMAIL_FROM = process.env.EMAIL_FROM || "KU STEAM DI Lab <noreply@kusteam.app>"
export const EMAIL_REPLY_TO = process.env.EMAIL_REPLY_TO || "steam@ku.lt"

export interface EmailMessage {
  to: string | string[]
  subject: string
  html: string
  text: string
}

export type SendResult = { ok: true } | { ok: false; skipped?: boolean }

/**
 * What an administrator is told about an email: whether Resend accepted it
 * and, if not, the class of the reason. Never the provider's response, a
 * status code or anything from the environment.
 */
export type EmailDelivery = { sent: true } | { sent: false; reason: "not_configured" | "provider_error" }

export function emailDelivery(result: SendResult): EmailDelivery {
  if (result.ok) return { sent: true }
  return { sent: false, reason: result.skipped ? "not_configured" : "provider_error" }
}

export async function sendEmail(message: EmailMessage): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    console.warn("[email] RESEND_API_KEY is not set, skipped", { subject: message.subject })
    return { ok: false, skipped: true }
  }
  const to = Array.isArray(message.to) ? message.to : [message.to]
  if (to.length === 0) return { ok: false, skipped: true }
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to,
        reply_to: EMAIL_REPLY_TO,
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      console.error("[email] send failed", { status: res.status, subject: message.subject })
      return { ok: false }
    }
    return { ok: true }
  } catch (error) {
    console.error("[email] send error", {
      subject: message.subject,
      error: error instanceof Error ? error.name : "unknown",
    })
    return { ok: false }
  }
}
