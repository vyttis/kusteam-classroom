// Seeds the throwaway local Supabase stack for e2e/local/full-lesson.spec.ts:
// one active, onboarded facilitator who can sign in with email and password.
//
// The account is created through the Auth admin API (service role), so
// handle_new_user() makes its profile as in production; the profile is then
// approved and marked as onboarded, which in production the super admin and
// the onboarding form do.
//
//   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
//   SUPABASE_SERVICE_ROLE_KEY=<local service role key> node e2e/local/seed.mjs
//
// It refuses any address that is not this machine: it must never run
// against a hosted project.
import { readFileSync } from "node:fs"
import { createClient } from "@supabase/supabase-js"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceRoleKey) {
  throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY of the local stack")
}
if (!["127.0.0.1", "localhost"].includes(new URL(url).hostname)) {
  throw new Error(`Refusing to seed ${new URL(url).host}: only a local Supabase stack is allowed`)
}

const account = JSON.parse(readFileSync(new URL("./teacher-account.json", import.meta.url), "utf8"))
const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })

async function findUserId(email) {
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) throw new Error(`listUsers: ${error.message}`)
  return data.users.find((u) => u.email === email)?.id ?? null
}

let userId = await findUserId(account.email)
if (userId) {
  // A second run on the same stack: keep the account, reset its password.
  const { error } = await supabase.auth.admin.updateUserById(userId, {
    password: account.password,
    email_confirm: true,
  })
  if (error) throw new Error(`updateUserById: ${error.message}`)
} else {
  const { data, error } = await supabase.auth.admin.createUser({
    email: account.email,
    password: account.password,
    email_confirm: true,
    user_metadata: { full_name: `${account.firstName} ${account.lastName}` },
  })
  if (error) throw new Error(`createUser: ${error.message}`)
  userId = data.user.id
}

const { data: profile, error: profileError } = await supabase
  .from("profiles")
  .update({
    status: "active",
    onboarding_completed: true,
    first_name: account.firstName,
    last_name: account.lastName,
    full_name: `${account.firstName} ${account.lastName}`,
    school: account.school,
    consent_at: new Date().toISOString(),
  })
  .eq("id", userId)
  .select("id, role, status, onboarding_completed")
  .single()
if (profileError) throw new Error(`profile update: ${profileError.message}`)
if (profile.role !== "teacher" || profile.status !== "active" || !profile.onboarding_completed) {
  throw new Error(`Unexpected profile after seeding: ${JSON.stringify(profile)}`)
}

console.log(`Seeded facilitator ${account.email} (role ${profile.role}, status ${profile.status})`)
