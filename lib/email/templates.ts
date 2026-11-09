import type { EmailMessage } from "@/lib/email/send"
import { pluralizeLt } from "@/lib/utils"

/**
 * Lithuanian platform emails, built from the design in the "KU STEAM
 * pamokų laiškai" canvas. Email clients ignore flexbox, web fonts and SVG,
 * so the markup is tables with inline styles, Arial, and a PNG logo.
 * Every value that came from a form is escaped before it goes into HTML.
 */

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

const DARK = "#00323C"
const MUTED = "#4A6168"
const LINE = "#E3EAEC"
const GREEN = "#00D296"
const STRIPE = ["#008CB4", "#00323C", "#00D296", "#FA2864", "#FAC846"]
const FONT = "Arial, Helvetica, sans-serif"

function siteUrl(): string {
  return `https://${process.env.CANONICAL_CLASSROOM_HOST || "pamokos.kusteam.app"}`
}

/** A block of email HTML plus its plain-text twin. */
interface Part {
  html: string
  text: string
}

const paragraph = (html: string, text: string): Part => ({
  html: `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${DARK}">${html}</p>`,
  text,
})

const note = (html: string, text: string): Part => ({
  html: `<p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:${MUTED}">${html}</p>`,
  text,
})

const divider = (): Part => ({
  html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 24px"><tr><td style="height:1px;line-height:1px;font-size:1px;background:${LINE}">&nbsp;</td></tr></table>`,
  text: "",
})

function button(label: string, url: string): Part {
  return {
    html: `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px"><tr><td style="border-radius:10px;background:${GREEN}"><a href="${escapeHtml(url)}" style="display:inline-block;padding:14px 26px;font-family:${FONT};font-size:16px;font-weight:700;color:${DARK};text-decoration:none;border-radius:10px">${escapeHtml(label)}</a></td></tr></table>`,
    text: `${label}: ${url}`,
  }
}

/** Label and value rows. `boxed` draws the bordered list of the admin notice. */
function details(rows: [string, string][], opts: { heading?: string; boxed?: boolean; boldFirst?: boolean } = {}): Part {
  const cells = rows
    .map(([label, value], i) => {
      const border = opts.boxed && (i > 0 || opts.heading) ? `border-top:1px solid ${LINE};` : ""
      const pad = opts.boxed ? "12px 18px" : "5px 0"
      const weight = opts.boldFirst && i === 0 ? "font-weight:700;" : ""
      return `<tr><td class="lbl" style="${border}padding:${pad};width:120px;vertical-align:top;font-size:15px;line-height:1.5;color:${MUTED}">${escapeHtml(label)}</td><td style="${border}padding:${pad};vertical-align:top;font-size:15px;line-height:1.5;color:${DARK};${weight}">${escapeHtml(value)}</td></tr>`
    })
    .join("")
  const headingPad = opts.boxed ? "padding:10px 18px;background:#F5F8F9;" : "padding:0 0 6px;"
  const heading = opts.heading
    ? `<tr><td colspan="2" style="${headingPad}font-size:13px;font-weight:700;color:${MUTED}">${escapeHtml(opts.heading)}</td></tr>`
    : ""
  const box = opts.boxed
    ? `border:1px solid ${LINE};border-radius:12px;border-collapse:separate`
    : `background:#F5F8F9;border-radius:12px;border-collapse:separate`
  const wrapPad = opts.boxed ? "0" : "18px 20px"
  return {
    html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;${box}"><tr><td style="padding:${wrapPad}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${heading}${cells}</table></td></tr></table>`,
    text: [opts.heading, ...rows.map(([l, v]) => `${l}: ${v}`)].filter(Boolean).join("\n"),
  }
}

function progress(ratio: number, color: string): Part {
  const pct = Math.max(2, Math.min(100, Math.round(ratio * 100)))
  return {
    html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;background:${LINE};border-radius:6px;border-collapse:separate"><tr><td width="${pct}%" style="height:12px;line-height:12px;font-size:1px;background:${color};border-radius:6px">&nbsp;</td>${pct < 100 ? `<td style="font-size:1px">&nbsp;</td>` : ""}</tr></table>`,
    text: "",
  }
}

interface LayoutInput {
  subject: string
  preheader: string
  title: string
  parts: Part[]
  footer?: string
}

