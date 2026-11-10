import { SectionWrapper } from "./section-wrapper"

const steps = [
  {
    number: "01",
    title: "Pasirinkite temą",
    description:
      "Pasirinkite dalyką, klasę ir mokymosi tikslą. DI pasiūlymų sudėtingumą ir sąsają su bendrosiomis programomis patikrinkite patys.",
    accent: "primary",
  },
  {
    number: "02",
    title: "Kurkite užduotis",
    description:
      "Užduotis rašote patys arba pagal dirbtinio intelekto pasiūlymą. Galutinį turinį visada peržiūrite ir patvirtinate jūs.",
    accent: "highlight",
  },
  {
    number: "03",
    title: "Sudėliokite pamokos eigą",
    description:
      "Įvadas, veiklos, diskusija, refleksija vienoje vietoje. Užduotis perdėliokite, redaguokite ar pašalinkite, kol pamokos struktūra atitinka jūsų planą.",
    accent: "secondary",
  },
  {
    number: "04",
    title: "Dalyviai prisijungia",
    description:
      "Per QR kodą arba 6 simbolių veiklos kodą. Dalyviams nereikia paskyrų ar elektroninio pašto.",
    accent: "accent",
  },
  {
    number: "05",
    title: "Stebėkite eigą",
    description:
      "Komandų pažanga ir atsakymai matomi realiu laiku. Trukmę pasirenka vedėjas, prireikus gali pridėti laiko.",
    accent: "primary",
  },
] as const

const ACCENT_COLOR: Record<string, { numeral: string; line: string; tick: string }> = {
  primary: {
    numeral: "text-steam-dark/70",
    line: "bg-primary",
    tick: "bg-primary",
  },
  highlight: {
    numeral: "text-steam-dark/70",
    line: "bg-highlight",
    tick: "bg-highlight",
  },
  secondary: {
    numeral: "text-steam-dark/70",
    line: "bg-secondary",
    tick: "bg-secondary",
  },
  accent: {
    numeral: "text-steam-dark/70",
    line: "bg-accent",
    tick: "bg-accent",
  },
}

export function HowItWorksSection() {
  return (
    <SectionWrapper background="white" id="how-it-works">
      {/* Editorial header */}
      <div className="max-w-3xl mb-20 md:mb-28">
        <div className="flex items-center gap-3 mb-5">
          <span className="inline-flex h-px w-10 bg-steam-dark/40" />
          <span className="text-xs uppercase tracking-[0.22em] text-steam-dark/70 font-semibold">
            §3 · Eiga
          </span>
        </div>
        <h2 className="text-display-sm md:text-display-md text-steam-dark leading-[0.98] tracking-tight">
          Penki žingsniai{" "}
          <span className="font-display italic text-steam-dark/70">nuo idėjos</span>{" "}
          iki klasės.
        </h2>
        <p className="text-base md:text-lg text-muted-foreground mt-6 max-w-2xl leading-relaxed text-pretty">
          Pamokai paruošti nereikia papildomos technikos ar IT specialisto. Visą eigą
          vedėjas suvaldo savarankiškai.
        </p>
      </div>

      {/* Steps — editorial timeline, asymmetric */}
      <ol className="relative space-y-12 md:space-y-16">
        {steps.map((step, index) => {
          const colors = ACCENT_COLOR[step.accent]
          const isEven = index % 2 === 0

          return (
            <li
              key={step.number}
              className="relative grid grid-cols-1 md:grid-cols-12 gap-y-3 md:gap-x-8 items-start"
            >
              {/* Big numeral — display serif, takes 4 cols on md+ */}
              <div className={`md:col-span-4 ${isEven ? "md:order-1" : "md:order-2 md:text-right"}`}>
                <div
                  className={`numeral-display font-medium ${colors.numeral}`}
                  style={{ fontSize: "clamp(5rem, 12vw, 9rem)", lineHeight: "0.85" }}
                  aria-hidden
                >
                  {step.number}
                </div>
                <div className="flex items-center gap-3 mt-3">
                  <span className={`h-px w-12 ${colors.line}`} />
                  <span className="text-xs uppercase tracking-[0.2em] font-semibold text-steam-dark">
                    Žingsnis {step.number}
                  </span>
                </div>
              </div>

              {/* Content — 8 cols on md+ */}
              <div className={`md:col-span-8 ${isEven ? "md:order-2" : "md:order-1"}`}>
                <h3 className="text-2xl md:text-3xl font-bold text-steam-dark tracking-tight mb-3 text-balance">
                  {step.title}
                </h3>
                <p className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-xl text-pretty">
                  {step.description}
                </p>
              </div>
            </li>
          )
        })}
      </ol>
    </SectionWrapper>
  )
}
