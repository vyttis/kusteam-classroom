import { describe, expect, it } from "vitest"
import { readFileSync } from "fs"
import path from "path"

// A bulk insert whose rows carry different keys (accepted_answer_hashes only
// on tasks with extra answers) must let missing keys take the column default.
// Without defaultToNull: false PostgREST sends NULL and the NOT NULL column
// rejects the whole copy: "Dubliuoti" failed in production on 2026-11-08 for
// an activity where one task had an extra accepted answer.
const read = (file: string) => readFileSync(path.join(__dirname, "..", file), "utf8")

describe("bulk task inserts keep column defaults", () => {
  for (const file of ["app/api/games/[gameId]/duplicate/route.ts", "app/api/library/[itemId]/clone/route.ts"]) {
    it(file, () => {
      const source = read(file)
      const bulkInserts = source.match(/\.insert\((?!\{).*$/gm) ?? []
      expect(bulkInserts.length).toBeGreaterThanOrEqual(2)
      for (const call of bulkInserts) expect(call).toContain("defaultToNull: false")
    })
  }
})