function render({ subject, preheader, title, parts, footer }: LayoutInput): { html: string; text: string } {
  const stripe = STRIPE.map((c) => `<td style="height:6px;line-height:6px;font-size:1px;background:${c}">&nbsp;</td>`).join("")
  const footerLines = [footer, "KU STEAM centras, Klaipėdos universitetas"].filter(Boolean) as string[]
  const html = `<!doctype html>
<html lang="lt"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(subject)}</title>
<style>@media (max-width:480px){.px{padding-left:20px!important;padding-right:20px!important}.lbl{width:92px!important}.amount td{display:block!important;text-align:left!important}}</style></head>
<body style="margin:0;padding:0;background:#F1F5F6">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#F1F5F6">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F6;font-family:${FONT}">
<tr><td align="center" style="padding:32px 16px 24px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#FFFFFF;border-radius:14px;border-collapse:separate;overflow:hidden">
<tr><td style="padding:0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${stripe}</tr></table></td></tr>
<tr><td class="px" style="padding:28px 40px 0"><img src="${siteUrl()}/email/steam-logo.png" width="145" height="40" alt="STEAM LT Klaipėda" style="display:block;border:0"></td></tr>
<tr><td class="px" style="padding:28px 40px 24px;font-family:${FONT};color:${DARK}">
<h1 style="margin:0 0 16px;font-size:26px;line-height:1.25;font-weight:700;color:${DARK}">${escapeHtml(title)}</h1>
${parts.map((p) => p.html).join("\n")}
</td></tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px"><tr><td align="center" style="padding:20px 24px 8px;font-family:${FONT};font-size:12px;line-height:1.6;color:${MUTED}">
${footerLines.map(escapeHtml).join("<br>")}<br>Klausimai: <a href="mailto:steam@ku.lt" style="color:#006F8F">steam@ku.lt</a>
</td></tr></table>
</td></tr></table>
</body></html>`
  const text = [title, "", ...parts.map((p) => p.text).filter(Boolean).flatMap((t) => [t, ""]), ...footerLines, "Klausimai: steam@ku.lt"].join("\n")
  return { html, text }
}

const REQUEST_FOOTER = "Šį laišką gavote, nes pateikėte prašymą gauti vedėjo paskyrą."
const ADMIN_FOOTER = "Šį laišką gaunate kaip KU STEAM pamokų super administratorius."

/** To the teacher, right after the request. */
export function requestReceivedEmail(
  to: string,
  r: { first_name: string; last_name: string; email: string; school: string | null; municipality: string | null },
): EmailMessage {
  const subject = "Gavome jūsų prašymą"
  const school = [r.school ?? "Nenurodyta", r.municipality].filter(Boolean).join(", ")
  const body = render({
    subject,
    preheader: "Kai paskyrą patvirtinsime, atsiųsime kvietimą į šį el. paštą.",
    title: "Prašymą gavome",
    parts: [
      paragraph(`Sveiki, ${escapeHtml(r.first_name)},`, `Sveiki, ${r.first_name},`),
      paragraph(
        "ačiū, kad norite vesti KU STEAM veiklas savo mokiniams. Prašymą peržiūrės KU STEAM centras. Kai paskyrą patvirtinsime, į šį el. paštą atsiųsime kvietimą su nuoroda. Daugiau nieko daryti nereikia.",
        "ačiū, kad norite vesti KU STEAM veiklas savo mokiniams. Prašymą peržiūrės KU STEAM centras. Kai paskyrą patvirtinsime, į šį el. paštą atsiųsime kvietimą su nuoroda. Daugiau nieko daryti nereikia.",
      ),
      details(
        [
          ["Vardas", `${r.first_name} ${r.last_name}`],
          ["El. paštas", r.email],
          ["Mokykla", school],
        ],
        { heading: "Ką pateikėte" },
      ),
      note("Pastebėjote klaidą? Atsakykite į šį laišką ir ją pataisysime.", "Pastebėjote klaidą? Atsakykite į šį laišką ir ją pataisysime."),
      divider(),
      note(
        `Prašymo neteikėte? Parašykite <a href="mailto:steam@ku.lt" style="color:#006F8F">steam@ku.lt</a> ir jį pašalinsime.`,
        "Prašymo neteikėte? Parašykite steam@ku.lt ir jį pašalinsime.",
      ),
    ],
  })
  return { to, subject, ...body }
}

