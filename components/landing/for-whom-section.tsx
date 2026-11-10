import { SectionWrapper } from "./section-wrapper"
import Image from "next/image"

const audiences = [
  {
    quote: "Partnerių mokyklų mokytojams",
    body: "Įrankis prieinamas Klaipėdos universiteto STEAM metodinio centro partnerių tinklo mokykloms.",
    tag: "Tinklas",
  },
  {
    quote: "Šiuolaikiškiems pedagogams",
    body: "Mokytojams, ieškantiems įtraukių darbo būdų, kad mokiniai pamokoje aktyviai mąstytų, diskutuotų ir spręstų.",
    tag: "Praktika",
  },
  {
    quote: "Atskiroms ir integruotoms pamokoms",
    body: "Tinka tiek dalykinėms pamokoms, tiek integruotoms STEAM veikloms, projektinei savaitei ar pasirengimui pasiekimų patikrinimams.",
    tag: "Lankstumas",
  },
]

export function ForWhomSection() {
  return (
    <SectionWrapper background="white">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-y-14 lg:gap-x-14 items-start">
        <div className="lg:col-span-7">
          {/* Editorial header */}
          <div className="mb-14">
            <div className="flex items-center gap-3 mb-5">
              <span className="inline-flex h-px w-10 bg-steam-dark/40" />
              <span className="text-xs uppercase tracking-[0.22em] text-steam-dark/70 font-semibold">
                §2 · Kam
              </span>
            </div>
            <h2
              className="text-display-sm md:text-display-md text-steam-dark leading-[0.98] tracking-tight"
            >
              Mokytojui,{" "}
              <span className="font-display italic text-steam-dark/70">kuris ieško</span>
              <br />
              daugiau nei klausimynų.
            </h2>
            <p
              className="text-base md:text-lg text-muted-foreground mt-6 max-w-xl leading-relaxed text-pretty"
            >
              Įrankis skirtas Klaipėdos universiteto STEAM metodinio centro partnerių
              tinklo mokytojams. Užduotys gali padėti taikyti dalyko žinias,
              bendradarbiauti, argumentuoti ir vertinti DI pasiūlymus. Kokias
              kompetencijas ugdys pamoka, priklauso nuo mokytojo parinkto turinio ir aptarimo.
            </p>
          </div>

          {/* Audience list — editorial cards */}
          <div className="space-y-2">
            {audiences.map((item, index) => (
              <article
                key={index}
                className="group relative grid grid-cols-[auto_1fr] gap-5 py-6 border-t border-border/60 last:border-b last:border-b-border/60"
              >
                <div className="numeral-display text-2xl font-medium text-steam-dark/70 pt-1.5 tabular-nums">
                  0{index + 1}
                </div>
                <div>
                  <div className="flex items-baseline justify-between gap-3 mb-2">
                    <h3 className="text-xl md:text-2xl font-bold text-steam-dark tracking-tight text-balance leading-tight">
                      {item.quote}
                    </h3>
                    <span className="hidden sm:inline shrink-0 text-xs uppercase tracking-[0.18em] text-secondary-ink font-semibold">
                      {item.tag}
                    </span>
                  </div>
                  <p className="text-sm md:text-base text-muted-foreground leading-relaxed max-w-2xl text-pretty">
                    {item.body}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>

        {/* Right — single image with editorial caption */}
        <div
          className="lg:col-span-5 lg:sticky lg:top-24"
        >
          <figure>
            <div className="relative rounded-xl overflow-hidden shadow-xl shadow-steam-dark/10 border border-border/30 aspect-[4/5]">
              <Image
                src="/photos/activity-teachers.jpg"
                alt="Mokytojai dalyvauja STEAM centro veiklose"
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 460px"
              />
            </div>
            <figcaption className="mt-4 flex items-start gap-3 text-xs text-muted-foreground leading-relaxed">
              <span className="numeral-display text-xs uppercase tracking-wider text-secondary-ink font-semibold shrink-0 mt-0.5">
                Pav. 01
              </span>
              <span>
                Mokytojai KU STEAM partnerystės susitikime.
              </span>
            </figcaption>
          </figure>
        </div>
      </div>
    </SectionWrapper>
  )
}
