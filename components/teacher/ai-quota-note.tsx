"use client"

import { useEffect, useState } from "react"
import { pluralizeLt } from "@/lib/utils"
import { cn } from "@/lib/utils"

const USAGE_CHANGED_EVENT = "ks-ai-usage-changed"

/**
 * Call right after a DI action finishes (or is refused): every quota note on
 * the page reads the allowance again, so "liko N DI užklausų" does not keep
 * the number from before the action.
 */
export function notifyAiUsageChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(USAGE_CHANGED_EVENT))
}

interface Quota {
  used: number
  limit: number | null
  remaining: number | null
  resetsOn: string
  blocked: "ai_budget" | "ai_user_limit" | null
}

/**
 * One line under a DI button: how many DI actions are left this month.
 * Nothing for the super admin (no limit) or while it loads.
 */
export function AiQuotaNote({ className, refreshKey }: { className?: string; refreshKey?: unknown }) {
  const [quota, setQuota] = useState<Quota | null>(null)

  useEffect(() => {
    let cancelled = false
    let later: ReturnType<typeof setTimeout> | null = null
    const load = () => {
      fetch("/api/ai/usage", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((q: Quota | null) => {
          // A failed read keeps the last known number instead of hiding it.
          if (!cancelled && q) setQuota(q)
        })
        .catch(() => {})
    }
    // After a DI action: read now, and once more shortly after, because the
    // server settles the count after it has sent the response (a slot of an
    // action that made no model call is given back then).
    const onUsageChanged = () => {
      load()
      if (later) clearTimeout(later)
      later = setTimeout(load, 2500)
    }
    load()
    window.addEventListener(USAGE_CHANGED_EVENT, onUsageChanged)
    return () => {
      cancelled = true
      if (later) clearTimeout(later)
      window.removeEventListener(USAGE_CHANGED_EVENT, onUsageChanged)
    }
  }, [refreshKey])

  if (!quota) return null
  if (quota.blocked === "ai_budget") {
    return (
      <p className={cn("text-xs text-accent-ink", className)} role="status">
        Šį mėnesį platformos DI biudžetas išnaudotas. DI vėl veiks nuo {quota.resetsOn}
      </p>
    )
  }
  if (quota.limit === null || quota.remaining === null) return null
  if (quota.blocked === "ai_user_limit") {
    return (
      <p className={cn("text-xs text-accent-ink", className)} role="status">
        Šio mėnesio DI užklausos panaudotos. Limitas atsinaujins {quota.resetsOn}
      </p>
    )
  }
  const word = pluralizeLt(quota.remaining, "DI užklausa", "DI užklausos", "DI užklausų")
  return (
    <p className={cn("text-xs text-muted-foreground", className)}>
      Šį mėnesį liko {quota.remaining} {word} iš {quota.limit}.
    </p>
  )
}