export interface NewRequestDetails {
  name: string
  email: string
  school: string | null
  municipality: string | null
  source: string
  submittedAt: Date
  pending: number
}

const dateTime = new Intl.DateTimeFormat("lt-LT", {
  timeZone: "Europe/Vilnius",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
})

const prasymas = (n: number) => `${n} ${pluralizeLt(n, "prašymas", "prašymai", "prašymų")}`

/** To the super admin(s), when a request arrives. */
export function newRequestEmail(to: string[], d: NewRequestDetails, reviewUrl: string): EmailMessage {
  const subject = `Naujas paskyros prašymas: ${d.name}`
  const body = render({
    subject,
    preheader: `${d.school ?? "Mokykla nenurodyta"}, ${d.source}. Laukia sprendimo: ${d.pending}.`,
    title: "Naujas paskyros prašymas",
    footer: ADMIN_FOOTER,
    parts: [
      paragraph(
        "Gautas naujas vedėjo paskyros prašymas. Jį patvirtinus, prašytojui iškart išsiųsime kvietimą.",
        "Gautas naujas vedėjo paskyros prašymas. Jį patvirtinus, prašytojui iškart išsiųsime kvietimą.",
      ),
      details(
        [
          ["Vardas", d.name],
          ["El. paštas", d.email],
          ["Mokykla", d.school ?? "Nenurodyta"],
          ["Savivaldybė", d.municipality ?? "Nenurodyta"],
          ["Iš kur", d.source],
          ["Pateikta", dateTime.format(d.submittedAt)],
        ],
        { boxed: true, boldFirst: true },
      ),
      button("Peržiūrėti prašymus", reviewUrl),
      note(`Iš viso laukia sprendimo: ${prasymas(d.pending)}.`, `Iš viso laukia sprendimo: ${prasymas(d.pending)}.`),
    ],
  })
  return { to, subject, ...body }
}

/** To the teacher, when the request is declined. No reason is given. */
export function requestRejectedEmail(to: string, firstName: string): EmailMessage {
  const subject = "Dėl jūsų prašymo KU STEAM pamokose"
  const lines = [
    "dėkojame už prašymą. Šį kartą vedėjo paskyros suteikti negalime.",
    "KU STEAM centro veiklose dalyvauti galite ir toliau: dalyviams paskyros nereikia, užtenka veiklos kodo.",
    "Jei manote, kad įvyko klaida, arba norite aptarti kitas galimybes, tiesiog atsakykite į šį laišką.",
  ]
  const body = render({
    subject,
    preheader: "Šį kartą vedėjo paskyros suteikti negalime.",
    title: "Dėl vedėjo paskyros",
    footer: REQUEST_FOOTER,
    parts: [paragraph(`Sveiki, ${escapeHtml(firstName)},`, `Sveiki, ${firstName},`), ...lines.map((l) => paragraph(l, l))],
  })
  return { to, subject, ...body }
}

/**
 * To a teacher whose account already existed (e.g. tried Google sign-in
 * and was waiting): approval activates it and no invitation is sent, so
 * this tells them they can sign in.
 */
