"use client"

import { useState } from "react"
import Link from "next/link"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PasswordFields } from "@/components/access/password-fields"
import { passwordIssue } from "@/lib/access/password"

export function PasswordForm({ email }: { email: string }) {
  const [password, setPassword] = useState("")
  const [repeat, setRepeat] = useState("")
  const [tried, setTried] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const issue = passwordIssue(password, repeat, email)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setTried(true)
    setError(null)
    if (issue) return
    setSaving(true)
    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setError(data.error ?? "Nepavyko išsaugoti slaptažodžio. Bandykite dar kartą.")
        return
      }
      setDone(true)
    } catch {
      setError("Nepavyko susisiekti su serveriu. Patikrinkite interneto ryšį.")
    } finally {
      setSaving(false)
    }
  }

  if (done) {
    return (
      <div className="space-y-4" role="status">
        <p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-steam-dark">
          Slaptažodis išsaugotas. Nuo šiol junkitės el. paštu {email} ir šiuo slaptažodžiu. Ankstesnis slaptažodis, jei jį turėjote, nebegalioja.
        </p>
        <Button asChild className="h-12 w-full bg-primary text-base font-semibold text-primary-foreground hover:bg-primary/90">
          <Link href="/dashboard">Į mano veiklas</Link>
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {/* Lets password managers save the pair under the right account. */}
      <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
      <PasswordFields
        idPrefix="pw"
        label="Naujas slaptažodis"
        password={password}
        repeat={repeat}
        onPassword={setPassword}
        onRepeat={setRepeat}
        issue={tried ? issue : null}
      />
      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <Button
        type="submit"
        disabled={saving}
        className="h-12 w-full bg-primary text-base font-semibold text-primary-foreground hover:bg-primary/90"
      >
        {saving ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : "Išsaugoti slaptažodį"}
      </Button>
      <p className="text-center text-sm">
        <Link href="/dashboard" className="inline-flex min-h-11 items-center font-medium text-steam-dark underline underline-offset-4">
          Grįžti nieko nekeičiant
        </Link>
      </p>
    </form>
  )
}
