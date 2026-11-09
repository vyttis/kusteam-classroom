import { NextResponse, after } from "next/server"
import { z } from "zod"
import { requireSuperAdmin } from "@/lib/access/admin-guard"
import { grantAccount, logAdminAction, loginUrl } from "@/lib/access/approve"
import { sendEmail } from "@/lib/email/send"
import { accountActivatedEmail } from "@/lib/email/templates"
import { schoolChoiceSchema } from "@/lib/access/profile-fields"

const inviteSchema = z
  .object({
    email: z.string().trim().toLowerCase().email("Neteisingas el. pašto adresas").max(200),
    first_name: z.string().trim().min(1, "Įveskite vardą").max(80),
    last_name: z.string().trim().min(1, "Įveskite pavardę").max(80),
    role: z.enum(["teacher", "admin", "super_admin"]),
  })
  .merge(schoolChoiceSchema.partial())

// POST /api/admin/invite: the super admin creates an account directly
// (same result as approving a request). The person gets an invitation
// email and completes the profile on first sign-in.
export async function POST(request: Request) {
  const guard = await requireSuperAdmin()
  if (!guard.ok) return guard.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Netinkamas užklausos formatas." }, { status: 400 })
  }
  const parsed = inviteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Patikrinkite laukus." }, { status: 400 })
  }
  const d = parsed.data

  const result = await grantAccount(
    guard.admin,
    {
      email: d.email,
      first_name: d.first_name,
      last_name: d.last_name,
      school_code: d.school_code ?? null,
      school_name: d.school_name?.trim() || null,
      municipality: d.municipality ?? null,
      role: d.role,
    },
    guard.userId,
  )
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

  await logAdminAction(guard.admin, guard.userId, result.existing ? "account.activate" : "account.invite", "profile", result.userId, {
    email: d.email,
    role: d.role,
  })

  // The email links to the sign-in page, not to a one-time link, so it does
  // not expire. Creating the same account again sends it again.
  after(() => sendEmail(accountActivatedEmail(d.email, d.first_name, loginUrl(new URL(request.url).origin))))

  const { data: profile } = await guard.admin.from("profiles").select("*").eq("id", result.userId).single()
  return NextResponse.json({
    ok: true,
    existing: result.existing,
    user: profile,
    message: result.existing
      ? "Paskyra su šiuo el. paštu jau buvo. Ji aktyvuota, rolė nepakeista, kvietimas išsiųstas iš naujo."
      : "Kvietimas išsiųstas el. paštu.",
  })
}
