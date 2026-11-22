"use client"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { SIGN_IN_PATH } from "@/hooks/use-session-expired"
import { ExternalLink, Loader2, LogIn, RefreshCw } from "lucide-react"

interface SessionExpiredNoticeProps {
  /** Repeats the action that failed (the save), once signed in again. */
  onRetry?: () => void
  retryLabel?: string
  retrying?: boolean
  className?: string
}

/**
 * Stays on the screen after a save was refused because the session ended.
 * The sign-in page opens in a new tab on purpose: this tab keeps the form
 * with everything typed into it.
 */
export function SessionExpiredNotice({
  onRetry,
  retryLabel = "Bandyti išsaugoti dar kartą",
  retrying = false,
  className,
}: SessionExpiredNoticeProps) {
  return (
    <div
      role="alert"
      className={cn("rounded-lg border border-accent/40 bg-accent/5 p-3 text-sm text-steam-dark", className)}
    >
      <p className="flex items-center gap-2 font-medium text-accent-ink">
        <LogIn className="h-4 w-4 shrink-0" aria-hidden="true" />
        Jūsų sesija baigėsi
      </p>
      <p className="mt-1">
        Pakeitimai neišsaugoti, bet jūsų tekstas liko šiame lange. Prisijunkite naujame skirtuke, grįžkite čia ir
        išsaugokite dar kartą. Šio puslapio neuždarykite ir neperkraukite.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" size="sm" className="gap-1.5">
          <a href={SIGN_IN_PATH} target="_blank" rel="noopener">
            Prisijungti naujame skirtuke
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </Button>
        {onRetry && (
          <Button type="button" size="sm" className="gap-1.5" onClick={onRetry} disabled={retrying}>
            {retrying ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {retryLabel}
          </Button>
        )}
      </div>
    </div>
  )
}
