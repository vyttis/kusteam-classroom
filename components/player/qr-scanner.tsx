"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import type { Html5Qrcode as Html5QrcodeType } from "html5-qrcode"
import { Button } from "@/components/ui/button"
import { Camera, X } from "lucide-react"

interface QRScannerProps {
  onScan: (gameCode: string) => void
}

export function QRScanner({ onScan }: QRScannerProps) {
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scannerRef = useRef<Html5QrcodeType | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState()
        if (state === 2) { // SCANNING
          await scannerRef.current.stop()
        }
      } catch {
        // ignore stop errors
      }
      scannerRef.current = null
    }
    setScanning(false)
  }, [])

  const startScanner = useCallback(async () => {
    setError(null)
    setScanning(true)

    try {
      const { Html5Qrcode } = await import("html5-qrcode")
      const scanner = new Html5Qrcode("qr-reader")
      scannerRef.current = scanner

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1,
        },
        (decodedText) => {
          // Extract game code from URL or use as-is
          let gameCode = decodedText.trim()

          // Handle full URLs like https://www.kusteam.app/play/ABC123
          const urlMatch = gameCode.match(/\/play\/([A-Za-z0-9]{6})(?:[/?#]|$)/)
          if (urlMatch) {
            gameCode = urlMatch[1].toUpperCase()
          } else if (/^[A-Za-z0-9]{6}$/.test(gameCode)) {
            gameCode = gameCode.toUpperCase()
          } else {
            return // Not a valid game code, ignore
          }

          stopScanner()
          onScan(gameCode)
        },
        () => {
          // QR code not found in frame — ignore
        }
      )
    } catch (err) {
      setScanning(false)
      if (err instanceof Error && err.message.includes("Permission")) {
        setError("Leiskite prieigą prie kameros, kad galėtumėte nuskaityti QR kodą")
      } else {
        setError("Nepavyko paleisti kameros. Patikrinkite leidimus.")
      }
    }
  }, [onScan, stopScanner])

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        try {
          const state = scannerRef.current.getState()
          if (state === 2) {
            scannerRef.current.stop()
          }
        } catch {
          // cleanup
        }
      }
    }
  }, [])

  if (!scanning) {
    return (
      <div className="space-y-2">
        <Button
          type="button"
          variant="outline"
          onClick={startScanner}
          className="w-full h-12 gap-2 border-dashed border-2"
        >
          <Camera className="h-5 w-5" />
          Nuskaityti QR kodą
        </Button>
        {error && (
          <p className="text-xs text-accent-ink text-center">{error}</p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="relative rounded-xl overflow-hidden border-2 border-primary/30 bg-black">
        <div id="qr-reader" ref={containerRef} className="w-full" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={stopScanner}
          className="absolute top-2 right-2 bg-black/50 text-white hover:bg-black/70 h-8 w-8 p-0 rounded-full z-10"
          aria-label="Uždaryti skenerį"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground text-center">
        Nukreipkite kamerą į QR kodą
      </p>
    </div>
  )
}
