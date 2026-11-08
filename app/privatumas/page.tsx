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
// docs/privacy-review.md. Retention terms: docs/data-retention.md.

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
            Platformai veikti KU naudoja paslaugų teikėjus: Supabase (duomenų bazė ir prisijungimas, duomenys
            laikomi ES), Vercel (svetainė), Resend (el. laiškai) ir Anthropic (DI pagalba vedėjams). Anthropic
            gauna tik vedėjų rengiamą užduočių ir pamokų turinį, ne dalyvių atsakymus. Jei vedėjas jungiasi per
            Google, prisijungimą atlieka Google. Jei teikėjas duomenis tvarko už Europos ekonominės erdvės ribų,
            taikomos BDAR numatytos apsaugos priemonės. Duomenų neparduodame ir reklamai nenaudojame.
          </p>
        </Section>

        <Section title="Kiek saugome">
          <ul className="list-disc space-y-1 pl-5">
            <li>Paskyrų prašymus: 90 dienų po sprendimo.</li>
            <li>Dalyvių rezultatus: 6 mėnesius po užsiėmimo. Vedėjas gali juos ištrinti ir anksčiau.</li>
            <li>Vedėjų paskyras: kol jos reikalingos. Nenaudojamas 24 mėnesius paskyras peržiūrime.</li>
            <li>DI naudojimo ir administravimo įrašus: 12 mėnesių.</li>
            <li>Importuotus dokumentus: ištriname po apdorojimo, ne vėliau kaip per 7 dienas.</li>
            <li>Atsargines kopijas: daromos kasdien ir saugomos ribotą laiką pagal paslaugos planą.</li>
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
            Naudojame tik būtinus vedėjo prisijungimo slapukus. Dalyvio įrenginyje iki 24 valandų saugomas komandos
            žetonas, kad perkrovus puslapį būtų galima tęsti. Analitikos ir reklamos slapukų nėra.
          </p>
        </Section>

        <p className="border-t border-border pt-4 text-sm text-muted-foreground">
          Atnaujinta {PRIVACY_NOTICE_UPDATED}.{" "}
          <Link href="/" className="underline">
            Grįžti į pradžią
          </Link>
        </p>
      </article>
    </main>
  )
}
