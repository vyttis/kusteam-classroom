"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { SchoolPicker, type SchoolValue } from "@/components/access/school-picker"
import { PRIVACY_ACK_REQUIRED, PRIVACY_ACK_TEXT, REQUEST_PRIVACY_NOTE } from "@/lib/access/profile-fields"
import { CheckCircle2, Loader2 } from "lucide-react"
import { PrivacyLink } from "@/components/privacy-link"

export interface RequestDoor {
  game_code?: string
  session_token?: string
  activity_token?: string
  link_token?: string
}

interface AccessRequestFormProps {
  door: RequestDoor
  /** Shorter copy for the participant finish screen. */
  compact?: boolean
}

/**
 * A teacher asks for a facilitator account. Shown only behind an open door
 * (finish screen, activity QR, request link); the API checks the door again.
 */
export function AccessRequestForm({ door, compact }: AccessRequestFormProps) {
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [school, setSchool] = useState<SchoolValue | null>(null)
  const [consent, setConsent] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!school || school.school_name.trim().length < 2) {
      setError("Pasirinkite mokyklą iš sąrašo arba įrašykite jos pavadinimą.")
      return
    }
    if (!consent) {
      setError(PRIVACY_ACK_REQUIRED)
      return
    }
    setSending(true)
    try {
      const res = await fetch("/api/access-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...door,
          first_name: firstName,
          last_name: lastName,
          email,
          school_code: school.school_code,
          school_name: school.school_name,
          municipality: school.municipality,
          consent: true,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setError(data.error ?? "Nepavyko pateikti prašymo. Bandykite dar kartą.")
        return
      }
      setSentTo(email.trim().toLowerCase())
    } catch {
      setError("Nepavyko susisiekti su serveriu. Patikrinkite interneto ryšį.")
    } finally {
      setSending(false)
    }
  }

  function reset() {
    setFirstName("")
    setLastName("")
    setEmail("")
    setSchool(null)
    setConsent(false)
    setSentTo(null)
  }

  if (sentTo) {
    return (
      <div className="space-y-3 text-left" role="status">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary-ink" aria-hidden="true" />
          <div className="space-y-1">
            <p className="font-semibold text-steam-dark">Prašymas pateiktas</p>
            <p className="text-sm text-muted-foreground">
              Kai KU STEAM centras patvirtins paskyrą, į <span className="font-medium">{sentTo}</span> atsiųsime
              laišką su prisijungimo nuoroda.
            </p>
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={reset}>
          Pateikti dar vieną prašymą
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-4 text-left">
      {!compact && (
        <p className="text-sm text-muted-foreground">
          Su vedėjo paskyra galėsite kurti veiklas ir vesti jas savo mokiniams. Prašymą peržiūrės KU STEAM centras.
        </p>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="ar-first">Vardas</Label>
          <Input
            id="ar-first"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            autoComplete="given-name"
            required
            maxLength={80}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ar-last">Pavardė</Label>
          <Input
            id="ar-last"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            autoComplete="family-name"
            required
            maxLength={80}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ar-email">Darbo el. paštas</Label>
        <Input
          id="ar-email"
          type="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
          maxLength={200}
        />
        <p className="text-xs text-muted-foreground">Šiuo adresu jungsitės prie platformos.</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ar-school">Mokykla</Label>
        <SchoolPicker id="ar-school" value={school} onChange={setSchool} />
      </div>
      <p className="text-xs text-muted-foreground">
        {REQUEST_PRIVACY_NOTE} Plačiau: <PrivacyLink />
      </p>
      <div className="flex items-start gap-3">
        <Checkbox
          id="ar-consent"
          checked={consent}
          onCheckedChange={(v) => setConsent(v === true)}
          className="mt-0.5"
        />
        <Label htmlFor="ar-consent" className="text-xs font-normal leading-relaxed text-muted-foreground">
          {PRIVACY_ACK_TEXT}
        </Label>
      </div>
      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <Button
        type="submit"
        disabled={sending}
        className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
      >
        {sending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : "Pateikti prašymą"}
      </Button>
    </form>
  )
}
