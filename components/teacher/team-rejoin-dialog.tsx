"use client"

import { useEffect, useState } from "react"
import dynamic from "next/dynamic"
import { Check, Copy, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { getPublicUrl } from "@/lib/game/play-url"

const QRCodeSVG = dynamic(() => import("qrcode.react").then((mod) => mod.QRCodeSVG), {
  ssr: false,
  loading: () => <div className="animate-pulse rounded bg-muted" style={{ width: 200, height: 200 }} />,
})

type LinkState =
  | { kind: "loading" }
  | { kind: "ready"; url: string; expiresAt: string }
  | { kind: "error"; message: string }

interface TeamRejoinDialogProps {
  gameId: string
  team: { id: string; name: string } | null
  onClose: () => void
}

/**
 * "Grąžinti į komandą": a QR and a link, valid for ten minutes and for one
 * use, that move a team to another device after its phone died, the browser
 * changed or someone pressed "Išeiti". The participant scans it and is back
 * in the same team with its points and solved tasks; the device that had
 * the team before is signed out.
 */
export function TeamRejoinDialog({ gameId, team, onClose }: TeamRejoinDialogProps) {
  const [link, setLink] = useState<LinkState>({ kind: "loading" })
  const [copied, setCopied] = useState(false)
  const teamId = team?.id ?? null

  useEffect(() => {
    if (!teamId) return
    let cancelled = false
    ;(async () => {
      setLink({ kind: "loading" })
      setCopied(false)
      try {
        const res = await fetch(`/api/games/${gameId}/teams/${teamId}/rejoin`, { method: "POST" })
        const data = (await res.json().catch(() => ({}))) as { path?: string; expires_at?: string; error?: string }
        if (cancelled) return
        if (!res.ok || !data.path || !data.expires_at) {
          setLink({ kind: "error", message: data.error ?? "Nepavyko sukurti nuorodos." })
          return
        }
        setLink({ kind: "ready", url: getPublicUrl(data.path), expiresAt: data.expires_at })
      } catch {
        if (!cancelled) setLink({ kind: "error", message: "Nepavyko susisiekti. Patikrinkite interneto ryšį." })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [gameId, teamId])

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      // The link stays selectable in the field.
    }
  }

  const until =
    link.kind === "ready"
      ? new Date(link.expiresAt).toLocaleTimeString("lt-LT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Vilnius" })
      : null

  return (
    <Dialog open={team !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Grąžinti į komandą „{team?.name}“</DialogTitle>
          <DialogDescription>
            Dalyvis nuskaito kodą kitu įrenginiu ir tęsia toje pačioje komandoje su jos taškais ir išspręstomis užduotimis.
            Komanda toliau dirba tik tame įrenginyje. Rodykite kodą tik tai komandai.
          </DialogDescription>
        </DialogHeader>

        {link.kind === "loading" && (
          <div className="flex justify-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary-ink" aria-label="Kuriama nuoroda" />
          </div>
        )}
        {link.kind === "error" && (
          <p role="alert" className="py-4 text-sm text-accent-ink">
            {link.message}
          </p>
        )}
        {link.kind === "ready" && (
          <div className="space-y-4">
            <div className="flex justify-center rounded-lg bg-white p-3">
              <QRCodeSVG value={link.url} size={200} level="M" title={`Grįžimo į komandą „${team?.name}“ kodas`} />
            </div>
            <div className="flex gap-2">
              <Input readOnly value={link.url} aria-label="Grįžimo nuoroda" onFocus={(e) => e.currentTarget.select()} />
              <Button type="button" variant="outline" onClick={() => void copy(link.url)} className="shrink-0 gap-1.5">
                {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
                {copied ? "Nukopijuota" : "Kopijuoti"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Kodas galioja iki {until} ir tinka vieną kartą. Jį panaudojus ankstesnis komandos įrenginys
              atjungiamas. Prireikus sukurkite naują.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Uždaryti
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
