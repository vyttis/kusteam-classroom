import { NextResponse, after } from "next/server"
import { z } from "zod"
import { requireSuperAdmin } from "@/lib/access/admin-guard"
import { grantAccount, logAdminAction, loginUrl } from "@/lib/access/approve"
import { sendEmail } from "@/lib/email/send"
import { accountActivatedEmail, requestRejectedEmail } from "@/lib/email/templates"

const decisionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }),
  z.object({ action: z.literal("reject"), note: z.string().trim().max(500).optional() }),
])

// POST /api/admin/access-requests/[id]: approve (sends the invitation or
// activates an existing account) or reject a pending request.
export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const guard = await requireSuperAdmin()
  if (!guard.ok) return guard.response

  const parsed = decisionSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Neteisingas veiksmas." }, { status: 400 })

  const { data: req } = await guard.admin
    .from("access_requests")
    .select("id, email, first_name, last_name, school_code, school_name, municipality, status")
    .eq("id", id)
    .maybeSingle()
  if (!req) return NextResponse.json({ error: "Prašymas nerastas." }, { status: 404 })
  if (req.status !== "pending") {
    return NextResponse.json({ error: "Šis prašymas jau išspręstas." }, { status: 409 })
  }

  const now = new Date().toISOString()
  // A decision in progress holds reviewed_at while the row stays pending, so
  // the one-pending-request-per-email rule keeps covering it. A claim older
  // than two minutes (a crashed attempt) can be taken over.
  const staleClaim = new Date(Date.now() - 2 * 60_000).toISOString()
  const unclaimed = `reviewed_at.is.null,reviewed_at.lt."${staleClaim}"`

  if (parsed.data.action === "reject") {
    const { data: rejected, error } = await guard.admin
      .from("access_requests")
      .update({ status: "rejected", review_note: parsed.data.note || null, reviewed_by: guard.userId, reviewed_at: now })
      .eq("id", id)
      .eq("status", "pending")
      .or(unclaimed)
      .select("id")
    if (error) return NextResponse.json({ error: "Nepavyko atmesti prašymo." }, { status: 500 })
    // Someone decided it a moment earlier: no audit line, no email.
    if (!rejected || rejected.length === 0) {
      return NextResponse.json({ error: "Šis prašymas jau išspręstas." }, { status: 409 })
    }
    await logAdminAction(guard.admin, guard.userId, "access_request.reject", "access_request", id, {
      email: req.email,
    })
    after(() => sendEmail(requestRejectedEmail(req.email, req.first_name)))
    return NextResponse.json({ ok: true, status: "rejected" })
  }

  // Claim the request first, so a double click cannot invite twice.
  const { data: claimed } = await guard.admin
    .from("access_requests")
    .update({ reviewed_by: guard.userId, reviewed_at: now })
    .eq("id", id)
    .eq("status", "pending")
    .or(unclaimed)
    .select("id")
  if (!claimed || claimed.length === 0) {
    return NextResponse.json({ error: "Šis prašymas jau išspręstas." }, { status: 409 })
  }

  const account = await grantAccount(
    guard.admin,
    {
      email: req.email,
      first_name: req.first_name,
      last_name: req.last_name,
      school_code: req.school_code,
      school_name: req.school_name,
      municipality: req.municipality,
    },
    guard.userId,
  )
  if (!account.ok) {
    await guard.admin.from("access_requests").update({ reviewed_by: null, reviewed_at: null }).eq("id", id)
    return NextResponse.json({ error: account.error }, { status: account.status })
  }

  const { error: doneError } = await guard.admin
    .from("access_requests")
    .update({ status: "approved", user_id: account.userId })
    .eq("id", id)
  if (doneError) console.error("[access-request] approved but not marked", { code: doneError.code })
  await logAdminAction(guard.admin, guard.userId, "access_request.approve", "access_request", id, {
    email: req.email,
    existing_account: account.existing,
  })
  // New or existing, the account is ready: tell the teacher where to sign in.
  after(() => sendEmail(accountActivatedEmail(req.email, req.first_name, loginUrl(new URL(request.url).origin))))

  return NextResponse.json({
    ok: true,
    status: "approved",
    message: account.existing
      ? "Paskyra jau buvo, ji aktyvuota: vedėjas gali prisijungti iš karto."
      : "Kvietimas išsiųstas el. paštu. Vedėjas prisijungs per Google arba su kodu ir užbaigs registraciją.",
  })
}
