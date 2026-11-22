import { describe, expect, it } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import { matchSourceChallenges, sourceAnswers, type SourceChallenge } from "@/lib/library/source-answers"

function source(over: Partial<SourceChallenge>): SourceChallenge {
  return {
    id: "s1",
    title: "Upė",
    type: "text",
    order_index: 0,
    options: null,
    answer_hash: "$2b$10$hash",
    explanation: "Nemunas",
    difficulty: "easy",
    hint_penalty: 20,
    needs_answer: false,
    ...over,
  }
}

describe("matchSourceChallenges", () => {
  it("matches by title, type and position", () => {
    const a = source({ id: "a", title: "A", order_index: 0 })
    const b = source({ id: "b", title: "B", order_index: 1 })
    const out = matchSourceChallenges(
      [
        { title: "A", type: "text", order_index: 0 },
        { title: "B", type: "text", order_index: 1 },
      ],
      [b, a],
    )
    expect(out.map((m) => m?.id)).toEqual(["a", "b"])
  })

  it("still matches a task moved since publishing when the title is unique", () => {
    const out = matchSourceChallenges([{ title: "A", type: "text", order_index: 0 }], [source({ id: "a", title: "A", order_index: 5 })])
    expect(out[0]?.id).toBe("a")
  })

  it("does not guess between two moved tasks with the same title", () => {
    const out = matchSourceChallenges(
      [{ title: "A", type: "text", order_index: 0 }],
      [source({ id: "a1", title: "A", order_index: 3 }), source({ id: "a2", title: "A", order_index: 4 })],
    )
    expect(out[0]).toBeNull()
  })

  it("uses each source task once", () => {
    const out = matchSourceChallenges(
      [
        { title: "A", type: "text", order_index: 0 },
        { title: "A", type: "text", order_index: 7 },
      ],
      [source({ id: "a", title: "A", order_index: 0 })],
    )
    expect(out.map((m) => m?.id ?? null)).toEqual(["a", null])
  })

  it("needs the same options for a choice task and the same type", () => {
    const choice = source({ id: "c", title: "C", type: "multiple_choice", options: ["x", "y"] })
    expect(matchSourceChallenges([{ title: "C", type: "multiple_choice", options: ["x", "y"] }], [choice])[0]?.id).toBe("c")
    expect(matchSourceChallenges([{ title: "C", type: "multiple_choice", options: ["x", "z"] }], [choice])[0]).toBeNull()
    expect(matchSourceChallenges([{ title: "C", type: "text" }], [choice])[0]).toBeNull()
  })

  it("skips source tasks that have no real answer", () => {
    const out = matchSourceChallenges([{ title: "A", type: "text", order_index: 0 }], [source({ id: "a", title: "A", needs_answer: true })])
    expect(out[0]).toBeNull()
  })
})

/** A service-role client stand-in: one activity with one task, owned by `owner`. */
function fakeAdmin(owner: string, tasks: SourceChallenge[]) {
  const reads: string[] = []
  const client = {
    from(table: string) {
      reads.push(table)
      const filters: Record<string, string> = {}
      const chain = {
        select: () => chain,
        eq(column: string, value: string) {
          filters[column] = value
          return chain
        },
        maybeSingle: async () => ({
          data: table === "games" && filters.id === "game-1" && filters.teacher_id === owner ? { id: "game-1" } : null,
          error: null,
        }),
        then(resolve: (v: { data: SourceChallenge[] | null; error: null }) => void) {
          resolve({ data: table === "challenges" && filters.game_id === "game-1" ? tasks : [], error: null })
        },
      }
      return chain
    },
  }
  return { client: client as unknown as SupabaseClient, reads }
}

describe("sourceAnswers", () => {
  const snapshot = [{ title: "Upė", type: "text", order_index: 0 }]

  it("copies answers when the publisher owns the source activity", async () => {
    const { client } = fakeAdmin("teacher-a", [source({})])
    const out = await sourceAnswers(client, "game-1", "teacher-a", snapshot)
    expect(out[0]?.answer_hash).toBe("$2b$10$hash")
  })

  it("copies nothing from an activity the publisher does not own", async () => {
    const { client, reads } = fakeAdmin("teacher-a", [source({})])
    const out = await sourceAnswers(client, "game-1", "teacher-b", snapshot)
    expect(out).toEqual([null])
    expect(reads).not.toContain("challenges")
  })

  it("copies nothing without a publisher or a source", async () => {
    const { client } = fakeAdmin("teacher-a", [source({})])
    expect(await sourceAnswers(client, "game-1", null, snapshot)).toEqual([null])
    expect(await sourceAnswers(client, null, "teacher-a", snapshot)).toEqual([null])
  })
})
