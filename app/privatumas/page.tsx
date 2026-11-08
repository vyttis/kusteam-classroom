import type { Metadata } from "next"
import Link from "next/link"
import type { ReactNode } from "react"
import { SteamLogo } from "@/components/steam-logo"
import { PRIVACY_NOTICE_STATUS, PRIVACY_NOTICE_UPDATED } from "@/lib/privacy"

export const metadata: Metadata = {
  title: "Privatumo pranešimas",
  description: "Kaip KU STEAM CLASSROOM tvarko vedėjų ir dalyvių duomenis.",
  alternates: { canonical: "/privatumas" },
}

// Short, layered notice (KU DPO advice, 2026-11-08): this page is the full
// layer; the registration forms and the participant join page carry one
// sentence and a link. Sources, legal basis reasoning and technical detail:
// docs/privacy-review.md. "Kiek saugome" states what happens today: the
// terms in docs/data-retention.md go on this page only once the nightly job
// runs with RETENTION_MODE=delete in production.

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-bold text-steam-dark">{title}</h2>
      {children}
    </section>
  )
}

function Mail({ to }: { to: string }) {
  return (
    <a className="underline" href={`mailto:${to}`}>
      {to}
    </a>
  )
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-muted px-4 py-8">
      <article className="mx-auto max-w-xl space-y-6 rounded-2xl bg-white p-5 text-[15px] leading-relaxed text-foreground shadow-sm sm:p-8">
        <div className="space-y-3">
          <SteamLogo size="small" />
          {PRIVACY_NOTICE_STATUS === "draft" ? (
            <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              Projektas. Tekstas dar nepatvirtintas ir gali keistis.
            </p>
          ) : null}
          <h1 className="text-2xl font-extrabold text-steam-dark">Privatumo pranešimas</h1>
          <p>
            KU STEAM CLASSROOM (pamokos.kusteam.app) yra Klaipėdos universiteto platforma interaktyvioms pamokoms.
            Čia trumpai paaiškiname, kaip tvarkome duomenis.
          </p>
        </div>

        <Section title="Kas tvarko duomenis">
          <p>
            Klaipėdos universitetas (VšĮ, juridinio asmens kodas 211951150). Platformą administruoja KU STEAM
            centras: <Mail to="steam@ku.lt" />. Duomenų apsaugos pareigūnas: <Mail to="dpo@ku.lt" />.
          </p>
        </Section>

        <Section title="Kokius duomenis renkame">
          <p>
            <strong>Vedėjų:</strong> vardą, pavardę, el. paštą, mokyklą, dalykus ir klases, sukurtas veiklas ir
            įkeltą medžiagą. Taip pat apskaitome DI pagalbos naudojimą ir administratorių veiksmus.
          </p>
          <p>
            <strong>Dalyvių:</strong> paskyros nereikia. Tvarkome komandos pavadinimą, atsakymus, taškus ir
            refleksiją. Komandos pavadinime ir atsakymuose nerašykite vardų, pavardžių ar kitos asmeninės
            informacijos.
          </p>
        </Section>

        <Section title="Kodėl ir kokiu pagrindu">
          <p>
            Duomenis naudojame, kad suteiktume vedėjo paskyrą, leistume kurti ir vesti veiklas, parodytume
            rezultatus, apsaugotume platformą nuo piktnaudžiavimo ir rengtume apibendrintą statistiką. Tai
            Klaipėdos universiteto švietimo veikla, vykdoma viešojo intereso labui (BDAR 6 straipsnio 1 dalies
            e punktas).
          </p>
        </Section>

        <Section title="Kas mato ir kam perduodame">
          <p>
            Vedėjas mato savo veiklų rezultatus. Klasės ekrane rodomi komandų pavadinimai ir taškai. Patvirtintus
            bibliotekos šablonus mato kiti prisijungę vedėjai. Užduočių paveikslėliai pasiekiami pagal nuorodą.
          </p>
          <p>
            Platforma veikia naudodama šių paslaugų teikėjų paslaugas: Supabase (duomenų bazė ir prisijungimas,
            duomenys laikomi ES), Vercel (svetainė), Resend (el. laiškai) ir Anthropic (DI pagalba vedėjams).
            Anthropic gauna tik vedėjų rengiamą užduočių ir pamokų turinį, ne dalyvių atsakymus. Jei vedėjas
            jungiasi per Google, prisijungimą atlieka Google. Šių teikėjų duomenų tvarkymo sąlygose perdavimams už
            Europos ekonominės erdvės ribų numatytos ES standartinės sutarčių sąlygos. Duomenų neparduodame ir
            reklamai nenaudojame.
          </p>
        </Section>

        <Section title="Kiek saugome">
          <p>Duomenis saugome tol, kol jų reikia aukščiau nurodytiems tikslams.</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Vedėjas savo veiklą gali ištrinti bet kada. Kartu ištrinami tos veiklos komandų pavadinimai, atsakymai,
              taškai ir refleksijos.
            </li>
            <li>Kitų duomenų, taip pat paskyros, ištrynimo galite paprašyti el. paštu (žr. „Jūsų teisės“).</li>
            <li>Automatinio senų duomenų trynimo pagal terminą šiuo metu nėra.</li>
            <li>Duomenų bazės atsargines kopijas paslaugos teikėjas daro kasdien ir saugo ribotą laiką.</li>
          </ul>
        </Section>

        <Section title="Jūsų teisės">
          <p>
            Galite prašyti susipažinti su savo duomenimis, juos ištaisyti ar ištrinti, apriboti tvarkymą arba
            nesutikti su tvarkymu. Rašykite <Mail to="steam@ku.lt" /> arba <Mail to="dpo@ku.lt" />. Jei manote, kad
            jūsų teisės pažeistos, galite kreiptis į Valstybinę duomenų apsaugos inspekciją (vdai.lrv.lt).
          </p>
        </Section>

        <Section title="Slapukai">
          <p>
            Naudojame tik būtinus vedėjo prisijungimo slapukus. Dalyvio naršyklėje išsaugomas komandos žetonas, kad
            perkrovus puslapį būtų galima tęsti. Po 24 valandų jis nebenaudojamas ir ištrinamas, kai veiklos puslapis
            vėl atidaromas. Analitikos ir reklamos slapukų nėra.
          </p>
        </Section>

        <p className="border-t border-border pt-4 text-sm text-muted-foreground">
          Atnaujinta {PRIVACY_NOTICE_UPDATED}{" "}
          <Link href="/" className="underline">
            Grįžti į pradžią
          </Link>
        </p>
      </article>
    </main>
  )
}
