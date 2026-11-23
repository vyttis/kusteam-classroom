/**
 * One ray colour per subject area in the ready-made catalogue. The five
 * rays of the brand element follow the five letters of STEAM: science,
 * technology, engineering, arts and mathematics. The colour marks the
 * subject area in a list (DESIGN-SYSTEM.md, "Sąsaja"), never a state.
 *
 * Token names only: the palette values live in app/globals.css.
 */
export type SubjectRay = "science" | "technology" | "engineering" | "arts" | "maths"

const SUBJECT_RAYS: Record<string, SubjectRay> = {
  Fizika: "science",
  Chemija: "science",
  Biologija: "science",
  "Gamtos mokslai": "science",
  Geografija: "science",
  Informatika: "technology",
  Technologijos: "engineering",
  Matematika: "maths",
  "Ekonomika ir verslumas": "maths",
  "Lietuvių kalba ir literatūra": "arts",
  "Užsienio kalba": "arts",
  Istorija: "arts",
  Pilietiškumas: "arts",
  Dailė: "arts",
  Muzika: "arts",
  "Etika ar tikyba": "arts",
}

/** Subjects outside the five areas (primary, career, other) take the base colour. */
export function subjectRay(subject: string): SubjectRay {
  return SUBJECT_RAYS[subject] ?? "engineering"
}

/**
 * Fill classes for the marker shape. The colour is only ever a shape: the
 * subject name next to it stays in the normal text colour.
 */
export const RAY_FILL_CLASS: Record<SubjectRay, string> = {
  science: "bg-primary",
  technology: "bg-secondary",
  engineering: "bg-foreground",
  arts: "bg-accent",
  maths: "bg-highlight",
}
