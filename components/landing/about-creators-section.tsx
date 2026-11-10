import { SectionWrapper } from "./section-wrapper"
import { Mail, Phone, MapPin, ArrowUpRight } from "lucide-react"
import Image from "next/image"

const PHOTOS = [
  { src: "/photos/steam-lab.jpg", alt: "STEAM centro laboratorija", caption: "Laboratorija" },
  { src: "/photos/steam-robot.jpg", alt: "Pepper robotas", caption: "Pepper" },
  { src: "/photos/activity-vr.jpg", alt: "VR technologijos", caption: "VR / AR" },
] as const

export function AboutCreatorsSection() {
  return (
    <SectionWrapper background="white">
      {/* Editorial header */}
      <div className="max-w-3xl mb-14">
        <div className="flex items-center gap-3 mb-5">
          <span className="inline-flex h-px w-10 bg-steam-dark/40" />
          <span className="text-xs uppercase tracking-[0.22em] text-steam-dark/70 font-semibold">
            §5 · Apie kūrėjus
          </span>
        </div>
        <h2
          className="text-display-sm md:text-display-md text-steam-dark leading-[0.98] tracking-tight"
        >
          Kūryba iš{" "}
          <span className="font-display italic text-steam-dark/70">Klaipėdos</span>{" "}
          universiteto.
        </h2>
        <p
          className="text-base md:text-lg text-muted-foreground mt-6 max-w-2xl leading-relaxed text-pretty"
        >
          Klaipėdos universiteto STEAM metodinis centras dirba su mokytojais ir
          švietimo bendruomene. Įrankis sukurtas siekiant praktinių mokyklų poreikių,
          remiantis realiu mokytojų darbu klasėse.
        </p>
      </div>

      {/* Photo strip + contact, editorial composition */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-y-10 lg:gap-x-10">
        {/* Photo strip */}
        <div
          className="lg:col-span-7 grid grid-cols-3 gap-3"
        >
          {PHOTOS.map((photo, i) => (
            <figure key={i} className="relative aspect-[3/4] rounded-xl overflow-hidden border border-border/40 group">
              <Image
                src={photo.src}
                alt={photo.alt}
                fill
                className="object-cover transition-transform duration-700 group-hover:scale-105"
                sizes="(max-width: 1024px) 33vw, 240px"
              />
              <figcaption className="absolute bottom-3 left-3 text-xs uppercase tracking-wider text-white font-bold drop-shadow-sm">
                {photo.caption}
              </figcaption>
            </figure>
          ))}
        </div>

        {/* Contact panel */}
        <div
          className="lg:col-span-5"
        >
          <dl className="space-y-6 border-l-2 border-steam-dark/15 pl-6">
            {[
              { icon: MapPin, label: "Vieta", value: "Herkaus Manto g. 84, Klaipėda" },
              { icon: Mail, label: "El. paštas", value: "steam@ku.lt", href: "mailto:steam@ku.lt" },
              { icon: Phone, label: "Telefonas", value: "+370 (46) 398 978", href: "tel:+37046398978" },
            ].map((item, i) => {
              const Icon = item.icon
              // dt/dd must be direct children of a div inside the dl, so the
              // link wraps the value only.
              return (
                <div key={i} className="relative pl-7">
                  <Icon className="absolute left-0 top-0.5 h-4 w-4 text-primary-ink" aria-hidden="true" />
                  <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-semibold mb-0.5">
                    {item.label}
                  </dt>
                  <dd className="text-sm md:text-base text-steam-dark font-medium">
                    {item.href ? (
                      <a href={item.href} className="hover:opacity-70 transition-opacity">
                        {item.value}
                      </a>
                    ) : (
                      item.value
                    )}
                  </dd>
                </div>
              )
            })}
          </dl>

          <a
            href="https://steam.ku.lt/"
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-2 mt-10 text-sm font-medium text-primary-ink hover:text-primary-ink/80 transition-colors"
          >
            Sužinoti daugiau apie centrą
            <ArrowUpRight className="h-4 w-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </a>
        </div>
      </div>
    </SectionWrapper>
  )
}
