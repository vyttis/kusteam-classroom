"use client"

import { useState, useEffect } from "react"
import { LibraryItem } from "@/types/game"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import {
  Loader2,
  Search,
  Plus,
  ChevronDown,
  ChevronUp,
} from "lucide-react"

interface LibraryWorkspaceProps {
  gameId: string
  onTaskAdded: () => void
}

export function LibraryWorkspace({ gameId, onTaskAdded }: LibraryWorkspaceProps) {
  const { toast } = useToast()
  const [items, setItems] = useState<LibraryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [search, setSearch] = useState("")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [addingIds, setAddingIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchItems()
  }, [])

  async function fetchItems() {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch("/api/library?status=approved&limit=50")
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setItems(data.items || [])
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  const filtered = items.filter(
    (item) =>
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      (item.description || "").toLowerCase().includes(search.toLowerCase()) ||
      (item.tags || []).some((t) =>
        t.toLowerCase().includes(search.toLowerCase())
      )
  )

  async function addChallengeFromLibrary(item: LibraryItem, snap: { title: string }, index: number) {
    const key = `${item.id}-${index}`
    setAddingIds((prev) => new Set(prev).add(key))
    try {
      // The server copies the task with its picture and, when it can find
      // the task in the published activity, its answer and explanation.
      const res = await fetch(`/api/library/${item.id}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game_id: gameId, index }),
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string; has_answer?: boolean }
      if (!res.ok) throw new Error(body.error ?? "")
      toast({
        title: `Užduotis „${snap.title}“ pridėta`,
        description: body.has_answer ? undefined : "Nepamirškite nustatyti teisingo atsakymo.",
      })
      onTaskAdded()
    } catch (e) {
      toast({
        title: "Nepavyko pridėti užduoties",
        description: e instanceof Error && e.message ? e.message : undefined,
        variant: "destructive",
      })
    } finally {
      setAddingIds((prev) => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold leading-tight text-steam-dark">Biblioteka</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Atverkite patvirtintą veiklą ir pridėkite iš jos tinkamas užduotis.
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          placeholder="Ieškoti..."
          aria-label="Ieškoti bibliotekoje"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-white pl-10"
        />
      </div>

      {loading && (
        <p role="status" className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-4 py-4 text-sm text-foreground">
          <Loader2 className="h-5 w-5 shrink-0 animate-spin text-steam-dark motion-reduce:animate-none" aria-hidden="true" />
          Įkeliama biblioteka...
        </p>
      )}

      {!loading && error && (
        <div
          role="alert"
          className="rounded-xl border border-border border-l-[6px] border-l-accent bg-white px-4 py-3"
        >
          <p className="text-sm font-bold text-foreground">Nepavyko įkelti bibliotekos.</p>
          <Button variant="outline" size="sm" onClick={fetchItems} className="mt-2">
            Bandyti dar kartą
          </Button>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <p className="rounded-xl border border-dashed border-foreground/25 px-4 py-8 text-center text-sm text-muted-foreground">
          {items.length === 0
            ? "Bibliotekoje dar nėra patvirtintų veiklų"
            : "Nerasta rezultatų"}
        </p>
      )}

      {/* Library items */}
      <ul className="space-y-2">
        {filtered.map((item) => {
          const expanded = expandedId === item.id
          const count = item.challenge_data?.length || 0
          return (
            <li key={item.id} className="rounded-xl border border-border bg-white">
              <button
                type="button"
                aria-expanded={expanded}
                className="flex min-h-14 w-full items-start justify-between gap-3 rounded-xl p-3 text-left hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                onClick={() => setExpandedId(expanded ? null : item.id)}
              >
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-steam-dark">{item.title}</span>
                  {item.description && (
                    <span className="mt-0.5 line-clamp-2 block text-sm text-muted-foreground">
                      {item.description}
                    </span>
                  )}
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {[`${count} užd.`, item.subject].filter(Boolean).join(" · ")}
                  </span>
                </span>
                {expanded ? (
                  <ChevronUp className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                ) : (
                  <ChevronDown className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                )}
              </button>

              {expanded && item.challenge_data && (
                <ul className="motion-fade-in divide-y divide-border border-t border-border px-3">
                  {item.challenge_data.map((snap, i) => {
                    const key = `${item.id}-${i}`
                    return (
                      <li key={i} className="flex items-center justify-between gap-3 py-2">
                        <div className="min-w-0">
                          <p className="line-clamp-2 break-words text-sm font-bold text-steam-dark">{snap.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {snap.points} tšk. &middot;{" "}
                            {snap.type === "text"
                              ? "Tekstas"
                              : snap.type === "number"
                              ? "Skaičius"
                              : "Pasirinkimas"}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="shrink-0 gap-1.5"
                          aria-label={`Pridėti „${snap.title}“`}
                          disabled={addingIds.has(key)}
                          onClick={() => addChallengeFromLibrary(item, snap, i)}
                        >
                          {addingIds.has(key) ? (
                            <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                          ) : (
                            <Plus className="h-4 w-4" aria-hidden="true" />
                          )}
                          Pridėti
                        </Button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
