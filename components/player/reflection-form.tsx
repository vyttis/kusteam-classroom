"use client"

import { useState, useEffect, useId } from "react"
import { readStored, writeStored } from "@/lib/game/session"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, CheckCircle2, MessageCircle } from "lucide-react"
import { motion } from "framer-motion"

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
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6"
        >
          <div className="flex items-center justify-center gap-2 text-primary-ink text-sm font-medium">
            <CheckCircle2 className="h-4 w-4" />
            Refleksija išsaugota
          </div>
        </motion.div>
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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="mt-8"
    >
      <Card className="border-border/50 bg-white shadow-md">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <MessageCircle className="h-4 w-4 text-primary-ink" />
            </div>
            <h3 className="font-semibold text-steam-dark text-base">
              Trumpa refleksija
            </h3>
          </div>
          <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
            Skirkite minutę apmąstyti veiklą. Tai padės geriau įsivertinti,
            kaip sekėsi.
          </p>

          <div className="space-y-4">
            {/* Q1: Hardest challenge */}
            <div className="space-y-1.5">
              <Label htmlFor={hardestId} className="text-sm font-medium text-steam-dark">
                Kuri užduotis buvo sudėtingiausia?
              </Label>
              <Select
                value={hardestChallengeId ?? "none"}
                onValueChange={(val) =>
                  setHardestChallengeId(val === "none" ? null : val)
                }
              >
                <SelectTrigger id={hardestId} className="bg-white">
                  <SelectValue placeholder="Pasirinkite užduotį..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    Nepamenu / nenoriu rinktis
                  </SelectItem>
                  {challenges.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Q2: Improvement */}
            <div className="space-y-1.5">
              <Label htmlFor={improvementId} className="text-sm font-medium text-steam-dark">
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
                className="bg-white min-h-[80px] resize-none"
              />
              <p id={`${improvementId}-count`} className="text-xs text-muted-foreground text-right">
                <span className="sr-only">Įvesta ženklų: </span>
                {improvementText.length}/500
              </p>
            </div>

            {/* Q3: What liked (optional) */}
            <div className="space-y-1.5">
              <Label htmlFor={likedId} className="text-sm font-medium text-steam-dark">
                Kas labiausiai patiko?{" "}
                <span className="text-muted-foreground font-normal">
                  (neprivaloma)
                </span>
              </Label>
              <Textarea
                id={likedId}
                aria-describedby={`${likedId}-count`}
                value={likedText}
                onChange={(e) => setLikedText(e.target.value.slice(0, 300))}
                placeholder="Pvz., buvo smagu dirbti komandoje, patiko mįslės…"
                className="bg-white min-h-[60px] resize-none"
              />
              <p id={`${likedId}-count`} className="text-xs text-muted-foreground text-right">
                <span className="sr-only">Įvesta ženklų: </span>
                {likedText.length}/300
              </p>
            </div>

            {error && (
              <p role="alert" className="text-sm text-accent-ink font-medium">{error}</p>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <Button
                onClick={handleSubmit}
                disabled={loading || !improvementText.trim()}
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Išsaugoti refleksiją
              </Button>
              <Button
                variant="outline"
                onClick={handleSkip}
                disabled={loading}
                className="text-muted-foreground"
              >
                Praleisti
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
