"use client"

import { Suspense, useCallback, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import type { EmailOtpType } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"
import { Loader2 } from "lucide-react"
import Link from "next/link"

const OTP_TYPES: EmailOtpType[] = ["invite", "magiclink", "signup", "recovery", "email", "email_change"]

function safeNext(value: string | null): string {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/onboarding"
}

/**
 * Landing page of invitation emails. Handles both link shapes Supabase can
 * send: `?token_hash=…&type=invite` (custom email template) and the default
 * `#access_token=…&refresh_token=…` fragment.
 */
function Confirm() {
  const params = useSearchParams()
  const router = useRouter()
  const [failed, setFailed] = useState(false)

  const next = safeNext(params.get("next"))
  const tokenHash = params.get("token_hash")
  const type = params.get("type") as EmailOtpType | null
  const hasToken = Boolean(tokenHash && type && OTP_TYPES.includes(type))
  const [working, setWorking] = useState(false)

  const finish = useCallback(
    (ok: boolean) => {
      if (ok) {
        router.replace(next)
        router.refresh()
      } else {
        setFailed(true)
      }
    },
    [next, router],
  )

  // The default Supabase link carries the session in the URL fragment, which
  // never reaches a server or a mail scanner: take it at once.
  useEffect(() => {
    if (hasToken) return
    const fragment = new URLSearchParams(window.location.hash.slice(1))
    const accessToken = fragment.get("access_token")
    const refreshToken = fragment.get("refresh_token")
    async function run() {
      if (!accessToken || !refreshToken) return finish(false)
      const { error } = await createClient().auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
      finish(!error)
    }
    void run()
  }, [hasToken, finish])

  // A one-time token in the query is spent by whoever opens the link first.
  // Mail security scanners open links before the person does, so the token is
  // used only when the person presses the button.
  async function confirm() {
    if (!tokenHash || !type) return
    setWorking(true)
    const { error } = await createClient().auth.verifyOtp({ token_hash: tokenHash, type })
    finish(!error)
  }

  if (failed) {
    return (
      <div className="space-y-3 text-center">
        <h1 className="text-xl font-bold text-steam-dark">Nuoroda nebegalioja</h1>
        <p className="text-sm text-muted-foreground">
          Kvietimo nuoroda jau panaudota arba nebegalioja. Prisijungimo puslapyje įrašykite savo el. paštą ir
          spauskite „Pamiršau slaptažodį“: atsiųsime kodą.
        </p>
        <Link href="/vedejui" className="inline-block font-medium underline underline-offset-4">
          Prisijungti
        </Link>
      </div>
    )
  }
  if (hasToken && !working) {
    return (
      <div className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 text-center shadow-sm">
        <h1 className="text-xl font-bold text-steam-dark">Kvietimas į KU STEAM pamokas</h1>
        <p className="text-sm text-muted-foreground">
          Paspauskite mygtuką: prisijungsite ir galėsite užbaigti registraciją.
        </p>
        <button
          type="button"
          onClick={confirm}
          className="inline-flex h-12 w-full items-center justify-center rounded-md bg-primary px-4 text-base font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Tęsti
        </button>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-3 text-muted-foreground" role="status">
      <Loader2 className="h-5 w-5 animate-spin" />
      Jungiamės...
    </div>
  )
}

export default function ConfirmPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-muted">
      <Suspense>
        <Confirm />
      </Suspense>
    </main>
  )
}
