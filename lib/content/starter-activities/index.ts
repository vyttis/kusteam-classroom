import { starterActivitySchema, type StarterActivity } from "./schema"
import { GAMTOS_MOKSLAI } from "./gamtos-mokslai"
import { MATEMATIKA_INFORMATIKA } from "./matematika-informatika"
import { KALBOS_SOCIALINIAI } from "./kalbos-socialiniai"
import { PRADINIS_UGDYMAS } from "./pradinis-ugdymas"

/** Every ready-made activity, validated when the module loads. */
export const STARTER_ACTIVITIES: StarterActivity[] = [
  ...PRADINIS_UGDYMAS,
  ...GAMTOS_MOKSLAI,
  ...MATEMATIKA_INFORMATIKA,
  ...KALBOS_SOCIALINIAI,
].map((activity) => starterActivitySchema.parse(activity))

export function findStarterActivity(slug: string): StarterActivity | undefined {
  return STARTER_ACTIVITIES.find((a) => a.slug === slug)
}
