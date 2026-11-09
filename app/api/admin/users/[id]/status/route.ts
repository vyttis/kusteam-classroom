import { NextResponse, after } from "next/server"
import { z } from "zod"
import { requireSuperAdmin } from "@/lib/access/admin-guard"
import { grantAccount, logAdminAction, publicBaseUrl } from "@/lib/access/approve"
import { sendEmail } from "@/lib/email/send"
import { accountActivatedEmail } from "@/lib/email/templates"

const statusSchema = z.object({ status: z.enum(["active", "blocked"]) })

// PATCH /api/admin/users/[id]/status: block or unblock a facilitator, or
// decide on one who is waiting. Blocking stops writes at once (database
// policies) and sends the person to /laukia on the next page load.
// A waiting account is handled like its access request in the queue:
// approving fills the profile's empty name and school from the request
// (grantAccount), closes the request as approved and sends the "account
// activated" email; blocking closes the request as rejected, so a later
// approval of that request cannot undo the block.
export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const guard = await requireSuperAdmin()
  if (!guard.ok) return guard.response
  if (id === guard.userId) {
    return NextResponse.json({ error: "Savo paskyros užblokuoti negalite." }, { status: 400 })
  }
  const parsed = statusSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Neteisingas statusas." }, { status: 400 })

  const { data: before } = await guard.admin
    .from("profiles")
    .select("status, email, first_name")
    .eq("id", id)
    .maybeSingle()
  if (!before) return NextResponse.json({ error: "Vartotojas nerastas." }, { status: 404 })

  const now = new Date().toISOString()
  const waiting = before.status === "pending"
  const approving = waiting && parsed.data.status === "active"
  // Requests store the email in lower case; one pending request per email.
  const { data: pendingRequest } =
    waiting && before.email
      ? await guard.admin
          .from("access_requests")
          .select("id, email, first_name, last_name, school_code, school_name, municipality")
          .eq("email", before.email.toLowerCase())
          .eq("status", "pending")
          .maybeSingle()
      : { data: null }

  // grantAccount finds the profile by the lower-case email; with any other
  // spelling it would invite a new account, so it is used only when they match.
  if (approving && pendingRequest && before.email === before.email.toLowerCase()) {
    const account = await grantAccount(
      guard.admin,
      {
        email: pendingRequest.email,
        first_name: pendingRequest.first_name,
        last_name: pendingRequest.last_name,
        school_code: pendingRequest.school_code,
        school_name: pendingRequest.school_name,
        municipality: pendingRequest.municipality,
      },
      guard.userId,
    )
    if (!account.ok) return NextResponse.json({ error: account.error }, { status: account.status })
  } else {
    const update: Record<string, unknown> = { status: parsed.data.status }
    if (approving) {
      update.approved_at = now
      update.approved_by = guard.userId
    }
    const { error } = await guard.admin.from("profiles").update(update).eq("id", id)
    if (error) return NextResponse.json({ error: "Nepavyko pakeisti statuso." }, { status: 500 })
  }

  if (pendingRequest) {
    const decision = approving
      ? { status: "approved", user_id: id }
      : { status: "rejected", review_note: "Paskyra užblokuota." }
    const { error: requestError } = await guard.admin
      .from("access_requests")
      .update({ ...decision, reviewed_by: guard.userId, reviewed_at: now })
      .eq("id", pendingRequest.id)
      .eq("status", "pending")
    if (requestError) console.error("[users] status changed but request not closed", { code: requestError.code })
  }

  if (approving && before.email) {
    const loginUrl = `${publicBaseUrl(new URL(request.url).origin)}/vedejui`
    const firstName = before.first_name ?? pendingRequest?.first_name ?? null
    after(() => sendEmail(accountActivatedEmail(before.email, firstName, loginUrl)))
  }

  const action = parsed.data.status === "blocked" ? "block" : approving ? "approve" : "unblock"
  await logAdminAction(guard.admin, guard.userId, `profile.${action}`, "profile", id, {
    email: before.email,
    from: before.status,
    ...(pendingRequest ? { access_request: pendingRequest.id } : {}),
  })
  return NextResponse.json({ ok: true })
}
