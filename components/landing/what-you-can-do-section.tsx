import { SectionWrapper } from "./section-wrapper"

const capabilities = [
  {
    label: "Užduotys",
    title: "Klausimai, iššūkiai, scenarijai",
    body: "Atviro teksto, skaitinio atsakymo ir pasirinkimo užduotys. Tinka tiek individualiam, tiek komandiniam darbui.",
    accent: "primary",
  },
  {
    label: "Pamoka",
    title: "Aiški pamokos struktūra",
    body: "Įvadas, pagrindinės veiklos, diskusija, refleksija vienoje vietoje. Užduotis lengvai perdėliojate pagal pamokos laiką.",
    accent: "secondary",
  },
  {
    label: "DI",
    title: "Dirbtinis intelektas kaip pagalbininkas",
    body: "DI siūlo užduočių idėjas pagal pasirinktą dalyką ir klasę. Atitiktį bendrosioms programoms ir atsakymus patikrina vedėjas.",
    accent: "highlight",
  },
  {
    label: "Gyvai",
    title: "Pamokos eiga realiu laiku",
    body: "Komandų progresas, dalyvių atsakymai ir sudėtingos vietos matomi iškart. Galite reaguoti per pamoką, o ne po jos.",
    accent: "accent",
  },
  {
    label: "Komandos",
    title: "Komandinis arba individualus darbas",
    body: "Dalyviai prisijungia per QR kodą, be paskyrų ar elektroninio pašto. Vienas kodas visai klasei.",
    accent: "secondary",
  },
  {
    label: "Refleksija",
    title: "Pedagoginė pamokos analizė",
    body: "Po pamokos matote, kurios užduotys buvo sudėtingiausios ir kuriose temose dalyviams reikia papildomo paaiškinimo.",
    accent: "primary",
  },
] as const

const ACCENT: Record<string, { num: string; bar: string; tag: string }> = {
  primary: { num: "text-primary-ink", bar: "bg-primary", tag: "text-primary-ink" },
  secondary: { num: "text-secondary-ink", bar: "bg-secondary", tag: "text-secondary-ink" },
  highlight: { num: "text-highlight-ink", bar: "bg-highlight", tag: "text-highlight-ink" },
  accent: { num: "text-accent-ink", bar: "bg-accent", tag: "text-accent-ink" },
}

export function WhatYouCanDoSection() {
  return (
    <SectionWrapper background="muted">
      {/* Editorial header */}
      <div className="max-w-3xl mb-16 md:mb-24">
        <div className="flex items-center gap-3 mb-5">
          <span className="inline-flex h-px w-10 bg-steam-dark/40" />
          <span className="text-xs uppercase tracking-[0.22em] text-steam-dark/70 font-semibold">
            §2 · Galimybės
          </span>
        </div>
        <h2 className="text-display-sm md:text-display-md text-steam-dark leading-[0.98] tracking-tight">
          Šešios{" "}
          <span className="font-display italic text-steam-dark/70">esminės</span>{" "}
          galimybės.
        </h2>
        <p className="text-base md:text-lg text-muted-foreground mt-6 max-w-2xl leading-relaxed text-pretty">
          Visi pagrindiniai pamokos kūrimo įrankiai vienoje platformoje. Vedėjas
          paruošia ir veda pamoką savarankiškai, be papildomos technikos.
        </p>
      </div>

      {/* Cards grid — asymmetric, editorial */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border/60 rounded-2xl overflow-hidden border border-border/60">
        {capabilities.map((item, index) => {
          const colors = ACCENT[item.accent]
          return (
            <article
              key={index}
              className="group relative bg-white p-7 lg:p-8 transition-colors hover:bg-muted/30"
            >
              <div className="flex items-center gap-2 mb-5">
                <span className={`h-px w-6 ${colors.bar}`} />
                <span className={`text-xs uppercase tracking-[0.22em] font-bold ${colors.tag}`}>
                  {item.label}
                </span>
              </div>
              <div className="flex items-start gap-4">
                <span className={`numeral-display font-medium text-2xl ${colors.num} tabular-nums shrink-0 mt-0.5`}>
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-steam-dark text-lg leading-tight text-balance mb-2.5">
                    {item.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed text-pretty">
                    {item.body}
                  </p>
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </SectionWrapper>
  )
}
