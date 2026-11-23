"use client"

import dynamic from "next/dynamic"
import { motion, AnimatePresence } from "framer-motion"
import { useReducedMotion } from "@/hooks/use-reduced-motion"
import { SteamRays } from "@/components/brand/steam-rays"
import type { LiveTeam } from "@/hooks/use-live-game"
import { cn, pluralizeLt } from "@/lib/utils"

const QRCodeSVG = dynamic(() => import("qrcode.react").then((mod) => mod.QRCodeSVG), {
  ssr: false,
  loading: () => <div className="aspect-square w-full rounded bg-steam-dark/10" />,
})

/**
 * The join QR code on its white tile. The same tile (one layoutId) is large
 * while the class joins and small beside the board afterwards, so it visibly
 * moves aside instead of being swapped. With reduced motion it just changes
 * place.
 */
export function LiveJoinQr({ url, level = "H", className }: { url: string; level?: "M" | "H"; className?: string }) {
  const prefersReduced = useReducedMotion()
  return (
    <motion.div
      layoutId={prefersReduced ? undefined : "live-join-qr"}
      transition={{ type: "spring", stiffness: 220, damping: 30 }}
      className={cn("rounded-2xl bg-white p-[6%]", className)}
    >
      {/* The dark colour of the code itself: part of the image, not a UI token. */}
      <QRCodeSVG
        value={url}
        size={512}
        level={level}
        includeMargin={false}
        fgColor="#00323C"
        className="block h-auto w-full"
      />
    </motion.div>
  )
}

interface LiveJoinScreenProps {
  gameCode: string
  /** Full participant link, encoded in the QR code. */
  playUrl: string
  /** Where a participant types the code: host and path, no scheme. */
  joinAddress: string
  teams: LiveTeam[]
}

/**
 * What the whole class looks at before the first answer: the QR code, the
 * activity code in very large type, where to type it, and the names of the
 * teams as they come in.
 */
export function LiveJoinScreen({ gameCode, playUrl, joinAddress, teams }: LiveJoinScreenProps) {
  const prefersReduced = useReducedMotion()

  return (
    <section
      aria-label="Prisijungimas prie veiklos"
      className="flex flex-1 flex-col justify-center gap-6 py-2 lg:gap-8"
    >
      <p className="max-w-5xl text-xl leading-snug text-white md:text-2xl lg:text-3xl">
        Nuskaitykite QR kodą arba atverkite{" "}
        <strong className="whitespace-nowrap font-bold text-white underline decoration-highlight decoration-4 underline-offset-8">{joinAddress}</strong> ir įveskite kodą
      </p>

      <div className="grid grid-cols-1 items-center gap-8 md:grid-cols-[auto_1fr] md:gap-12 xl:grid-cols-[auto_1fr_auto]">
        <LiveJoinQr url={playUrl} className="mx-auto w-[min(72vw,20rem)] md:mx-0 md:w-[min(40vh,26rem)]" />

        <div className="min-w-0 text-center md:text-left">
          <p className="text-lg text-white/80 md:text-xl">Veiklos kodas</p>
          <p className="font-mono text-6xl font-bold leading-none tracking-[0.12em] text-white sm:text-7xl lg:text-8xl 2xl:text-9xl">
            {gameCode}
          </p>

          <div className="mt-8" aria-live="polite">
            <p className="text-lg text-white/80 md:text-xl">
              {teams.length === 0
                ? "Laukiama komandų"
                : `Prisijungė ${teams.length} ${pluralizeLt(teams.length, "komanda", "komandos", "komandų")}`}
            </p>
            <ul className="mt-3 flex flex-wrap justify-center gap-2 md:justify-start md:gap-3">
              <AnimatePresence initial={false}>
                {teams.map((team) => (
                  <motion.li
                    key={team.id}
                    layout={!prefersReduced}
                    initial={prefersReduced ? false : { opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={prefersReduced ? undefined : { opacity: 0 }}
                    transition={prefersReduced ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 26 }}
                    className="max-w-full truncate rounded-full border border-white/20 bg-white/10 px-5 py-2 text-xl font-bold text-white md:text-2xl"
                  >
                    {team.name}
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </div>
        </div>

        {/* The brand element, once and large: this is the screen a whole class
            sees first. It has its own column, so it never sits under text. */}
        <SteamRays draw onDark className="hidden h-[40vh] max-h-[26rem] w-auto xl:block" />
      </div>
    </section>
  )
}
