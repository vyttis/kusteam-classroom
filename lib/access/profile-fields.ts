import { z } from "zod"

// The legal basis is KU's public-interest education task, not consent
// (docs/privacy-review.md), so the box confirms the notice was read. The
// API field keeps its name `consent`; consent_at records when.
export const PRIVACY_ACK_TEXT = "Susipažinau su privatumo pranešimu."
export const PRIVACY_ACK_REQUIRED = "Pažymėkite, kad susipažinote su privatumo pranešimu."
export const REQUEST_PRIVACY_NOTE =
  "Prašymo duomenis Klaipėdos universitetas naudoja tik vedėjo paskyrai suteikti."
export const PROFILE_PRIVACY_NOTE =
  "Profilio duomenis Klaipėdos universitetas naudoja vedėjo paskyrai, veikloms ir apibendrintai statistikai."

/** Subjects a facilitator teaches, for statistics. Shown as chips. */
export const SUBJECTS = [
  "Pradinis ugdymas",
  "Lietuvių kalba ir literatūra",
  "Matematika",
  "Informatika",
  "Fizika",
  "Chemija",
  "Biologija",
  "Gamtos mokslai",
  "Geografija",
  "Istorija",
  "Pilietiškumas",
  "Ekonomika ir verslumas",
  "Užsienio kalba",
  "Technologijos",
  "Dailė",
  "Muzika",
  "Fizinis ugdymas",
  "Etika ar tikyba",
  "Ugdymas karjerai",
  "Neformalusis ugdymas",
  "Ikimokyklinis ugdymas",
  "Kita",
] as const

/** Class bands rather than single grades: easier to pick on a phone. */
export const GRADE_BANDS = ["1-4 kl.", "5-6 kl.", "7-8 kl.", "9-10 kl.", "11-12 kl.", "Kita"] as const

const name = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `Įveskite ${label}`)
    .max(80, `${label[0].toUpperCase()}${label.slice(1)} per ilgas`)

export const schoolChoiceSchema = z.object({
  school_code: z.string().regex(/^\d{5,12}$/).nullable().optional(),
  school_name: z.string().trim().min(2, "Pasirinkite arba įrašykite mokyklą").max(200),
  municipality: z.string().trim().max(80).nullable().optional(),
})

/** What a teacher sends with an access request. */
export const accessRequestSchema = z
  .object({
    first_name: name("vardą"),
    last_name: name("pavardę"),
    email: z.string().trim().toLowerCase().email("Neteisingas el. pašto adresas").max(200),
    consent: z.literal(true, { message: PRIVACY_ACK_REQUIRED }),
    // Exactly one way in: the team's session (finish screen), the activity
    // QR token, or a request link token.
    game_code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{6}$/).optional(),
    session_token: z.string().min(10).max(100).optional(),
    activity_token: z.string().min(10).max(100).optional(),
    link_token: z.string().min(10).max(100).optional(),
  })
  .merge(schoolChoiceSchema)

/** What a facilitator fills in on first sign-in. */
export const onboardingSchema = z
  .object({
    first_name: name("vardą"),
    last_name: name("pavardę"),
    subjects: z.array(z.enum(SUBJECTS)).min(1, "Pasirinkite bent vieną dalyką").max(SUBJECTS.length),
    grades: z.array(z.enum(GRADE_BANDS)).min(1, "Pasirinkite bent vieną klasių grupę").max(GRADE_BANDS.length),
    consent: z.literal(true, { message: PRIVACY_ACK_REQUIRED }),
  })
  .merge(schoolChoiceSchema)

