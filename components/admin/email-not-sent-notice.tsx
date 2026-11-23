"use client"

import { Button } from "@/components/ui/button"
import { Loader2, MailWarning, Send } from "lucide-react"

/** The `email` field of the invite and approval responses. */
export type EmailDelivery = { sent: true } | { sent: false; reason: "not_configured" | "provider_error" }

export interface AccountEmailResponse {
  error?: string
  message?: string
  email?: EmailDelivery
}

/**
 * Sends the account email again through POST /api/admin/invite. The account
 * exists by now, so the route only activates it (a no-op) and emails the
 * sign-in link; the role of an existing account is never changed there.
 */
export async function resendAccountEmail(person: {
  email: string
  first_name: string
  last_name: string
}): Promise<AccountEmailResponse & { ok: boolean }> {
  try {
    const res = await fetch("/api/admin/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...person, role: "teacher" }),
    })
    const data = (await res.json().catch(() => ({}))) as AccountEmailResponse
    return { ...data, ok: res.ok }
  } catch {
    return { ok: false, error: "Nepavyko susisiekti su serveriu. Bandykite dar kartą." }
  }
}

/** Stays on screen until the email goes out or the administrator closes it. */
export function EmailNotSentNotice({
  email,
  message,
  busy,
  onResend,
  onDismiss,
}: {
  email: string
  message: string
  busy: boolean
  onResend: () => void
  onDismiss: () => void
}) {
  return (
    <div role="alert" className="space-y-3 rounded-md bg-destructive/10 px-3 py-3 text-sm text-destructive">
      <p className="flex items-start gap-2 font-semibold">
        <MailWarning className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="break-all">Laiškas neišsiųstas: {email}</span>
      </p>
      <p className="text-steam-dark">{message}</p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={onResend} disabled={busy} className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90">
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="h-4 w-4" aria-hidden="true" />
          )}
          Siųsti dar kartą
        </Button>
        <Button size="sm" variant="outline" onClick={onDismiss} disabled={busy}>
          Uždaryti
        </Button>
      </div>
    </div>
  )
}
