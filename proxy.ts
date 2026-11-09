import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { hostKind, legacyRedirect } from "@/lib/hosts"
import { createAdminClient } from "@/lib/supabase/admin"
import { isTeamSsoEnabled, teamHomeUrl } from "@/lib/team-sso/config"
import { TEAM_SSO_MESSAGES, messageKindFor, messagePath } from "@/lib/team-sso/messages"
import { staffAccess, type StaffDecision } from "@/lib/team-sso/staff-gate"

// In-memory account gate cache: user.id → { expiresAt }. Only the fully
// open state (active and onboarded) is cached, for 30 s: it cuts ~30-50 ms
// off every teacher navigation. Anything else is read fresh, so a user who
// just finished onboarding or was just approved is not bounced back. A
// block reaches cached instances within 30 s. KU STEAM TEAM staff are never
// cached: their access is checked on every request (staffGate below).
type GateCacheEntry = { expiresAt: number }
const GATE_TTL_MS = 30_000
const gateCache = new Map<string, GateCacheEntry>()

type AccountGate = { status: "pending" | "active" | "blocked"; onboarded: boolean; staff: boolean }

async function accountGate(
  supabase: ReturnType<typeof createServerClient>,
  userId: string,
): Promise<AccountGate> {
  const now = Date.now()
  const cached = gateCache.get(userId)
  if (cached && cached.expiresAt > now) return { status: "active", onboarded: true, staff: false }

  const first = await supabase
    .from("profiles")
    .select("onboarding_completed, status, role")
    .eq("id", userId)
    .single()
  let profile: { onboarding_completed: boolean; status: string; role?: string } | null = first.data
  if (first.error?.code === "42703") {
    // Database without the status column yet (before 20261106130000):
    // every existing account was active, so behave as before.
    const legacy = await supabase.from("profiles").select("onboarding_completed").eq("id", userId).single()
    profile = legacy.data ? { ...legacy.data, status: "active" } : null
  }

  const status = (profile?.status as AccountGate["status"]) ?? "pending"
  const onboarded = Boolean(profile?.onboarding_completed)
  const staff = profile?.role === "staff"
  if (status === "active" && onboarded && !staff) {
    gateCache.set(userId, { expiresAt: now + GATE_TTL_MS })
  }
  return { status, onboarded, staff }
}

/** Copies the auth cookies the Supabase client wrote (refresh, sign-out). */
function withCookies<T extends NextResponse>(target: T, source: NextResponse): T {
  source.cookies.getAll().forEach((cookie) => target.cookies.set(cookie))
  target.headers.set("Cache-Control", "no-store")
  return target
}

/**
 * KU STEAM TEAM staff (profile role 'staff', created only by the TEAM
 * sign-in) on a facilitator page or API: checked on every request, never
 * cached. Teachers and admins never get here. Returns the response to send
 * instead of the page, or null to go on.
 * - access ended (TEAM sign-out, block, grant removed, expired, a session
 *   not opened through TEAM, CLASSROOM admin block): this CLASSROOM session
 *   is signed out (scope local, TEAM stays signed in); pages go to the
 *   message page, APIs get 401. An expired session (8 h) on a page goes
 *   through TEAM again, silently if the TEAM session is alive.
 * - the check failed: 503 for APIs, the "unavailable" message for pages.
 * - allowed: onboarding and the waiting page are not for staff.
 */
