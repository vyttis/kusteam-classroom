import type { Metadata } from "next"
import Link from "next/link"
import type { ReactNode } from "react"
import { SteamLogo } from "@/components/steam-logo"
import { PRIVACY_NOTICE_STATUS, PRIVACY_NOTICE_UPDATED } from "@/lib/privacy"

export const metadata: Metadata = {
  title: "Privatumo pranešimas",
  description: "Kokius duomenis tvarko KU STEAM CLASSROOM, kam ir kiek laiko.",
  alternates: { canonical: "/privatumas" },
}

// Facts below were checked against the code, the database schema and the
// service settings on 2026-11-07 and 2026-11-08 (docs/privacy-review.md).
// Anything that could not be verified is an open question for the KU data
// protection officer and is shown with <Question> until Vytis Radvila
// approves the text. Storage and deletion per data category:
// docs/data-retention.md.

function Question({ children }: { children: ReactNode }) {
  return (
    <span className="mt-2 block rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
      <strong>Laukia patvirtinimo:</strong> {children}
    </span>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold text-steam-dark">{title}</h2>
      {children}
    </section>
  )
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-muted px-4 py-10">
      <article className="mx-auto max-w-2xl space-y-8 rounded-2xl bg-white p-6 text-sm leading-relaxed text-foreground shadow-sm sm:p-10">
        <div className="space-y-4">
          <SteamLogo size="small" />
          {PRIVACY_NOTICE_STATUS === "draft" ? (
            <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-amber-950">
              Projektas. Tekstas dar nepatvirtintas ir gali keistis.
            </p>
          ) : null}
          <h1 className="text-2xl font-extrabold text-steam-dark">Privatumo pranešimas</h1>
          <p className="text-muted-foreground">
            Kaip KU STEAM CLASSROOM (pamokos.kusteam.app) tvarko vedėjų ir dalyvių duomenis. Atnaujinta{" "}
            {PRIVACY_NOTICE_UPDATED}.
          </p>
        </div>

        <Section title="Kas tvarko duomenis">
          <p>
            Duomenų valdytojas yra VšĮ „Klaipėdos universitetas“, juridinio asmens kodas 211951150. Platformą
            administruoja Klaipėdos universiteto STEAM centras, el. paštas{" "}
            <a className="underline" href="mailto:steam@ku.lt">
              steam@ku.lt
            </a>
            .
          </p>
          <p>
            Duomenų apsaugos pareigūnas: Marius Kadelskas,{" "}
            <a className="underline" href="mailto:dpo@ku.lt">
              dpo@ku.lt
            </a>
            .
            <Question>
              kontaktas paimtas iš KU privatumo politikos (www.ku.lt/privatumo-politika). Prieš paskelbiant
              patvirtinti, kad jis galioja.
            </Question>
          </p>
        </Section>

        <Section title="Kam naudojami duomenys">
          <ul className="list-disc space-y-1 pl-5">
            <li>Vedėjų paskyroms: paskyros prašymui, patvirtinimui ir prisijungimui.</li>
            <li>Veikloms kurti ir vesti: užduotims, komandoms, atsakymams ir taškams.</li>
            <li>Rezultatams parodyti vedėjui, dalyviams ir klasės ekrane.</li>
            <li>DI pagalbai, kai vedėjas rengia užduotis ar pamokų planus.</li>
            <li>Veiklų statistikai ir DI naudojimo išlaidų ribojimui.</li>
            <li>Saugumui: bandymų ribojimui ir administratorių veiksmų žurnalui.</li>
            <li>Pranešimams el. paštu apie paskyrą ir prašymus.</li>
          </ul>
          <p>
            Pateikdamas paskyros prašymą ar profilį, vedėjas pažymi sutikimą, kad KU STEAM centras tvarkytų jo
            vardą, pavardę, el. paštą, mokyklą, dalykus ir klases veiklų organizavimo ir statistikos tikslais.
            <Question>
              teisinis pagrindas (sutikimas ar kitas pagrindas) ir, jei tai sutikimas, kaip jį atšaukti.
            </Question>
          </p>
        </Section>

        <Section title="Kokius duomenis tvarkome">
          <h3 className="font-semibold text-steam-dark">Vedėjai</h3>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              El. paštas, vardas, pavardė, mokykla (kodas, savivaldybė, tipas), dalykai ir klasės. Jungiantis per
              Google, ir Google pateiktas vardas bei profilio nuotraukos nuoroda.
            </li>
            <li>Paskyros būsena ir vaidmuo, sutikimo ir patvirtinimo data, kas patvirtino.</li>
            <li>Sukurtas turinys: veiklos, užduotys, paveikslėliai, pamokų planai, bibliotekos įrašai, įkelti dokumentai.</li>
            <li>DI naudojimas: kada, kokiai funkcijai, kiek žetonų ir kokia kaina. Užklausų turinio šiame įraše nėra.</li>
            <li>Administratorių veiksmai: kas, kada ir ką pakeitė (pvz., patvirtino prašymą, pakeitė vaidmenį).</li>
          </ul>
          <h3 className="font-semibold text-steam-dark">Paskyros prašymą pateikę žmonės</h3>
          <p>
            El. paštas, vardas, pavardė, mokykla, iš kurios veiklos ar nuorodos pateiktas prašymas, sprendimas ir
            jo pastaba.
          </p>
          <h3 className="font-semibold text-steam-dark">Dalyviai</h3>
          <p>
            Dalyviams paskyros nereikia. Tvarkome komandos pavadinimą, atsakymus, taškus, panaudotas užuominas,
            pasiekimus, refleksijos atsakymus ir prisijungimo laiką. Komandos pavadinime ir laisvuose atsakymuose
            nerašykite vardų, pavardžių ar kitos privačios informacijos.
          </p>
          <h3 className="font-semibold text-steam-dark">Techniniai duomenys</h3>
          <p>
            IP adresą platforma naudoja tik tam, kad apribotų per dažnus bandymus prisijungti prie veiklos, grįžti
            į komandą ar pateikti paskyros prašymą. Serveris iš adreso apskaičiuoja identifikatorių ir laiko jį tik
            savo darbinėje atmintyje. Nei adresas, nei identifikatorius į platformos duomenų bazę neįrašomi.
            Paslaugų teikėjai (žr. žemiau) savo techniniuose žurnaluose gali įrašyti IP adresą.
            <Question>
              ar ir kiek laiko IP adresą saugo paslaugų teikėjų žurnalai, taip pat vedėjų prisijungimo įvykių
              žurnalas.
            </Question>
          </p>
        </Section>

        <Section title="Kas mato duomenis">
          <ul className="list-disc space-y-1 pl-5">
            <li>Vedėjas mato savo veiklų komandas, atsakymus ir rezultatus.</li>
            <li>Klasės ekrane rodomi komandų pavadinimai ir taškai.</li>
            <li>KU STEAM centro administratoriai mato paskyras, prašymus, statistiką ir veiksmų žurnalą.</li>
            <li>
              Patvirtinti bibliotekos įrašai (užduotys be atsakymų ir be komandų rezultatų) nėra slapti: juos mato
              kiti vedėjai, o techniškai jie pasiekiami ir be prisijungimo.
            </li>
            <li>Užduočių paveikslėliai pasiekiami kiekvienam, kas turi jų nuorodą.</li>
          </ul>
        </Section>

        <Section title="Paslaugų teikėjai">
          <ul className="list-disc space-y-1 pl-5">
            <li>Supabase: duomenų bazė, prisijungimas ir failai. Projekto regionas: Frankfurtas (ES).</li>
            <li>Vercel: svetainės talpinimas. Serverio funkcijų regionas: Frankfurtas (ES).</li>
            <li>
              Anthropic: DI pagalba vedėjui. Siunčiamas tik vedėjo užduočių, pamokų planų ir įkeltų dokumentų
              tekstas. Dalyvių atsakymai DI paslaugai nesiunčiami.
            </li>
            <li>Resend: el. laiškai (prisijungimo kodas, kvietimas, pranešimai).</li>
            <li>Google: tik jei vedėjas pasirenka prisijungti per Google.</li>
          </ul>
          <Question>
            kur duomenis tvarko Anthropic, Resend ir Google, kuriame tinklo taške Vercel priima užklausas ir kur
            teikėjai saugo savo žurnalus; duomenų tvarkymo sutartys su teikėjais; ar duomenys perduodami už
            Europos ekonominės erdvės ribų ir kokiu pagrindu.
          </Question>
        </Section>

        <Section title="Kiek laiko saugome ir kaip ištriname">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Vedėjas gali ištrinti savo veiklą. Kartu ištrinamos jos komandos, atsakymai, refleksijos, pasiekimai
              ir skelbimai. Vedėjas gali pašalinti ir atskirą komandą. Užduočių paveikslėliai lieka saugykloje.
            </li>
            <li>Nebaigtos veiklos naktį automatiškai užbaigiamos, bet neištrinamos.</li>
            <li>
              Paskyros, paskyrų prašymai, DI naudojimo įrašai, administratorių veiksmų žurnalas, užduočių
              paveikslėliai ir įkelti dokumentai automatiškai neištrinami.
            </li>
            <li>
              Vedėjas savo paskyros pats ištrinti negali, tai gali padaryti tik KU STEAM centro administratorius.
              Kartu ištrinamos vedėjo veiklos ir pamokų planai. Patvirtinti bibliotekos įrašai lieka be autoriaus.
              Paskyros prašymas, DI naudojimo įrašai ir administratorių veiksmų žurnalo įrašai lieka; prašyme ir
              žurnale lieka el. pašto adresas.
            </li>
            <li>Duomenų bazės atsarginės kopijos daromos kasdien.</li>
          </ul>
          <Question>
            saugojimo terminai: vedėjų paskyroms, paskyrų prašymams (taip pat atmestiems), veiklų rezultatams,
            DI naudojimo įrašams, administratorių veiksmų žurnalui, užduočių paveikslėliams, įkeltiems
            dokumentams, atsarginėms kopijoms ir paslaugų teikėjų žurnalams.
          </Question>
        </Section>

        <Section title="Jūsų teisės">
          <p>
            Galite prašyti susipažinti su savo duomenimis, juos ištaisyti ar ištrinti, apriboti jų tvarkymą,
            nesutikti su tvarkymu ir atšaukti sutikimą. Rašykite{" "}
            <a className="underline" href="mailto:steam@ku.lt">
              steam@ku.lt
            </a>
            .
            <Question>ar prašymus priima STEAM centras, ar duomenų apsaugos pareigūnas.</Question>
          </p>
          <p>
            Skundą galite pateikti Valstybinei duomenų apsaugos inspekcijai,{" "}
            <a className="underline" href="mailto:ada@ada.lt">
              ada@ada.lt
            </a>
            .
          </p>
        </Section>

        <Section title="Slapukai ir naršyklės saugykla">
          <p>
            Vedėjo prisijungimui naudojami būtini prisijungimo slapukai. Dalyvio naršyklėje saugomas komandos
            prisijungimo žetonas ir laikmačio būsena, kad perkrovus puslapį komanda grįžtų į veiklą. Analitikos ir
            reklamos slapukų nenaudojame.
          </p>
        </Section>

        <p className="border-t border-border pt-6">
          <Link href="/" className="underline">
            Grįžti į pradžią
          </Link>
        </p>
      </article>
    </main>
  )
}
