import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MessagesSquare } from "lucide-react"
import type { DigestLine } from "@/lib/game/formative-insights"

/**
 * "Ką aptarti su klase": three lines worked out from the statistics by fixed
 * rules (lib/game/formative-insights.ts), followed by the methodical note.
 * Shown to the facilitator on the analytics page.
 */
export function ClassDigest({ lines }: { lines: DigestLine[] | null }) {
  return (
    <Card className="border-secondary/30 bg-white">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <MessagesSquare className="h-5 w-5 text-secondary-ink" aria-hidden="true" />
          Ką aptarti su klase
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {lines ? (
          <dl className="space-y-2">
            {lines.map((line) => (
              <div key={line.key} className="sm:flex sm:gap-3">
                <dt className="text-sm font-semibold text-steam-dark sm:w-44 sm:shrink-0">{line.label}</dt>
                <dd className="text-sm text-steam-dark break-words min-w-0">{line.text}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">
            Kol komandos nepateikė atsakymų, aptarti dar nėra ko.
          </p>
        )}
        <div className="rounded-lg border border-secondary/30 bg-secondary/5 p-3 text-xs text-muted-foreground leading-relaxed">
          <strong className="text-secondary-ink">Metodinė pastaba.</strong>{" "}
          Šios įžvalgos sudarytos pagal taisykles iš kiekybinių rodiklių, be dirbtinio intelekto.
          Pedagoginis vertinimas reikalauja kokybinės refleksijos su klase: kas pavyko, kodėl,
          ką darysite kitą pamoką.
        </div>
      </CardContent>
    </Card>
  )
}
