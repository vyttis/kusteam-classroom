import type { Announcements, ScreenReaderInstructions, UniqueIdentifier } from "@dnd-kit/core"

// dnd-kit speaks English by default. These are the builder's screen reader
// texts in Lithuanian: the instructions read on a drag handle and what is
// announced while an item is carried.

export const DND_INSTRUCTIONS_LT: ScreenReaderInstructions = {
  draggable:
    "Norėdami paimti elementą, paspauskite tarpo klavišą arba Enter. Perkelkite rodyklių klavišais. Paspauskite tarpo klavišą arba Enter dar kartą, kad padėtumėte naujoje vietoje, arba Escape, kad atšauktumėte.",
}

/**
 * `describe` turns a drag id into words ("užduotis „Tiltas“"), or null for
 * an id it does not know. Nothing is announced for unknown items.
 */
export function dndAnnouncementsLt(describe: (id: UniqueIdentifier) => string | null): Announcements {
  return {
    onDragStart({ active }) {
      const item = describe(active.id)
      return item ? `Paimta: ${item}.` : undefined
    },
    onDragOver({ active, over }) {
      const item = describe(active.id)
      if (!item) return undefined
      const target = over ? describe(over.id) : null
      return target ? `${item} dabar virš: ${target}.` : `${item} nebėra virš vietos, kur galima padėti.`
    },
    onDragEnd({ active, over }) {
      const item = describe(active.id)
      if (!item) return undefined
      const target = over ? describe(over.id) : null
      return target ? `Padėta: ${item}. Vieta: ${target}.` : `Padėta: ${item}. Vieta nepasikeitė.`
    },
    onDragCancel({ active }) {
      const item = describe(active.id)
      return item ? `Perkėlimas atšauktas: ${item} liko savo vietoje.` : undefined
    },
  }
}

/** Where a task lands when moved one step; null when it is already at the edge. */
export function stepTarget(index: number, direction: -1 | 1, length: number): number | null {
  const target = index + direction
  if (index < 0 || index >= length || target < 0 || target >= length) return null
  return target
}
