import type { Metadata } from "next"
import Link from "next/link"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "Kaip vesti veiklą",
  description: "Trumpas praktinis gidas vedėjui: nuo pasiruošimo iki aptarimo po pamokos.",
}

// "Kaip vesti veiklą": a short handbook for facilitators. Every statement
// about the product was checked against the code when it was written; the
// quoted labels are the real button and section names. tests/teacher-guide
// keeps the text free of long dashes and its links pointing at real routes.
// When a label changes in the product, change it here too.

const SECTIONS = [
  { id: "pries-pamoka", title: "Prieš pamoką" },
  { id: "pamokos-pradzia", title: "Pamokos pradžia" },
  { id: "kol-komandos-dirba", title: "Kol komandos dirba" },
  { id: "pabaiga", title: "Pabaiga" },
  { id: "po-pamokos", title: "Po pamokos" },
  { id: "di-pagalba", title: "DI pagalba" },
  { id: "privatumas", title: "Privatumas" },
] as const

type SectionId = (typeof SECTIONS)[number]["id"]

function Section({ id, children }: { id: SectionId; children: ReactNode }) {
  const index = SECTIONS.findIndex((s) => s.id === id)
  return (
    <section aria-labelledby={id} className="scroll-mt-20 space-y-3 border-t border-border/60 pt-6">
      <h2 id={id} tabIndex={-1} className="text-xl font-bold text-steam-dark break-after-avoid focus:outline-none">
        <span className="mr-2 text-primary-ink tabular-nums" aria-hidden="true">
          {index + 1}.
        </span>
        {SECTIONS[index].title}
      </h2>
      {children}
    </section>
  )
}

