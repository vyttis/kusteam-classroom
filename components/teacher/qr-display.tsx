"use client"

import dynamic from "next/dynamic"
import { Button } from "@/components/ui/button"

const QRCodeSVG = dynamic(
  () => import("qrcode.react").then((mod) => mod.QRCodeSVG),
  { ssr: false, loading: () => <div className="animate-pulse bg-muted rounded" style={{ width: 200, height: 200 }} /> }
)
import { Card, CardContent } from "@/components/ui/card"
import { getPlayUrl } from "@/lib/game/play-url"
import { Copy, Check, Download, Maximize2 } from "lucide-react"
import { useState, useRef, useCallback } from "react"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"

interface QRDisplayProps {
  gameCode: string
  size?: number
  /**
   * Before the start nobody can join yet, so the code is shown as a fact:
   * small QR, the code, and the same actions. The large QR is one press away.
   */
  compact?: boolean
}

export function QRDisplay({ gameCode, size = 200, compact = false }: QRDisplayProps) {
  const [copied, setCopied] = useState(false)
  const [showFullscreen, setShowFullscreen] = useState(false)
  const qrRef = useRef<HTMLDivElement>(null)

  const playUrl = getPlayUrl(gameCode)

  async function handleCopy() {
    // Only report success when the copy actually happened — clipboard access
    // can be denied (insecure origin, permissions)
    try {
      await navigator.clipboard.writeText(playUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt("Nukopijuokite nuorodą rankiniu būdu:", playUrl)
    }
  }

  const handleDownload = useCallback(() => {
    const svg = qrRef.current?.querySelector("svg")
    if (!svg) return

    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const padding = 40
    const qrSize = size + padding * 2
    const totalHeight = qrSize + 60
    canvas.width = qrSize
    canvas.height = totalHeight

    // White background
    ctx.fillStyle = "#FFFFFF"
    ctx.fillRect(0, 0, qrSize, totalHeight)

    // Draw QR from SVG
    const svgData = new XMLSerializer().serializeToString(svg)
    const img = new Image()
    img.onload = () => {
      ctx.drawImage(img, padding, padding, size, size)

      // Draw game code below
      ctx.fillStyle = "#00323C"
      ctx.font = "bold 24px monospace"
      ctx.textAlign = "center"
      ctx.fillText(gameCode, qrSize / 2, qrSize + 35)

      const link = document.createElement("a")
      link.download = `veikla-${gameCode}.png`
      link.href = canvas.toDataURL("image/png")
      link.click()
    }
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)))
  }, [gameCode, size])

  const actionClass = "h-11 flex-1 gap-1.5 rounded-full text-sm"

  return (
    <>
      <Card className="border-border/50 bg-white">
        <CardContent className={compact ? "p-5" : "flex flex-col items-center p-6"}>
          <div className={compact ? "flex items-center gap-4" : "contents"}>
            {/* QR Code */}
            <div
              ref={qrRef}
              className={
                compact
                  ? "shrink-0 rounded-lg border border-border bg-white p-2"
                  : "rounded-xl border border-border/30 bg-white p-4 shadow-inner"
              }
            >
              <QRCodeSVG
                value={playUrl}
                size={compact ? 72 : size}
                level="H"
                includeMargin={false}
                fgColor="#00323C"
                title={`Prisijungimo prie veiklos ${gameCode} QR kodas`}
              />
            </div>

            {/* Game code */}
            <div className={compact ? "min-w-0" : "mt-4 text-center"}>
              <p className="mb-1 text-sm text-muted-foreground">Veiklos kodas</p>
              <p className="font-mono text-2xl font-bold tracking-widest text-steam-dark">{gameCode}</p>
            </div>
          </div>

          {compact && (
            <p className="mt-3 text-sm text-muted-foreground">
              Dalyviai galės prisijungti, kai pradėsite veiklą. QR kodą galite atsisiųsti ir atsispausdinti iš anksto.
            </p>
          )}

          {/* URL and actions */}
          <div className="mt-4 w-full space-y-2">
            <div className="flex items-center gap-1 rounded-lg bg-muted/50 py-0.5 pl-3 pr-0.5">
              <code className="flex-1 truncate text-xs text-muted-foreground">{playUrl}</code>
              <Button
                variant="ghost"
                onClick={handleCopy}
                className="h-11 w-11 shrink-0 p-0"
                aria-label={copied ? "Nuoroda nukopijuota" : "Kopijuoti nuorodą"}
              >
                {copied ? (
                  <Check className="h-4 w-4 text-primary-ink" aria-hidden="true" />
                ) : (
                  <Copy className="h-4 w-4" aria-hidden="true" />
                )}
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={handleDownload} className={actionClass}>
                <Download className="h-4 w-4" aria-hidden="true" />
                Atsisiųsti PNG
              </Button>
              <Button variant="outline" onClick={() => setShowFullscreen(true)} className={actionClass}>
                <Maximize2 className="h-4 w-4" aria-hidden="true" />
                Rodyti ekrane
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Fullscreen QR dialog for projecting in classroom */}
      <Dialog open={showFullscreen} onOpenChange={setShowFullscreen}>
        <DialogContent className="max-w-md sm:max-w-lg flex flex-col items-center py-12">
          <DialogTitle className="sr-only">QR kodas: {gameCode}</DialogTitle>
          <QRCodeSVG
            value={playUrl}
            size={300}
            level="H"
            includeMargin={false}
            fgColor="#00323C"
          />
          <p className="text-4xl font-mono font-bold text-steam-dark tracking-[0.3em] mt-6">
            {gameCode}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Nuskaitykite QR kodą arba įveskite kodą adresu
          </p>
          <code className="text-xs text-muted-foreground mt-1">
            {playUrl}
          </code>
        </DialogContent>
      </Dialog>
    </>
  )
}
