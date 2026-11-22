"use client"

import { useState } from "react"
import { MapPin, ExternalLink } from "lucide-react"

interface MapsEmbedProps {
  url: string
  className?: string
}

function extractMapsQuery(url: string): string | null {
  try {
    // Try coordinates: /@lat,lng
    const coordMatch = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/)
    if (coordMatch) {
      return `${coordMatch[1]},${coordMatch[2]}`
    }

    // Try place name: /place/Name/
    const placeMatch = url.match(/\/place\/([^/@]+)/)
    if (placeMatch) {
      return decodeURIComponent(placeMatch[1].replace(/\+/g, " "))
    }

    // Try query param: ?q=something
    const qMatch = url.match(/[?&]q=([^&]+)/)
    if (qMatch) {
      return decodeURIComponent(qMatch[1].replace(/\+/g, " "))
    }

    // Try search query in URL path
    const searchMatch = url.match(/\/maps\/search\/([^/]+)/)
    if (searchMatch) {
      return decodeURIComponent(searchMatch[1].replace(/\+/g, " "))
    }

    // Try short URL — just return as-is for embed
    if (url.includes("goo.gl") || url.includes("maps.app.goo.gl")) {
      return null
    }

    return null
  } catch {
    return null
  }
}

function isValidMapsUrl(url: string): boolean {
  return (
    url.includes("google.com/maps") ||
    url.includes("google.lt/maps") ||
    url.includes("maps.google") ||
    url.includes("goo.gl/maps") ||
    url.includes("maps.app.goo.gl")
  )
}

/**
 * A task's map. Nothing is requested from Google until the person asks for
 * the map: an embedded map sends the device's address to Google and lets it
 * set cookies, which the privacy notice does not promise for participants.
 */
export function MapsEmbed({ url, className = "" }: MapsEmbedProps) {
  const [shown, setShown] = useState(false)

  if (!url || !isValidMapsUrl(url)) {
    return null
  }

  const query = extractMapsQuery(url)

  if (!query) {
    // Fallback: show link with map icon
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={`flex items-center gap-2 text-sm text-primary-ink hover:text-primary-ink/80 transition-colors ${className}`}
      >
        <MapPin className="h-4 w-4" />
        Atidaryti žemėlapyje
        <ExternalLink className="h-3 w-3" />
      </a>
    )
  }

  const embedUrl = `https://maps.google.com/maps?q=${encodeURIComponent(query)}&t=&z=15&ie=UTF8&iwloc=&output=embed`

  return (
    <div className={`rounded-xl overflow-hidden border border-border/50 ${className}`}>
      {shown ? (
        <iframe
          src={embedUrl}
          width="100%"
          height="250"
          style={{ border: 0 }}
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer"
          title="Google žemėlapis"
        />
      ) : (
        <div className="flex flex-col items-center gap-2 bg-muted/30 px-4 py-6 text-center">
          <button
            type="button"
            onClick={() => setShown(true)}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium text-steam-dark hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <MapPin className="h-4 w-4" aria-hidden="true" />
            Rodyti žemėlapį
          </button>
          <p className="text-xs text-muted-foreground">
            Žemėlapį pateikia Google. Jį atvėrus, Google gauna jūsų įrenginio interneto adresą.
          </p>
        </div>
      )}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 px-3 py-2 text-xs text-muted-foreground hover:text-primary-ink transition-colors bg-muted/30"
      >
        <MapPin className="h-3 w-3" />
        Atidaryti Google Maps
        <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  )
}
