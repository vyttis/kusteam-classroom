import type { DigestLine } from "@/lib/game/formative-insights"

// Each line of the digest has its own ray colour, as a shape beside the
// text: the hardest task, the common mistake, what went well.
const LINE_MARK: Record<DigestLine["key"], string> = {
  hardest: "bg-accent",
  misconception: "bg-highlight",
  went_well: "bg-primary",
}

/**
 * "Ką aptarti su klase": three lines worked out from the statistics by fixed
 * rules (lib/game/formative-insights.ts), followed by the methodical note.
 * It leads the analytics page: this is what the facilitator takes back to
 * the class, the tables below are the evidence.
 */
export function ClassDigest({ lines }: { lines: DigestLine[] | null }) {
  return (
    <section
      aria-labelledby="ka-aptarti"
      className="rounded-2xl bg-steam-dark p-6 text-white shadow-sm sm:p-8"
    >
      <h2 id="ka-aptarti" className="text-2xl font-bold leading-tight sm:text-3xl">
        Ką aptarti su klase
      </h2>
      {lines ? (
        <dl className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {lines.map((line) => (
            <div key={line.key} className="flex gap-3 rounded-xl bg-white/[0.08] p-4">
              <span aria-hidden="true" className={`mt-1 h-10 w-1.5 shrink-0 rounded-full ${LINE_MARK[line.key]}`} />
              <div className="min-w-0">
                <dt className="text-sm font-bold uppercase tracking-wide text-white/80">{line.label}</dt>
                <dd className="mt-1 break-words text-lg leading-snug text-white">{line.text}</dd>
              </div>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-3 text-lg text-white/90">
          Kol komandos nepateikė atsakymų, aptarti dar nėra ko.
        </p>
      )}
      <p className="mt-5 max-w-4xl text-sm leading-relaxed text-white/80">
        <strong className="font-bold text-white">Metodinė pastaba.</strong>{" "}
        Šios įžvalgos sudarytos pagal taisykles iš kiekybinių rodiklių, be dirbtinio intelekto.
        Pedagoginis vertinimas reikalauja kokybinės refleksijos su klase: kas pavyko, kodėl,
        ką darysite kitą pamoką.
      </p>
    </section>
  )
}