async function staffGate(
  supabase: ReturnType<typeof createServerClient>,
  request: NextRequest,
  userId: string,
  gate: AccountGate,
  current: () => NextResponse,
): Promise<NextResponse | null> {
  const url = request.nextUrl.clone()
  url.search = ""
  const isApi = request.nextUrl.pathname.startsWith("/api/")
  let decision: StaffDecision
  try {
    decision = await staffAccess(supabase, userId, gate.status, createAdminClient)
  } catch {
    decision = { kind: "unavailable" }
  }

  if (decision.kind === "unavailable") {
    const text = TEAM_SSO_MESSAGES.nepasiekiamas.text
    if (isApi) return withCookies(NextResponse.json({ error: text }, { status: 503 }), current())
    return withCookies(NextResponse.redirect(staffMessageUrl(url, "temporarily_unavailable"), 303), current())
  }

  if (decision.kind === "end") {
    // Ends this Supabase session only; TEAM's session (same project) stays.
    await supabase.auth.signOut({ scope: "local" }).catch(() => undefined)
    const kind = messageKindFor(decision.reason)
    if (isApi) {
      return withCookies(NextResponse.json({ error: TEAM_SSO_MESSAGES[kind].text }, { status: 401 }), current())
    }
    if (decision.reason === "expired" && request.method === "GET" && isTeamSsoEnabled()) {
      url.pathname = "/auth/team/start"
      url.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`)
      return withCookies(NextResponse.redirect(url, 303), current())
    }
    return withCookies(NextResponse.redirect(staffMessageUrl(url, decision.reason), 303), current())
  }

  const path = request.nextUrl.pathname
  if (/^\/api\/onboarding(\/|$)/.test(path)) {
    return NextResponse.json({ error: "KU STEAM darbuotojo profilį tvarko KU STEAM TEAM." }, { status: 403 })
  }
  if (path === "/onboarding" || path === "/laukia") {
    url.pathname = "/dashboard"
    return NextResponse.redirect(url)
  }
  return null
}

/** The message page, or TEAM itself while the sign-in is turned off. */
function staffMessageUrl(base: URL, reason: string): URL | string {
  if (!isTeamSsoEnabled()) return teamHomeUrl()
  return new URL(messagePath(messageKindFor(reason)), base.origin)
}

// Facilitator APIs need an active account. Participant and public APIs
// (play, teams, submissions, reflections, health, schools, access
// requests) do not: a signed-in teacher may also play in someone's class.
const FACILITATOR_API =
  /^\/api\/(admin|ai|challenges|di|games|import|lesson-plans|lessons|library|upload|onboarding)(\/|$)/

/** Where an account that may not use the facilitator area goes. */
function gateRedirect(gate: AccountGate, pathname: string): string | null {
  if (gate.status !== "active") return pathname === "/laukia" ? null : "/laukia"
  if (!gate.onboarded && pathname !== "/onboarding") return "/onboarding"
  return null
}

export async function proxy(request: NextRequest) {
  const hostname = request.headers.get("host") || ""
  const url = request.nextUrl.clone()

  const kind = hostKind(hostname)

  // After the switch to pamokos.kusteam.app, the old split hosts move their
  // visitors there (paths and query kept). Unset = old behaviour, so the
  // switch and its rollback are one environment variable.
  const canonical = legacyRedirect(
    kind,
    url.pathname,
    url.search,
    process.env.CANONICAL_CLASSROOM_HOST,
  )
  // 307 (temporary) while the switch is new: browsers do not cache it, so
  // unsetting the variable really rolls back. Move to 308 once it has been
  // stable for a while.
  if (canonical) {
    return NextResponse.redirect(canonical, 307)
  }

  // Participant routes on play.*: no auth, no Supabase calls, fast first paint.
  // Facilitator APIs on play.* still go through the account gate below.
  if (kind === "play" && !FACILITATOR_API.test(url.pathname)) {
    // Participants who type play.kusteam.app by hand should land on the
    // code entry screen, not the facilitator-facing landing page.
    if (url.pathname === "/" || url.pathname === "/play") {
      url.pathname = "/prisijungti"
      return NextResponse.redirect(url)
    }
    return NextResponse.next({ request })
  }

  // Participants who land on app.* (an old QR code, a shared link, or the
  // participant entry) belong on play.*: the facilitator auth guard below
  // would otherwise send them to a login page they cannot use.
  if (
    kind === "app" &&
    (url.pathname.startsWith("/play/") || url.pathname === "/prisijungti")
  ) {
    const playUrl = url.clone()
    playUrl.host = hostname.replace(/^app\./, "play.")
    return NextResponse.redirect(playUrl)
  }

  // Uptime checks call /api/health without a session. On app.* the auth
  // guard below would answer with the login page (HTML, 200), so let the
  // health route through before any Supabase call. Scheduled jobs
  // (/api/cron/*) carry their own secret and need no session either.
  if (url.pathname === "/api/health" || url.pathname.startsWith("/api/cron/")) {
    return NextResponse.next({ request })
  }

  // KU STEAM TEAM sign-in (/auth/team/*) works signed in or not and handles
  // the session itself: no refresh here, no login redirect, and its
  // ?code= must not be taken for a Supabase OAuth code (safety net below).
  if (url.pathname === "/auth/team" || url.pathname.startsWith("/auth/team/")) {
    return NextResponse.next({ request })
  }

  // Create Supabase client for auth refresh (teacher routes only)
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value)
          })
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // Refresh auth token
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Safety net: if ?code= lands on the wrong page (e.g. due to www redirect),
  // forward it to /auth/callback so the code exchange still happens
  if (
    url.searchParams.has("code") &&
    url.pathname !== "/auth/callback" &&
    !user
  ) {
    url.pathname = "/auth/callback"
    return NextResponse.redirect(url)
  }

  // Facilitator host app.*: everything except auth pages requires a session
  if (kind === "app") {
    const isAuthCallback = url.pathname === "/auth/callback"
    const isAuthPage = url.pathname.startsWith("/auth")
    // Always let /auth/callback and /auth/confirm through: they turn an
    // OAuth code or an invitation link into a session, even when another
    // session is already open in this browser.
    if (isAuthCallback || url.pathname === "/auth/confirm") {
      return response
    }

    if (!user && !isAuthPage) {
      url.pathname = "/auth/login"
      return NextResponse.redirect(url)
    }

    if (user && isAuthPage) {
      url.pathname = "/"
      return NextResponse.redirect(url)
    }

    if (user && !isAuthPage) {
      const gate = await accountGate(supabase, user.id)
      if (gate.staff && (!url.pathname.startsWith("/api/") || FACILITATOR_API.test(url.pathname))) {
        return (await staffGate(supabase, request, user.id, gate, () => response)) ?? response
      }
      if (FACILITATOR_API.test(url.pathname) && gate.status !== "active") {
        return NextResponse.json({ error: "Paskyra dar nepatvirtinta." }, { status: 403 })
      }
      if (!url.pathname.startsWith("/api/")) {
        const target = gateRedirect(gate, url.pathname)
        if (target) {
          url.pathname = target
          return NextResponse.redirect(url)
        }
      }
    }

    return response
  }

  // pamokos.* and the bare domain: one host for facilitators and participants,
  // only facilitator routes require a session.
  const isAuthCallback = url.pathname === "/auth/callback"
  const isAuthPage = url.pathname.startsWith("/auth")
  const isOnboarding = url.pathname === "/onboarding"
  const isTeacherRoute =
    url.pathname.startsWith("/dashboard") ||
    url.pathname.startsWith("/games") ||
    url.pathname.startsWith("/admin") ||
    url.pathname.startsWith("/library") ||
    url.pathname.startsWith("/lesson-plans")

  // Always let /auth/callback and /auth/confirm through (see above)
  if (isAuthCallback || url.pathname === "/auth/confirm") {
    return response
  }

  // The facilitator entry on pamokos.* is /vedejui; the older login address
  // keeps working and lands there with its query (e.g. ?error=) intact.
  if (kind === "pamokos" && url.pathname === "/auth/login" && !user) {
    url.pathname = "/vedejui"
    return NextResponse.redirect(url)
  }

  // Facilitator routes require a session
  if (isTeacherRoute && !user) {
    url.pathname = kind === "pamokos" ? "/vedejui" : "/auth/login"
    return NextResponse.redirect(url)
  }

  // Signed-in facilitators skip the login page. On pamokos.* the root stays
  // the role choice ("Vesti veiklą" / "Prisijungti prie veiklos").
  if (user && (isAuthPage || (url.pathname === "/" && kind !== "pamokos"))) {
    url.pathname = "/dashboard"
    return NextResponse.redirect(url)
  }

  // Account gate: pending or blocked accounts see /laukia, active ones
  // finish onboarding first. Participant pages are never gated.
  if (user && (isTeacherRoute || isOnboarding || url.pathname === "/laukia")) {
    const gate = await accountGate(supabase, user.id)
    if (gate.staff) return (await staffGate(supabase, request, user.id, gate, () => response)) ?? response
    const target = gateRedirect(gate, url.pathname)
    if (target && target !== url.pathname) {
      url.pathname = target
      return NextResponse.redirect(url)
    }
    if (url.pathname === "/laukia" && gate.status === "active") {
      url.pathname = gate.onboarded ? "/dashboard" : "/onboarding"
      return NextResponse.redirect(url)
    }
  }
  if (user && FACILITATOR_API.test(url.pathname)) {
    const gate = await accountGate(supabase, user.id)
    if (gate.staff) return (await staffGate(supabase, request, user.id, gate, () => response)) ?? response
    if (gate.status !== "active") {
      return NextResponse.json({ error: "Paskyra dar nepatvirtinta." }, { status: 403 })
    }
  }

  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|illustrations/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
