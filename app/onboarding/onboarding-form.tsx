"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { SchoolPicker, type SchoolValue } from "@/components/access/school-picker"
import { ChipGroup } from "@/components/access/chip-group"
import { CONSENT_TEXT, GRADE_BANDS, SUBJECTS } from "@/lib/access/profile-fields"
import { ArrowRight, Loader2 } from "lucide-react"
import { PrivacyLink } from "@/components/privacy-link"

type Subject = (typeof SUBJECTS)[number]
type GradeBand = (typeof GRADE_BANDS)[number]

export interface OnboardingInitial {
  email: string
  first_name: string
  last_name: string
  school: SchoolValue | null
  subjects: string[]
  grades: string[]
}

export function OnboardingForm({ initial }: { initial: OnboardingInitial }) {
  const router = useRouter()
  const [firstName, setFirstName] = useState(initial.first_name)
  const [lastName, setLastName] = useState(initial.last_name)
  const [school, setSchool] = useState<SchoolValue | null>(initial.school)
  const [subjects, setSubjects] = useState<Subject[]>(
    initial.subjects.filter((s): s is Subject => (SUBJECTS as readonly string[]).includes(s)),
  )
  const [grades, setGrades] = useState<GradeBand[]>(
    initial.grades.filter((g): g is GradeBand => (GRADE_BANDS as readonly string[]).includes(g)),
  )
  const [consent, setConsent] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tried, setTried] = useState(false)

  const missingSchool = !school || school.school_name.trim().length < 2
  const ready =
    firstName.trim() && lastName.trim() && !missingSchool && subjects.length > 0 && grades.length > 0 && consent

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setTried(true)
    setError(null)
    if (!ready || !school) {
      setError("Užpildykite visus laukus ir pažymėkite sutikimą.")
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          school_code: school.school_code,
          school_name: school.school_name,
          municipality: school.municipality,
          subjects,
          grades,
          consent: true,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setError(data.error ?? "Nepavyko išsaugoti. Bandykite dar kartą.")
        return
      }
      router.push("/dashboard")
      router.refresh()
    } catch {
      setError("Nepavyko susisiekti su serveriu. Patikrinkite interneto ryšį.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="ob-first">Vardas</Label>
          <Input
            id="ob-first"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            autoComplete="given-name"
            required
            maxLength={80}
            aria-invalid={(tried && !firstName.trim()) || undefined}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ob-last">Pavardė</Label>
          <Input
            id="ob-last"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            autoComplete="family-name"
            required
            maxLength={80}
            aria-invalid={(tried && !lastName.trim()) || undefined}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ob-email">El. paštas</Label>
        <Input id="ob-email" value={initial.email} readOnly disabled className="bg-muted" />
        <p className="text-xs text-muted-foreground">Šiuo adresu jungiatės. Jį pakeisti gali tik administratorius.</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ob-school">Mokykla</Label>
        <SchoolPicker id="ob-school" value={school} onChange={setSchool} invalid={tried && missingSchool} />
      </div>

      <ChipGroup
        legend="Ką mokote?"
        hint="Pažymėkite visus tinkamus dalykus."
        options={SUBJECTS}
        value={subjects}
        onChange={setSubjects}
        invalid={tried && subjects.length === 0}
      />

      <ChipGroup
        legend="Kokiose klasėse?"
        options={GRADE_BANDS}
        value={grades}
        onChange={setGrades}
        invalid={tried && grades.length === 0}
      />

      <div className="flex items-start gap-3">
        <Checkbox id="ob-consent" checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5" />
        <Label htmlFor="ob-consent" className="text-xs font-normal leading-relaxed text-muted-foreground">
          {CONSENT_TEXT}
        </Label>
      </div>
      <p className="text-xs text-muted-foreground">
        Plačiau: <PrivacyLink />
      </p>

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
        {saving ? (
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        ) : (
          <>
            Pradėti naudotis
            <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
          </>
        )}
      </Button>
    </form>
  )
}
