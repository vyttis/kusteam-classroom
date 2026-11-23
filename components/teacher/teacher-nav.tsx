"use client"

import { useState } from "react"
import { clearLocalWork } from "@/hooks/use-leave-warning"
import { SteamLogo } from "@/components/steam-logo"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { createClient } from "@/lib/supabase/client"
import { usePathname, useRouter } from "next/navigation"
import { LogOut, Gamepad2, GraduationCap, BookOpen, Shield, Menu, Compass, KeyRound, ChevronDown, UserRound } from "lucide-react"
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
  // The teacher's currently running game (active/paused), if any: renders
  // a prominent LIVE shortcut to the class screen
  activeGame?: { id: string; title: string; paused?: boolean } | null
  /** Pending account requests (super admin only). */
  pendingRequests?: number
}

function PendingBadge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span
      className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-accent-ink px-1.5 text-xs font-semibold leading-5 text-white"
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
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  // KU STEAM TEAM staff sign in through TEAM: their password is not managed here.
  const canChangePassword = role !== "staff"

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
    { href: "/gidas", label: "Gidas", icon: Compass },
    ...(canViewAdminDashboard(role)
      ? [{ href: "/admin", label: "Administravimas", icon: Shield, badge: pendingRequests }]
      : []),
  ] as { href: string; label: string; icon: typeof Shield; badge?: number }[]
  // Activities (/games/...) and the ready-made ones belong to "Mano veiklos".
  const isCurrent = (href: string) =>
    pathname === href ||
    pathname.startsWith(`${href}/`) ||
    (href === "/dashboard" && (pathname.startsWith("/games") || pathname.startsWith("/paruostos-veiklos")))

  return (
    <nav aria-label="Pagrindinis meniu" className="sticky top-0 z-50 border-b border-border bg-white print:hidden">
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
                  className={`gap-2 px-3 text-sm ${
                    isCurrent(link.href)
                      ? "bg-steam-dark text-white hover:bg-steam-dark hover:text-white"
                      : "text-steam-dark hover:text-steam-dark"
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
            {/* Account menu (desktop): password and sign-out. The name shows
                from xl up; below that the trigger is the avatar alone. */}
            <Popover open={accountMenuOpen} onOpenChange={setAccountMenuOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`${fullName || email}, paskyros meniu`}
                  className="hidden lg:flex min-w-0 shrink gap-2 px-3 text-steam-dark"
                >
                  {avatarUrl ? (
                    <Image src={avatarUrl} alt="" width={28} height={28} className="shrink-0 rounded-full" />
                  ) : (
                    <UserRound className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  )}
                  <span className="hidden xl:block max-w-32 truncate text-sm font-semibold">{fullName || email}</span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 p-1">
                <div className="border-b border-border/50 px-3 py-2 mb-1">
                  <p className="truncate text-sm font-medium text-steam-dark">{fullName || email}</p>
                  {secondaryLine && <p className="truncate text-xs text-muted-foreground">{secondaryLine}</p>}
                </div>
                {canChangePassword && (
                  <Link
                    href="/slaptazodis"
                    onClick={() => setAccountMenuOpen(false)}
                    className="flex min-h-11 w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-steam-dark hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <KeyRound className="h-4 w-4" aria-hidden="true" />
                    Keisti slaptažodį
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setAccountMenuOpen(false)
                    handleLogout()
                  }}
                  className="flex min-h-11 w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-accent-ink hover:bg-accent/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  Atsijungti
                </button>
              </PopoverContent>
            </Popover>

            {/* Mobile hamburger menu */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden text-steam-dark"
              aria-label="Meniu"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile menu dialog */}
      <Dialog open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <DialogContent className="lg:hidden top-0 translate-y-0 data-[state=open]:slide-in-from-top-2 max-w-full h-auto max-h-dvh overflow-y-auto rounded-none border-0 border-b p-0">
          <DialogTitle className="sr-only">Meniu</DialogTitle>
          <div className="p-4 space-y-1">
            {/* User info */}
            <div className="flex items-center gap-3 pb-3 mb-3 border-b border-border/50">
              {avatarUrl ? (
                <Image src={avatarUrl} alt="" width={40} height={40} className="rounded-full" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-steam-dark flex items-center justify-center text-white font-semibold">
                  {(fullName || email).charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-steam-dark">{fullName || email}</p>
                {secondaryLine && <p className="truncate text-xs text-muted-foreground">{secondaryLine}</p>}
              </div>
            </div>

            {/* Live game shortcut */}
            {activeGame && (
              <Button
                asChild
                variant="outline"
                className="w-full justify-start gap-3 border-accent/40 text-accent-ink"
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
                className={`w-full justify-start gap-3 rounded-lg text-steam-dark ${isCurrent(link.href) ? "bg-muted" : ""}`}
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
              {canChangePassword && (
                <Button asChild variant="ghost" className="w-full justify-start gap-3 rounded-lg text-steam-dark">
                  <Link href="/slaptazodis" onClick={() => setMobileMenuOpen(false)}>
                    <KeyRound className="h-4 w-4" aria-hidden="true" />
                    Keisti slaptažodį
                  </Link>
                </Button>
              )}
              <Button
                variant="ghost"
                onClick={() => {
                  setMobileMenuOpen(false)
                  handleLogout()
                }}
                className="w-full justify-start gap-3 rounded-lg text-accent-ink hover:text-accent-ink"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
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
