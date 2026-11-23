"use client"

import { useMemo } from "react"
import { Check, ChevronRight, Lock } from "lucide-react"
import { taskSegments } from "@/components/player/play-progress"
import { SegmentedProgress } from "@/components/player/play-ui"

interface ChallengeGridProps {
  challenges: Array<{
    id: string
    title: string
    description: string | null
    type: string
    points: number
    hints: (string | null)[]
    options: string[] | null
    order_index: number
    image_url: string | null
    maps_url: string | null
    hint_penalty: number
    prerequisites: string[]
  }>
  solvedIds: Set<string>
  onSelectChallenge: (index: number) => void
}

type ChallengeStatus = "locked" | "unlocked" | "solved"

const typeLabels: Record<string, string> = {
  text: "Tekstas",
  number: "Skaičius",
  multiple_choice: "Pasirinkimas",
}

/**
 * Free mode: every task as a card, in any order. Three states that look
 * different without relying on colour alone: open (a button with an
 * arrow), solved (a check) and locked (a lock and what to do first).
 */
export function ChallengeGrid({
  challenges,
  solvedIds,
  onSelectChallenge,
}: ChallengeGridProps) {
  const statusMap = useMemo(() => {
    const map = new Map<string, ChallengeStatus>()
    for (const challenge of challenges) {
      if (solvedIds.has(challenge.id)) {
        map.set(challenge.id, "solved")
      } else if (
        challenge.prerequisites.length === 0 ||
        challenge.prerequisites.every((preId) => solvedIds.has(preId))
      ) {
        map.set(challenge.id, "unlocked")
      } else {
        map.set(challenge.id, "locked")
      }
    }
    return map
  }, [challenges, solvedIds])

  const solvedCount = challenges.filter((c) => solvedIds.has(c.id)).length
  const totalCount = challenges.length

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div>
        <h1 className="mb-1.5 text-sm font-bold text-foreground">
          Išspręsta {solvedCount} iš {totalCount} užduočių
        </h1>
        <SegmentedProgress
          segments={taskSegments(challenges.map((c) => c.id), solvedIds).map((state, i) => ({
            id: challenges[i].id,
            state,
          }))}
        />
      </div>

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {challenges.map((challenge, index) => (
          <li key={challenge.id}>
            <ChallengeCard
              challenge={challenge}
              status={statusMap.get(challenge.id) ?? "locked"}
              onSelect={() => onSelectChallenge(index)}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}

function ChallengeCard({
  challenge,
  status,
  onSelect,
}: {
  challenge: ChallengeGridProps["challenges"][number]
  status: ChallengeStatus
  onSelect: () => void
}) {
  const meta = `${challenge.points} tšk. · ${typeLabels[challenge.type] ?? challenge.type}`

  if (status === "unlocked") {
    return (
      <button
        type="button"
        onClick={onSelect}
        className="flex min-h-[72px] w-full items-center gap-3 rounded-2xl border-2 border-foreground/25 bg-white p-4 text-left transition-colors hover:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 break-words text-base font-bold leading-tight text-foreground">
            {challenge.title}
          </span>
          <span className="mt-1 block text-sm text-muted-foreground">{meta}</span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-foreground" aria-hidden="true" />
      </button>
    )
  }

  const solved = status === "solved"
  return (
    <div
      className={`flex min-h-[72px] items-center gap-3 rounded-2xl border-2 p-4 ${
        solved ? "border-primary bg-primary/10" : "border-dashed border-foreground/20 bg-transparent"
      }`}
    >
      <span className="min-w-0 flex-1">
        <span
          className={`line-clamp-2 break-words text-base font-bold leading-tight ${
            solved ? "text-foreground" : "text-muted-foreground"
          }`}
        >
          {challenge.title}
        </span>
        <span className="mt-1 block text-sm text-muted-foreground">
          {solved ? `Išspręsta · ${challenge.points} tšk.` : "Pirmiausia išspręskite reikalingas užduotis"}
        </span>
      </span>
      {solved ? (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary" aria-hidden="true">
          <Check className="h-4 w-4 text-primary-foreground" strokeWidth={3} />
        </span>
      ) : (
        <Lock className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      )}
    </div>
  )
}