export function accountActivatedEmail(to: string, firstName: string | null, loginUrl: string): EmailMessage {
  const subject = "Jūsų vedėjo paskyra patvirtinta"
  const greeting = firstName ? `Sveiki, ${firstName},` : "Sveiki,"
  const lines = [
    "jūsų vedėjo paskyra KU STEAM pamokose jau aktyvi. Prisijunkite per Google arba su kodu, kurį atsiųsime el. paštu. Naudokite šį el. pašto adresą.",
    "Pirmą kartą prisijungę pažymėsite, kokius dalykus ir kokioms klasėms mokote. Tai užtruks minutę.",
  ]
  const display = loginUrl.replace(/^https?:\/\//, "")
  const body = render({
    subject,
    preheader: "Paskyra aktyvi. Prisijunkite per Google arba su kodu.",
    title: "Paskyra patvirtinta",
    footer: REQUEST_FOOTER,
    parts: [
      paragraph(escapeHtml(greeting), greeting),
      ...lines.map((l) => paragraph(l, l)),
      button("Prisijungti", loginUrl),
      divider(),
      note(
        `Prisijungimo adresas: <a href="${escapeHtml(loginUrl)}" style="color:#006F8F">${escapeHtml(display)}</a>`,
        `Prisijungimo adresas: ${loginUrl}`,
      ),
    ],
  })
  return { to, subject, ...body }
}

export interface AiBudgetDetails {
  spentUsd: number
  budgetUsd: number
  /** "lapkričio" (genitive month name) */
  monthGenitive: string
  /** "gruodžio 1 d." */
  resetsOn: string
  top: { name: string; requests: number; costUsd: number }[]
}

const usd = (n: number) =>
  `${new Intl.NumberFormat("lt-LT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)} USD`
const uzklausa = (n: number) => `${n} ${pluralizeLt(n, "užklausa", "užklausos", "užklausų")}`

/** To the super admin(s): 80 % of the monthly DI budget used, or all of it. */
export function aiBudgetEmail(to: string[], d: AiBudgetDetails, adminUrl: string): EmailMessage {
  const exhausted = d.spentUsd >= d.budgetUsd
  const ratio = d.budgetUsd > 0 ? d.spentUsd / d.budgetUsd : 1
  const pct = Math.min(100, Math.floor(ratio * 100))
  const subject = exhausted
    ? `DI biudžetas išnaudotas: DI funkcijos išjungtos iki ${d.resetsOn}`
    : `DI biudžetas: išnaudota ${pct} % ${d.monthGenitive} sumos`
  const amount: Part = {
    html: `<table role="presentation" class="amount" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 10px"><tr><td style="font-size:32px;font-weight:700;color:${DARK}">${usd(d.spentUsd)}</td><td align="right" style="font-size:15px;color:${MUTED}">iš ${usd(d.budgetUsd)} ${escapeHtml(d.monthGenitive)} mėnesiui</td></tr></table>`,
    text: `${usd(d.spentUsd)} iš ${usd(d.budgetUsd)} ${d.monthGenitive} mėnesiui`,
  }
  const parts: Part[] = [amount, progress(ratio, exhausted ? "#FA2864" : "#FAC846")]
  if (exhausted) {
    const a = `DI funkcijos (užduočių kūrimas, tikrinimas, pamokų planai) vedėjams išjungtos iki ${d.resetsOn} Vedėjai mato pranešimą, kad mėnesio DI limitas pasiektas.`
    const b = "Veiklos, užduotys ir rezultatai veikia kaip įprastai. Jei DI reikia jau dabar, padidinkite biudžetą: funkcijos įsijungs iš karto."
    parts.push(paragraph(escapeHtml(a), a), paragraph(b, b), button("Keisti biudžetą", adminUrl), divider())
    const c = "Sąskaitą už DI naudojimą išrašo Anthropic. Šis biudžetas yra platformos riba, kad išlaidos neviršytų jūsų nustatytos sumos."
    parts.push(note(c, c))
  } else {
    const a = "Pasiekus 100 %, DI funkcijos vedėjams išsijungs iki mėnesio pabaigos. Veiklos ir jau sukurtos užduotys veiks kaip įprastai."
    parts.push(paragraph(a, a))
    if (d.top.length > 0) {
      parts.push(
        details(
          d.top.map((t) => [t.name, `${uzklausa(t.requests)}, ${usd(t.costUsd)}`] as [string, string]),
          { heading: "Daugiausiai šį mėnesį", boxed: true },
        ),
      )
    }
    parts.push(button("Atidaryti DI naudojimą", adminUrl))
    const c = "Ten galite padidinti biudžetą arba pakeisti vedėjų mėnesio limitus."
    parts.push(note(c, c))
  }
  const body = render({
    subject,
    preheader: exhausted
      ? `Išleista ${usd(d.spentUsd)} iš ${usd(d.budgetUsd)}. Veiklos veikia kaip įprastai.`
      : `${usd(d.spentUsd)} iš ${usd(d.budgetUsd)}. Pasiekus 100 %, DI funkcijos vedėjams išsijungs.`,
    title: exhausted ? "Mėnesio DI biudžetas išnaudotas" : `Išnaudota ${pct} % mėnesio DI biudžeto`,
    footer: ADMIN_FOOTER,
    parts,
  })
  return { to, subject, ...body }
}
