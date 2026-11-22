"use client"

import { useState } from "react"
import { Eye, EyeOff } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PASSWORD_HINT, PASSWORD_MAX } from "@/lib/access/password"

interface PasswordFieldsProps {
  idPrefix: string
  password: string
  repeat: string
  onPassword: (value: string) => void
  onRepeat: (value: string) => void
  /** Shown under the fields and tied to them for screen readers. */
  issue?: string | null
  label?: string
}

/** A new password and its repeat, with a show/hide switch and the rule in words. */
export function PasswordFields({ idPrefix, password, repeat, onPassword, onRepeat, issue, label = "Slaptažodis" }: PasswordFieldsProps) {
  const [shown, setShown] = useState(false)
  const hintId = `${idPrefix}-password-hint`
  const issueId = `${idPrefix}-password-issue`
  const describedBy = issue ? `${hintId} ${issueId}` : hintId
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-password`}>{label}</Label>
        <div className="relative">
          <Input
            id={`${idPrefix}-password`}
            type={shown ? "text" : "password"}
            value={password}
            onChange={(e) => onPassword(e.target.value)}
            autoComplete="new-password"
            maxLength={PASSWORD_MAX}
            aria-describedby={describedBy}
            aria-invalid={issue ? true : undefined}
            className="pr-12 text-base"
          />
          <button
            type="button"
            onClick={() => setShown((v) => !v)}
            aria-pressed={shown}
            aria-label={shown ? "Slėpti slaptažodį" : "Rodyti slaptažodį"}
            className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-steam-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {shown ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
          </button>
        </div>
        <p id={hintId} className="text-xs text-muted-foreground">
          {PASSWORD_HINT}
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-password-repeat`}>Pakartokite slaptažodį</Label>
        <Input
          id={`${idPrefix}-password-repeat`}
          type={shown ? "text" : "password"}
          value={repeat}
          onChange={(e) => onRepeat(e.target.value)}
          autoComplete="new-password"
          maxLength={PASSWORD_MAX}
          aria-describedby={issue ? issueId : undefined}
          aria-invalid={issue ? true : undefined}
          className="text-base"
        />
      </div>
      {issue && (
        <p id={issueId} className="text-sm text-destructive" role="alert">
          {issue}
        </p>
      )}
    </div>
  )
}
