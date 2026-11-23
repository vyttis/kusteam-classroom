"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import type { UserRole, Profile } from "@/types/game"
import { getRoleLabel } from "@/lib/auth/roles"
import { SchoolPicker, type SchoolValue } from "@/components/access/school-picker"
import {
  EmailNotSentNotice,
  resendAccountEmail,
  type AccountEmailResponse,
} from "@/components/admin/email-not-sent-notice"
import { UserPlus, Loader2 } from "lucide-react"

interface InviteUserDialogProps {
  currentUserRole: UserRole
  onUserInvited: (user: Profile) => void
}

// Only the super admin creates accounts (the same as approving a request).
export function InviteUserDialog({ currentUserRole, onUserInvited }: InviteUserDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState("")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [school, setSchool] = useState<SchoolValue | null>(null)
  const [role, setRole] = useState<UserRole>("teacher")
  // The account was made but its email did not go out: the dialog stays
  // open with the reason and a "send again" action.
  const [unsent, setUnsent] = useState<{ email: string; first_name: string; last_name: string; message: string } | null>(
    null,
  )
  const { toast } = useToast()

  if (currentUserRole !== "super_admin") return null

  function resetForm() {
    setEmail("")
    setFirstName("")
    setLastName("")
    setSchool(null)
    setRole("teacher")
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch("/api/admin/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          first_name: firstName,
          last_name: lastName,
          role,
          ...(school && school.school_name.trim().length >= 2
            ? { school_code: school.school_code, school_name: school.school_name, municipality: school.municipality }
            : {}),
        }),
      })
      const data = (await res.json().catch(() => ({}))) as AccountEmailResponse & { user?: Profile }
      if (!res.ok || !data.user) throw new Error(data.error || "Nepavyko sukurti paskyros")

      onUserInvited(data.user)
      if (data.email?.sent === false) {
        setUnsent({
          email: email.trim(),
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          message: data.message ?? "Paskyra sukurta, bet laiškas neišsiųstas.",
        })
        return
      }
      toast({ title: "Paskyra sukurta", description: data.message })
      resetForm()
      setOpen(false)
    } catch (error: unknown) {
      toast({
        title: "Klaida",
        description: error instanceof Error ? error.message : "Bandykite dar kartą",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    if (!unsent) return
    setLoading(true)
    const data = await resendAccountEmail(unsent)
    setLoading(false)
    if (!data.ok) {
      toast({ title: "Klaida", description: data.error ?? "Bandykite dar kartą", variant: "destructive" })
      return
    }
    if (data.email?.sent === false) {
      setUnsent({ ...unsent, message: data.message ?? unsent.message })
      return
    }
    toast({ title: "Laiškas išsiųstas", description: data.message })
    closeDialog()
  }

  function closeDialog() {
    setUnsent(null)
    resetForm()
    setOpen(false)
  }

  const roles: UserRole[] = ["teacher", "admin", "super_admin"]

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Closing after an unsent email also clears the finished form.
        if (!next && unsent) closeDialog()
        else setOpen(next)
      }}
    >
      <DialogTrigger asChild>
        <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
          <UserPlus className="h-4 w-4" aria-hidden="true" />
          Sukurti paskyrą
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-steam-dark">Nauja vedėjo paskyra</DialogTitle>
          <DialogDescription>
            {unsent
              ? "Paskyra sukurta, bet žmogus apie ją dar nežino."
              : "Žmogus gaus kvietimą el. paštu. Prisijungęs pirmą kartą jis užpildys dalykus ir klases."}
          </DialogDescription>
        </DialogHeader>

        {unsent && (
          <EmailNotSentNotice
            email={unsent.email}
            message={unsent.message}
            busy={loading}
            onResend={handleResend}
            onDismiss={closeDialog}
          />
        )}

        <form onSubmit={handleSubmit} className={unsent ? "hidden" : "mt-2 space-y-4"}>
          <div className="space-y-1.5">
            <Label htmlFor="invite-email">El. paštas</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="off"
              required
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="invite-first">Vardas</Label>
              <Input id="invite-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-last">Pavardė</Label>
              <Input id="invite-last" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invite-school">Mokykla (nebūtina)</Label>
            <SchoolPicker id="invite-school" value={school} onChange={setSchool} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invite-role">Rolė</Label>
            <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
              <SelectTrigger id="invite-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r} value={r}>
                    {getRoleLabel(r)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="flex-1">
              Atšaukti
            </Button>
            <Button
              type="submit"
              disabled={loading || !email || !firstName.trim() || !lastName.trim()}
              className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : "Sukurti ir pakviesti"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
