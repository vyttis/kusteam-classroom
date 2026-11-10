"use client"

import { SteamLogo } from "@/components/steam-logo"
import { Button } from "@/components/ui/button"
import { useReducedMotion } from "@/hooks/use-reduced-motion"
import { ArrowUpRight, Check, LogIn, Sparkles } from "lucide-react"
import Link from "next/link"
import { motion, useScroll, useTransform } from "framer-motion"
import { useRef, useState } from "react"

// Interactive demo: a single question that lets the visitor experience the
// flow before clicking any CTA. Demonstrates product feel in <3 clicks.
// Interactive demo: a single question that lets the visitor experience the
// flow before clicking any CTA. Demonstrates product feel in <3 clicks.
// Neutral biology topic — works for grades 5-8, no geographic bias.
const DEMO_OPTIONS = [
  { id: "a", label: "Bitė ir žiedinis augalas", correct: true },
  { id: "b", label: "Lapė ir kiškis", correct: false },
  { id: "c", label: "Du tos pačios rūšies vilkai", correct: false },
  { id: "d", label: "Erkė ant šuns", correct: false },
] as const

export function HeroSection() {
  const prefersReduced = useReducedMotion()
  const containerRef = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  })
  const parallaxY = useTransform(scrollYProgress, [0, 1], [0, prefersReduced ? 0 : -80])

  const [picked, setPicked] = useState<string | null>(null)
  const correctPicked = picked === "a"

  return (
    <section ref={containerRef} className="relative overflow-hidden">
      {/* Background — full bleed dark, with construction-line texture */}
      <div className="absolute inset-0 bg-gradient-to-br from-steam-dark via-[#003845] to-steam-dark" />
      <div className="absolute inset-0 construction-lines opacity-50 mix-blend-overlay" />

      {/* Subtle glow accents */}
      <motion.div
        animate={prefersReduced ? {} : { scale: [1, 1.12, 1], opacity: [0.1, 0.16, 0.1] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-0 right-0 w-[760px] h-[760px] bg-primary rounded-full blur-[130px] -translate-y-1/3 translate-x-1/4"
        style={{ opacity: 0.12 }}
      />
      <motion.div
        animate={prefersReduced ? {} : { scale: [1, 1.08, 1], opacity: [0.06, 0.12, 0.06] }}
        transition={{ duration: 11, repeat: Infinity, ease: "easeInOut", delay: 2.5 }}
        className="absolute bottom-0 left-0 w-[560px] h-[560px] bg-secondary rounded-full blur-[120px] translate-y-1/3 -translate-x-1/4"
        style={{ opacity: 0.08 }}
      />

      <div className="relative">
        {/* Navigation */}
        <nav className="container mx-auto px-5 max-w-[1240px] flex items-center justify-between flex-wrap gap-4 py-5">
          <Link
            href="/"
            className="flex items-center hover:opacity-80 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
          >
            <SteamLogo className="[&_text]:fill-white [&_line]:opacity-90" />
          </Link>

          <div className="flex flex-wrap items-center gap-3 sm:gap-5">
            <a href="https://kusteam.app/veiklos" className="inline-flex min-h-11 items-center text-sm font-medium text-white/80 hover:text-white underline underline-offset-4">Veiklų katalogas</a>
            <a href="https://komanda.kusteam.app" className="inline-flex min-h-11 items-center text-sm font-medium text-white/80 hover:text-white underline underline-offset-4">Darbuotojams: TEAM</a>
            <Link
              href="/prisijungti"
              className="hidden sm:inline text-sm font-medium text-white/80 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 rounded-sm"
            >
              Prisijungti prie veiklos
            </Link>
            <Link
              href="/vedejui"
              className="group inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] backdrop-blur-sm pl-4 pr-3.5 py-2 text-sm text-white/85 hover:text-white hover:border-white/30 hover:bg-white/[0.08] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            >
              <LogIn className="h-3.5 w-3.5 text-primary/80 group-hover:text-primary transition-colors" />
              <span className="font-medium">Vesti veiklą</span>
              <ArrowUpRight className="h-3.5 w-3.5 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </Link>
          </div>
        </nav>

        {/* Hero content — asymmetric editorial grid */}
        <motion.div
          style={{ y: parallaxY }}
          className="container mx-auto px-5 max-w-[1240px] pt-10 md:pt-16 pb-24 md:pb-32"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-y-12 lg:gap-x-10 items-start">
            {/* Left — text (7 cols) */}
            <div className="lg:col-span-7 lg:pt-6">
              {/* Eyebrow */}
              <div
                className="rise-in flex items-center gap-3 mb-7"
              >
                <span className="inline-flex h-px w-10 bg-primary/60" />
                <span className="text-xs uppercase tracking-[0.22em] text-primary font-semibold">
                  Klaipėdos universiteto STEAM centras
                </span>
              </div>

              {/* Editorial headline — display serif + sans mix */}
              <h1
                className="rise-in text-display-md md:text-display-lg text-white leading-[0.95] tracking-tight"
                style={{ animationDelay: "80ms" }}
              >
                <span className="font-extrabold">Pamoka,</span>{" "}
                <span className="font-display italic text-white/90">kuri</span>{" "}
                <span className="font-extrabold">įtraukia</span>
                <br />
                <span className="font-extrabold">visą</span>{" "}
                <span className="relative inline-block">
                  <span className="font-display italic text-primary">klasę</span>
                  <span
                    aria-hidden
                    className="absolute left-0 right-0 -bottom-1 h-[5px] bg-primary/60 rounded-full draw-underline"
                  />
                </span>
                <span className="text-white/40">.</span>
              </h1>

              <p
                className="rise-in text-base md:text-lg text-white/75 mt-7 leading-relaxed max-w-[580px] text-pretty"
                style={{ animationDelay: "160ms" }}
              >
                Vedėjas sukuria komandinę veiklą su užduotimis, dalyviai prisijungia
                su kodu, o jų atsakymai matomi realiu laiku. Planavimo įrankyje
                galima rinktis iš 24 dalykų ir 1–12 klasių. Turinį pagal bendrąsias
                programas peržiūri ir pritaiko mokytojas.
              </p>

              {/* CTAs */}
              <div
                className="rise-in flex flex-col sm:flex-row gap-3 mt-9"
                style={{ animationDelay: "240ms" }}
              >
                {/* Role choice: the two ways into the platform */}
                <Link href="/vedejui">
                  <Button
                    size="lg"
                    className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25 gap-2 h-12 text-sm px-7 font-semibold"
                  >
                    <LogIn className="h-4 w-4" aria-hidden="true" />
                    Vesti veiklą
                  </Button>
                </Link>
                <Link href="/prisijungti">
                  <Button
                    size="lg"
                    variant="ghost"
                    className="w-full sm:w-auto gap-2 h-12 text-sm px-6 text-white hover:text-white bg-white/10 hover:bg-white/15 border border-white/20"
                  >
                    Prisijungti prie veiklos
                    <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </Link>
              </div>

              <p className="mt-5 max-w-xl text-sm leading-relaxed text-white/80">
                Mokytojui reikia KU STEAM centro patvirtintos paskyros. Dalyviams
                paskyrų nereikia. Veiklos trukmę pasirenka vedėjas.
              </p>

              {/* Numerical proof strip — typographic over icons */}
              <div
                className="rise-in grid grid-cols-3 gap-6 mt-12 pt-8 border-t border-white/10 max-w-[560px]"
                style={{ animationDelay: "320ms" }}
              >
                {[
                  { num: "24", label: "dalykų pasirinkimai" },
                  { num: "1–12", label: "klasės" },
                  { num: "5+", label: "veiklos tipai" },
                ].map((stat, i) => (
                  <div key={i}>
                    <div className="numeral-display text-3xl md:text-4xl font-medium text-white">
                      {stat.num}
                    </div>
                    <div className="text-xs uppercase tracking-wider text-white/55 mt-1.5">
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — interactive mini-demo (5 cols) */}
            <div className="rise-in lg:col-span-5 lg:pt-4" style={{ animationDelay: "400ms" }}>
              <div className="relative">
                {/* Glow behind card */}
                <div className="absolute -inset-8 bg-gradient-to-br from-primary/20 via-secondary/10 to-highlight/15 rounded-3xl blur-3xl opacity-40" />

                {/* Demo "phone" mock — what students see */}
                <motion.div
                  animate={prefersReduced ? {} : { y: [0, -6, 0] }}
                  transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                  className="relative rounded-[28px] bg-white shadow-2xl shadow-black/30 border border-white/20 overflow-hidden"
                >
                  {/* Mock device header */}
                  <div className="flex items-center justify-between px-5 py-3 bg-muted/50 border-b border-border/40">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-accent/60" />
                      <span className="w-2.5 h-2.5 rounded-full bg-highlight/60" />
                      <span className="w-2.5 h-2.5 rounded-full bg-primary/60" />
                    </div>
                    <span className="text-xs font-mono text-muted-foreground tracking-wider">
                      pamokos.kusteam.app • 7 kl. biologija
                    </span>
                  </div>

                  {/* Card content — looks like a real challenge */}
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <span className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider text-primary-ink font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                        Užduotis 3 iš 5
                      </span>
                      <span className="text-xs font-mono text-muted-foreground">
                        150 tšk.
                      </span>
                    </div>

                    <p className="text-display-xs text-steam-dark font-extrabold leading-tight mb-1">
                      Kuri pora{" "}
                      <span className="font-display italic font-normal">geriausiai</span>{" "}
                      iliustruoja simbiozę?
                    </p>
                    <p className="text-xs text-muted-foreground mb-5">
                      Simbiozė - abipusiškai naudingas dviejų skirtingų rūšių santykis.
                    </p>

                    <div className="space-y-2">
                      {DEMO_OPTIONS.map((opt) => {
                        const isPicked = picked === opt.id
                        const showResult = picked !== null && isPicked
                        return (
                          <button
                            key={opt.id}
                            onClick={() => !picked && setPicked(opt.id)}
                            disabled={picked !== null && !isPicked}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left text-sm font-medium transition-all ${
                              showResult && opt.correct
                                ? "border-primary bg-primary/10 text-primary-ink"
                                : showResult && !opt.correct
                                  ? "border-accent bg-accent/10 text-accent-ink"
                                  : picked && !isPicked
                                    ? "border-border bg-white text-muted-foreground opacity-50"
                                    : "border-border bg-white text-steam-dark hover:border-primary/40 hover:bg-primary/[0.03]"
                            }`}
                          >
                            <span
                              className={`shrink-0 w-6 h-6 rounded-md border flex items-center justify-center text-xs font-bold uppercase ${
                                showResult && opt.correct
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : showResult && !opt.correct
                                    ? "border-accent-ink bg-accent-ink text-white"
                                    : "border-border text-muted-foreground"
                              }`}
                            >
                              {showResult && opt.correct ? <Check className="h-3.5 w-3.5" /> : opt.id.toUpperCase()}
                            </span>
                            {opt.label}
                          </button>
                        )
                      })}
                    </div>

                    {picked && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`mt-4 px-4 py-3 rounded-lg text-xs ${
                          correctPicked
                            ? "bg-primary/10 border border-primary/20 text-primary-ink"
                            : "bg-accent/10 border border-accent/20 text-accent-ink"
                        }`}
                      >
                        {correctPicked ? (
                          <>
                            <strong>Teisingai!</strong> Bitė renka nektarą ir apdulkina augalą.
                            Abu organizmai gauna naudą. Tai klasikinė simbiozė (mutualizmas).
                          </>
                        ) : (
                          <>
                            <strong>Beveik.</strong> Ieškokite poros, kurioje abu gauna naudą:
                            ne plėšrūnas-auka, ne tos pačios rūšies, ne parazitas.{" "}
                            <button
                              onClick={() => setPicked(null)}
                              className="underline hover:no-underline"
                            >
                              Bandyti dar
                            </button>
                            .
                          </>
                        )}
                      </motion.div>
                    )}
                  </div>
                </motion.div>

                {/* Floating editorial tag — "try it" hint */}
                <div
                  style={{ animationDelay: "900ms" }}
                  className="fade-in-css -rotate-6 absolute -top-5 -left-6 bg-highlight text-steam-dark rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider shadow-lg shadow-highlight/30 flex items-center gap-1.5"
                >
                  <Sparkles className="h-3 w-3" />
                  Spauskite
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Marquee credentials strip — bottom of hero */}
        <div className="fade-in-css border-t border-white/10 overflow-hidden" style={{ animationDelay: "1000ms" }}>
          <div className="flex animate-marquee whitespace-nowrap py-4 text-[12px] text-white/40 [animation-play-state:running] hover:[animation-play-state:paused]">
            {[...Array(2)].map((_, dup) => (
              <div key={dup} className="flex items-center shrink-0">
                {[
                  "Klaipėdos universitetas",
                  "STEAM metodinis centras",
                  "Pamokų planavimas",
                  "Mokytojų partnerystės tinklas",
                  "Klaipėdos universitetas",
                  "STEAM metodinis centras",
                  "Pamokų planavimas",
                  "Mokytojų partnerystės tinklas",
                ].map((item, i) => (
                  <span key={`${dup}-${i}`} className="flex items-center">
                    <span className="px-8 font-medium tracking-wider">{item}</span>
                    <span className="text-white/15">·</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
