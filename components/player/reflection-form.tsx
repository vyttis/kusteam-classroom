"use client"

import { useState, useEffect, useId } from "react"
import { readStored, writeStored } from "@/lib/game/session"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, CheckCircle2 } from "lucide-react"
import { PRIMARY_BUTTON, TEXT_BUTTON } from "@/components/player/play-ui"

interface ReflectionFormProps {
  challenges: { id: string; title: string }[]
  sessionToken: string
  gameCode: string
  onDone: () => void
}

export function ReflectionForm({
  challenges,
  sessionToken,
  gameCode,
  onDone,
}: ReflectionFormProps) {
  const storageKey = `ctf_reflection_${gameCode}`
  // Ids that tie each label and character counter to its field.
  const formId = useId()
  const hardestId = `${formId}-hardest`
  const improvementId = `${formId}-improvement`
  const likedId = `${formId}-liked`

  const [hardestChallengeId, setHardestChallengeId] = useState<string | null>(
    null
  )
  const [improvementText, setImprovementText] = useState("")
  const [likedText, setLikedText] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [skipped, setSkipped] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // Check if already done
  useEffect(() => {
    const stored = readStored(storageKey)
    if (stored === "submitted") {
      setSubmitted(true)
    } else if (stored === "skipped") {
      setSkipped(true)
    }
  }, [storageKey])

  // Don't render if already done
  if (submitted || skipped) {
    if (submitted) {
      return (
        <div role="status" className="mt-4 flex items-start gap-3 rounded-2xl border-2 border-primary bg-primary/10 p-4 text-left">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-foreground" aria-hidden="true" />
          <div>
            <p className="font-bold text-foreground">Refleksija išsaugota</p>
            <p className="text-sm text-foreground">Ačiū. Jūsų mintis matys vedėjas.</p>
          </div>
        </div>
      )
    }
    return null
  }

  async function handleSubmit() {
    if (!improvementText.trim()) {
      setError("Parašykite bent kelis žodžius")
      return
    }

    setLoading(true)
    setError("")

    try {
      const res = await fetch("/api/reflections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_token: sessionToken,
          hardest_challenge_id: hardestChallengeId,
          improvement_text: improvementText.trim(),
          liked_text: likedText.trim() || null,
        }),
      })

      if (res.status === 409) {
        // Already submitted
        writeStored(storageKey, "submitted")
        setSubmitted(true)
        onDone()
        return
      }

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        setError(data?.error || "Nepavyko išsaugoti refleksijos. Bandykite dar kartą.")
        return
      }

      writeStored(storageKey, "submitted")
      setSubmitted(true)
      onDone()
    } catch {
      setError("Nepavyko išsaugoti refleksijos. Patikrinkite interneto ryšį ir bandykite dar kartą.")
    } finally {
      setLoading(false)
    }
  }

  function handleSkip() {
    writeStored(storageKey, "skipped")
    setSkipped(true)
    onDone()
  }

  return (
    <section aria-labelledby={`${formId}-title`} className="mt-4 rounded-2xl border border-border bg-white p-5 text-left">
      <h2 id={`${formId}-title`} className="text-lg font-bold text-foreground">
        Trumpa refleksija
      </h2>
      <p className="mb-5 mt-1 text-base leading-relaxed text-muted-foreground">
        Skirkite minutę apmąstyti veiklą. Tai padės geriau įsivertinti,
        kaip sekėsi.
      </p>

      <div className="space-y-5">
        {/* Q1: Hardest challenge */}
        <div className="space-y-1.5">
          <Label htmlFor={hardestId} className="text-base font-bold text-foreground">
            Kuri užduotis buvo sudėtingiausia?
          </Label>
          <Select
            value={hardestChallengeId ?? "none"}
            onValueChange={(val) =>
              setHardestChallengeId(val === "none" ? null : val)
            }
          >
            <SelectTrigger id={hardestId} className="h-12 border-2 border-foreground/25 bg-white text-base">
              <SelectValue placeholder="Pasirinkite užduotį..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none" className="min-h-11 text-base">
                Nepamenu / nenoriu rinktis
              </SelectItem>
              {challenges.map((c) => (
                <SelectItem key={c.id} value={c.id} className="min-h-11 text-base">
                  {c.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Q2: Improvement */}
        <div className="space-y-1.5">
          <Label htmlFor={improvementId} className="text-base font-bold text-foreground">
            Ką kitą kartą darytumėte kitaip?
          </Label>
          <Textarea
            id={improvementId}
            aria-describedby={`${improvementId}-count`}
            value={improvementText}
            onChange={(e) =>
              setImprovementText(e.target.value.slice(0, 500))
            }
            placeholder="Pvz., daugiau tartumėmės komandoje, atidžiau skaitytume sąlygas…"
            className="min-h-[88px] resize-none border-2 border-foreground/25 bg-white text-base md:text-base"
          />
          <p id={`${improvementId}-count`} className="text-right text-sm text-muted-foreground">
            <span className="sr-only">Įvesta ženklų: </span>
            {improvementText.length}/500
          </p>
        </div>

        {/* Q3: What liked (optional) */}
        <div className="space-y-1.5">
          <Label htmlFor={likedId} className="text-base font-bold text-foreground">
            Kas labiausiai patiko?{" "}
            <span className="font-normal text-muted-foreground">
              (neprivaloma)
            </span>
          </Label>
          <Textarea
            id={likedId}
            aria-describedby={`${likedId}-count`}
            value={likedText}
            onChange={(e) => setLikedText(e.target.value.slice(0, 300))}
            placeholder="Pvz., buvo smagu dirbti komandoje, patiko mįslės…"
            className="min-h-[64px] resize-none border-2 border-foreground/25 bg-white text-base md:text-base"
          />
          <p id={`${likedId}-count`} className="text-right text-sm text-muted-foreground">
            <span className="sr-only">Įvesta ženklų: </span>
            {likedText.length}/300
          </p>
        </div>

        {error && (
          <p role="alert" className="rounded-xl border border-highlight bg-highlight/20 p-3 text-sm text-foreground">
            {error}
          </p>
        )}

        {/* One main action; skipping is a quiet text button under it. */}
        <div className="flex flex-col items-center gap-1">
          <Button
            onClick={handleSubmit}
            disabled={loading || !improvementText.trim()}
            aria-busy={loading}
            className={PRIMARY_BUTTON}
          >
            {loading ? (
              <Loader2 className="motion-safe:animate-spin" aria-hidden="true" />
            ) : (
              <CheckCircle2 aria-hidden="true" />
            )}
            Išsaugoti refleksiją
          </Button>
          <button type="button" onClick={handleSkip} disabled={loading} className={TEXT_BUTTON}>
            Praleisti
          </button>
        </div>
      </div>
    </section>
  )
}