function Points({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-2 pl-5 marker:text-primary-ink">{children}</ul>
}

/** The lead words of a point, so the page can be scanned on a phone. */
function B({ children }: { children: ReactNode }) {
  return <strong className="font-semibold text-steam-dark">{children}</strong>
}

const linkClass = "font-medium text-steam-dark underline underline-offset-4 hover:text-primary-ink"

export default function GuidePage() {
  return (
    <article className="mx-auto max-w-2xl space-y-6 rounded-2xl bg-white p-5 text-base leading-relaxed text-foreground shadow-sm sm:p-8 print:max-w-none print:rounded-none print:p-0 print:shadow-none">
      <header className="space-y-3">
        <p className="text-sm font-semibold text-primary-ink">Gidas vedėjui</p>
        <h1 className="text-2xl font-bold text-steam-dark sm:text-3xl">Kaip vesti veiklą</h1>
        <p className="text-muted-foreground">
          Trumpas praktinis vadovas nuo pasiruošimo iki aptarimo. Perskaitysite per penkias minutes, o prieš pirmą
          pamoką verta jį atsispausdinti.
        </p>
      </header>

      <nav aria-labelledby="gido-turinys" className="rounded-xl bg-muted p-4 print:hidden">
        <h2 id="gido-turinys" className="mb-2 text-sm font-semibold text-steam-dark">
          Turinys
        </h2>
        <ol className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
          {SECTIONS.map((s, i) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className={`inline-flex min-h-9 items-center ${linkClass}`}>
                {i + 1}. {s.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <Section id="pries-pamoka">
        <Points>
          <li>
            <B>Pasirinkite veiklą pagal tikslą.</B> Pirmiausia nuspręskite, ką dalyviai po veiklos turi mokėti
            geriau, tada ieškokite tam tinkamų užduočių tarp{" "}
            <Link href="/paruostos-veiklos" className={linkClass}>
              paruoštų veiklų
            </Link>{" "}
            arba{" "}
            <Link href="/games/new" className={linkClass}>
              kurkite savo
            </Link>
            .
          </li>
          <li>
            <B>Peržiūrėkite užduotis ir atsakymus.</B> Kiekvieną užduotį išspręskite patys. Išsaugoto atsakymo
            sistema neberodo, todėl suabejoję tiesiog įrašykite jį iš naujo.
          </li>
          <li>
            <B>Suplanuokite komandas.</B> Geriausiai dirba komandos nuo 2 iki 4 dalyvių: didesnėje kas nors lieka
            be darbo. Vienai komandai užtenka vieno telefono.
          </li>
          <li>
            <B>Pasitikrinkite projektorių ir Wi-Fi.</B> Atidarykite veiklą klasės kompiuteryje, o QR kodą
            nuskaitykite savo telefonu per tą tinklą, kuriuo jungsis dalyviai.
          </li>
          <li>
            <B>Turėkite atsarginį planą be interneto.</B> Be ryšio veikla neveikia. Užduotis iš anksto
            nusirašykite arba atsispausdinkite: prireikus komandos jas spręs popieriuje, o aptarsite taip pat.
          </li>
        </Points>
      </Section>

      <Section id="pamokos-pradzia">
        <Points>
          <li>
            <B>QR kodas ekrane.</B> Veiklos puslapyje spauskite „Pradėti veiklą“, tada „Klasės ekranas“.
            Projektoriuje matysite QR kodą, veiklos kodą ir adresą. Dalyviai nuskaito QR kodą telefonu arba
            įveda veiklos kodą nurodytu adresu. Paskyrų jiems nereikia.
          </li>
          <li>
            <B>Komandų vardai be tikrų vardų ir pavardžių.</B> Paprašykite sugalvoti pavadinimą. Netinkamą
            pakeisite patys: veiklos puslapyje, komandos kortelėje, spauskite tris taškus ir rinkitės
            „Pervadinti“.
          </li>
          <li>
            <B>Uždarykite prisijungimą.</B> Kai visos komandos prisijungė, skiltyje „Prisijungimas“ išjunkite
            naujų komandų priėmimą.
          </li>
          <li>
            <B>Susitarkite dėl vaidmenų.</B> Skaitovas garsiai perskaito užduotį, rašytojas įveda atsakymą,
            tikrintojas prieš pateikiant patikrina, ar visi sutinka. Kas kelias užduotis vaidmenimis
            pasikeiskite. Atsakymas pateikiamas tik komandai sutarus.
          </li>
        </Points>
      </Section>

      <Section id="kol-komandos-dirba">
        <Points>
          <li>
            <B>Stebėkite, o ne spręskite už komandas.</B> Veiklos puslapyje matote kiekvienos komandos taškus,
            išspręstų užduočių skaičių ir paskutinio atsakymo laiką. Komanda, daugiau kaip penkias minutes
            nepateikusi atsakymo, pažymima „Įstrigo!“. Prieikite ir užduokite klausimą, o ne pasakykite
            atsakymą.
          </li>
          <li>
            <B>„Pristabdyti“</B> spauskite, kai reikia visų dėmesio: pastebėjote bendrą klaidą arba norite ką
            nors paaiškinti. Dalyviai mato pauzės pranešimą, o pauzės laikas pridedamas automatiškai.
          </li>
          <li>
            <B>Pranešimą</B> siųskite, kai darbo nutraukti nereikia, pavyzdžiui, „Liko 5 minutės“. Jis rašomas
            skiltyje „Pranešimai“ arba klasės ekrano apačioje.
          </li>
          <li>
            <B>Laiką pratęskite,</B> jei veikla turi laiko limitą, o dauguma komandų nespėja. Klasės ekrane
            pridėsite 5 arba 10 minučių, skiltyje „Laiko valdymas“ mygtuku „Pratęsti“ pridėsite tiek, kiek
            reikia. Limitas skaičiuojamas kiekvienai komandai atskirai, nuo tada, kai ji pradeda: kiek liko,
            matote jos kortelėje, o klasės ekrano laikmatis skaičiuoja nuo veiklos pradžios. Kai jis pasiekia
            nulį, naujos komandos nebepriimamos, kol laiko nepratęsite.
          </li>
          <li>
            <B>Komanda prarado ryšį ar įrenginį.</B> Jei puslapis tik užsidarė, užtenka jį vėl atidaryti tame
            pačiame telefone. Jei telefonas išsikrovė, komandos kortelėje spauskite tris taškus ir rinkitės
            „Grąžinti į komandą“. Gausite QR kodą ir nuorodą, galiojančius 10 minučių ir vieną kartą: nuskaičiusi
            juos kitu įrenginiu, komanda tęsia su tais pačiais taškais, o ankstesnis jos įrenginys atjungiamas.
            Kodą rodykite tik tai komandai.
          </li>
          <li>
            <B>Rezultatų lentelė</B> motyvuoja, bet varžymasis lengvai užgožia mokymąsi. Jei klasė linkusi
            lenktyniauti, prieš pradėdami veiklos nustatymuose išjunkite rezultatų lentelę: dalyviai nematys
            kitų komandų rezultatų, o klasės ekrane liks tik komandų pavadinimai. Jei lentelę rodote, girkite
            pažangą ir gerą susitarimą, ne užimtą vietą.
          </li>
        </Points>
      </Section>

      <Section id="pabaiga">
        <Points>
          <li>
            <B>Refleksija.</B> Paspauskite „Baigti veiklą“ (šio veiksmo atšaukti negalima). Dalyviai telefone
            pamato savo taškus ir trumpą refleksiją: kuri užduotis buvo sudėtingiausia, ką kitą kartą darytų
            kitaip, kas patiko. Skirkite tam porą ramių minučių.
          </li>
          <li>
            <B>Aptarkite pagal dažniausias klaidas, ne pagal užimtą vietą.</B> Veiklos puslapyje „Klasės
            rezultatų suvestinė“ parodo sudėtingiausias užduotis: pradėkite nuo jų. Klauskite „Kaip
            galvojote?“, o ne „Kas laimėjo?“.
          </li>
        </Points>
      </Section>

      <Section id="po-pamokos">
        <Points>
          <li>
            <B>Analitika ir CSV.</B> Puslapyje „Analitika“ rasite komandų rezultatus, užduočių statistiką ir
            refleksijas. Lenteles galite atsisiųsti mygtuku „Eksportuoti CSV“, o baigtos veiklos puslapyje yra
            „Spausdinti ataskaitą“.
          </li>
          <li>
            <B>Ką pakeisti kitą kartą.</B> Užduotis, kurią visi išsprendė iš pirmo karto, gali būti per lengva.
            Jei užduoties beveik niekas neišsprendė, patikslinkite sąlygą arba pridėkite užuominą. Kitai klasei
            pasidarykite veiklos kopiją („Daugiau“, tada „Kopijuoti“) ir taisykite ją. Visas savo veiklas rasite
            puslapyje{" "}
            <Link href="/dashboard" className={linkClass}>
              „Mano veiklos“
            </Link>
            .
          </li>
        </Points>
      </Section>

      <Section id="di-pagalba">
        <Points>
          <li>
            <B>DI tik siūlo, atsakymus tvirtinate jūs.</B> Kol nepatvirtinsite DI sukurtų užduočių atsakymų,
            veiklos pradėti nepavyks.
          </li>
          <li>
            <B>Patikrinkite faktą.</B> Ar teiginys teisingas ir atitinka tai, ko mokote?
          </li>
          <li>
            <B>Patikrinkite, ar atsakymas vienintelis.</B> Jei tinka ir kitas užrašymas, užduoties lange
            spauskite „Pridėti kitą atsakymą“.
          </li>
          <li>
            <B>Patikrinkite užuominas.</B> Gera užuomina padeda mąstyti, bet atsakymo neišduoda.
          </li>
        </Points>
      </Section>

      <Section id="privatumas">
        <Points>
          <li>
            <B>Nerinkite tikrų vardų.</B> Dalyviams paskyrų nereikia. Vardų ir pavardžių neturi būti nei komandų
            pavadinimuose, nei atsakymuose, nei refleksijose.
          </li>
          <li>
            <B>Kas mato rezultatus.</B> Savo veiklų rezultatus matote jūs. Klasės ekrane rodomi komandų
            pavadinimai ir taškai. Dalyviai kitų komandų rezultatus mato tik tada, kai įjungta rezultatų
            lentelė.
          </li>
          <li>
            <B>Kaip ištrinti veiklą.</B> Juodraštį arba baigtą veiklą ištrinsite jos puslapyje („Daugiau“, tada
            „Ištrinti“) arba šiukšliadėžės mygtuku veiklos kortelėje. Vykstančią veiklą pirmiausia užbaikite.
            Kartu visam laikui ištrinamos komandos, jų atsakymai, rezultatai ir refleksijos, todėl prieš
            trindami atsisiųskite CSV, jei duomenų dar reikės. Daugiau:{" "}
            <Link href="/privatumas" className={linkClass}>
              privatumo pranešimas
            </Link>
            .
          </li>
        </Points>
      </Section>

      <footer className="border-t border-border/60 pt-6 print:hidden">
        <Link
          href="/paruostos-veiklos"
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Pasirinkti paruoštą veiklą
        </Link>
      </footer>
    </article>
  )
}
