"use client"

import { useState } from "react"
import { clearLocalWork } from "@/hooks/use-leave-warning"
import { SteamLogo } from "@/components/steam-logo"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { createClient } from "@/lib/supabase/client"
import { usePathname, useRouter } from "next/navigation"
import { LogOut, Gamepad2, GraduationCap, BookOpen, Shield, Menu } from "lucide-react"
import Link from "next/link"
import { UserRole } from "@/types/game"
import Image from "next/image"
import { canViewAdminDashboard, getRoleLabel } from "@/lib/auth/roles"
import { signOutTeamStaff } from "@/lib/team-sso/client-sign-out"

interface TeacherNavProps {
  email: string
  fullName: string
  role?: UserRole
  avatarUrl?: string | null
  // The teacher's currently running game (active/paused), if any — renders
  // a prominent LIVE shortcut to the class screen
  activeGame?: { id: string; title: string; paused?: boolean } | null
  /** Pending account requests (super admin only). */
  pendingRequests?: number
}

function PendingBadge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span
      className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-xs font-semibold leading-5 text-white"
      aria-label={`${count} nauji paskyrų prašymai`}
    >
      {count}
    </span>
  )
}

export function TeacherNav({
  email,
  fullName,
  role = "teacher",
  avatarUrl,
  activeGame = null,
  pendingRequests = 0,
}: TeacherNavProps) {
  const router = useRouter()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  async function handleLogout() {
    clearLocalWork()
    // KU STEAM TEAM staff: end only this CLASSROOM session (TEAM stays
    // signed in) and go back to TEAM.
    if (role === "staff") {
      window.location.assign(await signOutTeamStaff())
      return
    }
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/auth/login")
    router.refresh()
  }

  // Second line under the name: the email, or for TEAM staff their role.
  const secondaryLine = role === "staff" ? getRoleLabel(role) : fullName ? email : null

  const pathname = usePathname()
  const links = [
    { href: "/lesson-plans", label: "Pamokų planai", icon: GraduationCap },
    { href: "/dashboard", label: "Mano veiklos", icon: Gamepad2 },
    { href: "/library", label: "Biblioteka", icon: BookOpen },
    ...(canViewAdminDashboard(role)
      ? [{ href: "/admin", label: "Administravimas", icon: Shield, badge: pendingRequests }]
      : []),
  ] as { href: string; label: string; icon: typeof Shield; badge?: number }[]
  // Activities (/games/...) belong to "Mano veiklos".
  const isCurrent = (href: string) =>
    pathname === href ||
    pathname.startsWith(`${href}/`) ||
    (href === "/dashboard" && pathname.startsWith("/games"))

  return (
    <nav aria-label="Pagrindinis meniu" className="bg-white border-b border-border/50 sticky top-0 z-50 backdrop-blur-xl bg-white/80 print:hidden">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="flex items-center justify-between h-16">
          {/* Left side */}
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="flex items-center shrink-0" aria-label="Mano veiklos, pradžia">
              <SteamLogo size="small" />
            </Link>

            <div className="hidden lg:flex items-center gap-1">
              {links.map((link) => (
                <Button
                  key={link.href}
                  asChild
                  variant="ghost"
                  size="sm"
                  className={`gap-2 ${
                    isCurrent(link.href)
                      ? "bg-muted text-steam-dark"
                      : "text-muted-foreground hover:text-steam-dark"
                  }`}
                >
                  <Link href={link.href} aria-current={isCurrent(link.href) ? "page" : undefined}>
                    <link.icon className="h-4 w-4" aria-hidden="true" />
                    {link.label}
                    {link.badge !== undefined && <PendingBadge count={link.badge} />}
                  </Link>
                </Button>
              ))}
            </div>
          </div>

          {/* Right side: min-w-0 lets the name and email truncate instead of
              running under the logout button when the LIVE badge is shown. */}
          <div className="flex min-w-0 items-center gap-3">
            {activeGame && (
              <Button
                asChild
                variant="outline"
                size="sm"
                className="hidden sm:inline-flex max-w-full min-w-0 gap-2 border-accent/40 text-accent-ink hover:bg-accent/5 font-semibold"
              >
                <Link href={`/games/${activeGame.id}/live`} title={activeGame.title}>
                  <LiveDot paused={activeGame.paused} />
                  <span className="truncate">{liveLabel(activeGame)}</span>
                </Link>
              </Button>
            )}
            <div className="hidden xl:flex min-w-0 items-center gap-3">
              {avatarUrl ? (
                <Image src={avatarUrl} alt="" width={32} height={32} className="shrink-0 rounded-full" />
              ) : null}
              <div className="min-w-0 text-right">
                <p className="truncate text-sm font-medium text-steam-dark leading-none">
                  {fullName || email}
                </p>
                {secondaryLine && (
                  <p className="truncate text-xs text-muted-foreground">{secondaryLine}</p>
                )}
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              aria-label="Atsijungti"
              className="hidden lg:flex shrink-0 text-muted-foreground hover:text-accent-ink"
            >
              <LogOut className="h-4 w-4" />
            </Button>

            {/* Mobile hamburger menu */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden text-muted-foreground"
              aria-label="Meniu"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile menu dialog */}
      <Dialog open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <DialogContent className="lg:hidden top-0 translate-y-0 data-[state=open]:slide-in-from-top-2 max-w-full h-auto rounded-none border-0 border-b p-0">
          <DialogTitle className="sr-only">Navigacijos meniu</DialogTitle>
          <div className="p-4 space-y-1">
            {/* User info */}
            <div className="flex items-center gap-3 pb-3 mb-3 border-b border-border/50">
              {avatarUrl ? (
                <Image src={avatarUrl} alt="" width={40} height={40} className="rounded-full" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary-ink font-semibold">
                  {(fullName || email).charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-steam-dark">{fullName || email}</p>
                {secondaryLine && <p className="text-xs text-muted-foreground">{secondaryLine}</p>}
              </div>
            </div>

            {/* Live game shortcut */}
            {activeGame && (
              <Button
                asChild
                variant="outline"
                className="w-full justify-start gap-3 h-11 border-accent/40 text-accent-ink font-semibold"
              >
                <Link href={`/games/${activeGame.id}/live`} onClick={() => setMobileMenuOpen(false)}>
                  <LiveDot paused={activeGame.paused} />
                  {liveLabel(activeGame)}
                </Link>
              </Button>
            )}

            {/* Nav links */}
            {links.map((link) => (
              <Button
                key={link.href}
                asChild
                variant="ghost"
                className={`w-full justify-start gap-3 h-11 text-steam-dark ${isCurrent(link.href) ? "bg-muted" : ""}`}
              >
                <Link
                  href={link.href}
                  aria-current={isCurrent(link.href) ? "page" : undefined}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <link.icon className="h-4 w-4" aria-hidden="true" />
                  {link.label}
                  {link.badge !== undefined && <PendingBadge count={link.badge} />}
                </Link>
              </Button>
            ))}

            <div className="pt-3 mt-3 border-t border-border/50">
              <Button
                variant="ghost"
                onClick={() => {
                  setMobileMenuOpen(false)
                  handleLogout()
                }}
                className="w-full justify-start gap-3 h-11 text-accent-ink hover:text-accent-ink"
              >
                <LogOut className="h-4 w-4" />
                Atsijungti
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </nav>
  )
}

/** "Vyksta" only while an activity runs; a paused one says so and does not pulse. */
function liveLabel(game: { title: string; paused?: boolean }) {
  return `${game.paused ? "Pristabdyta" : "Vyksta"}: ${game.title}`
}

function LiveDot({ paused }: { paused?: boolean }) {
  if (paused) {
    return <span aria-hidden="true" className="inline-flex h-2 w-2 shrink-0 rounded-full bg-muted-foreground" />
  }
  return (
    <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
    </span>
  )
}
