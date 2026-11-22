"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { AnalyticsCards } from "@/components/teacher/analytics-cards"
import { ChallengeStatsTable } from "@/components/teacher/challenge-stats-table"
import { TeamResultsTable } from "@/components/teacher/team-results-table"
import { ReflectionsTable } from "@/components/teacher/reflections-table"
import { ClassDigest } from "@/components/teacher/class-digest"
import { TaskInsights } from "@/components/teacher/task-insights"
import { buildDigest } from "@/lib/game/formative-insights"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { GameStats } from "@/types/game"
import type { DetailedStats } from "@/lib/game/detailed-stats"
import { ArrowLeft, BarChart3, Loader2, MessageSquare } from "lucide-react"
import Link from "next/link"

interface Reflection {
  id: string
  team_name: string
  hardest_challenge_title: string | null
  improvement_text: string
  liked_text: string | null
  created_at: string
}

export default function GameAnalyticsPage() {
  const params = useParams()
  const gameId = params.gameId as string
  const [stats, setStats] = useState<(GameStats & { game_title?: string }) | null>(null)
  const [detailed, setDetailed] = useState<DetailedStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  // Reflections state (lazy-loaded)
  const [reflections, setReflections] = useState<Reflection[] | null>(null)
  const [totalTeams, setTotalTeams] = useState(0)
  const [reflectionsLoading, setReflectionsLoading] = useState(false)
  const [reflectionsError, setReflectionsError] = useState("")

  const [reloadKey, setReloadKey] = useState(0)
  const [detailedFailed, setDetailedFailed] = useState(false)

  useEffect(() => {
    async function fetchStats() {
      setError("")
      try {
        const [basicRes, detailedRes] = await Promise.all([
          fetch(`/api/games/${gameId}/analytics`, { cache: "no-store" }),
          fetch(`/api/games/${gameId}/analytics/detailed`, { cache: "no-store" }),
        ])
        if (!basicRes.ok) {
          throw new Error("Nepavyko gauti statistikos")
        }
        setStats(await basicRes.json())
        // Detailed stats are an enhancement: the page renders without them,
        // but never with details left over from an earlier load.
        if (detailedRes.ok) {
          setDetailed(await detailedRes.json())
          setDetailedFailed(false)
        } else {
          setDetailed(null)
          setDetailedFailed(true)
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Nežinoma klaida")
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [gameId, reloadKey])

  async function loadReflections(force = false) {
    if (!force && reflections !== null) return // Already loaded
    setReflectionsLoading(true)
    setReflectionsError("")
    try {
      const res = await fetch(`/api/games/${gameId}/reflections`)
      if (!res.ok) {
        throw new Error("Nepavyko gauti refleksijų")
      }
      const data = await res.json()
      setReflections(data.reflections || [])
      setTotalTeams(data.total_teams || 0)
    } catch (err: unknown) {
      setReflectionsError(err instanceof Error ? err.message : "Nežinoma klaida")
    } finally {
      setReflectionsLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary-ink" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-accent-ink text-sm">{error}</p>
        <div className="mt-4 flex justify-center gap-2">
          <Button
            size="sm"
            onClick={() => {
              setLoading(true)
              setReloadKey((k) => k + 1)
            }}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Bandyti dar kartą
          </Button>
          <Link href={`/games/${gameId}`}>
            <Button variant="outline" size="sm">
              Grįžti
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div>
      <Link href={`/games/${gameId}`} className="inline-block mb-6">
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Veiklos puslapis
        </Button>
      </Link>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-steam-dark flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary-ink" />
            Veiklos analitika
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Ką aptarti su klase, komandų rezultatai, užduočių statistika ir refleksijos
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setReloadKey((k) => k + 1)
            if (reflections !== null) void loadReflections(true)
          }}
        >
          Atnaujinti
        </Button>
      </div>

      {detailedFailed && (
        <p role="status" className="mb-6 text-sm text-muted-foreground">
          Išsamios statistikos įkelti nepavyko. Bandykite atnaujinti.
        </p>
      )}

      <Tabs defaultValue="stats" onValueChange={(v) => {
        if (v === "reflections") loadReflections()
      }}>
        <TabsList className="mb-6">
          <TabsTrigger value="stats" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Statistika
          </TabsTrigger>
          <TabsTrigger value="reflections" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            Refleksijos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stats">
          {stats && (
            <div className="space-y-6">
              {detailed && (
                <ClassDigest lines={buildDigest(detailed.challenge_stats, detailed.answers_included)} />
              )}
              <AnalyticsCards stats={stats} />
              {detailed && detailed.team_stats.length > 0 && (
                <TeamResultsTable
                  teamStats={detailed.team_stats}
                  totalChallenges={
                    detailed.challenge_stats.length ||
                    stats.challenge_stats?.length ||
                    0
                  }
                  fileLabel={stats.game_title}
                />
              )}
              <ChallengeStatsTable
                stats={stats.challenge_stats || []}
                detailedStats={detailed?.challenge_stats}
              />
              {detailed && (
                <TaskInsights
                  stats={detailed.challenge_stats}
                  answersIncluded={detailed.answers_included}
                />
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="reflections">
          {reflectionsLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary-ink" />
            </div>
          )}
          {reflectionsError && (
            <div className="text-center py-12">
              <p className="text-accent-ink text-sm">{reflectionsError}</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => void loadReflections(true)}>
                Bandyti dar kartą
              </Button>
            </div>
          )}
          {reflections !== null && !reflectionsLoading && !reflectionsError && (
            <ReflectionsTable
              reflections={reflections}
              totalTeams={totalTeams}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
