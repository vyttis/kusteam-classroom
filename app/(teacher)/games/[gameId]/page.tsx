import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { GameStatus, GameSettings, Challenge, LibraryItemStatus } from "@/types/game"
import { computeDetailedStats } from "@/lib/game/detailed-stats"
import { QRDisplay } from "@/components/teacher/qr-display"
import { GameStatusActions } from "@/components/teacher/game-status-actions"
import { GameStatusWatcher } from "@/components/teacher/game-status-watcher"
import { GameDetailClient } from "@/components/teacher/game-detail-client"
import { DraftReadinessChecklist } from "@/components/teacher/draft-readiness-checklist"
import { TeamResultsTable } from "@/components/teacher/team-results-table"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { LiveActivityFeed } from "@/components/teacher/live-activity-feed"
import { LiveControlCenter } from "@/components/teacher/live-control-center"
import { GameResultsSummary } from "@/components/teacher/game-results-summary"
import {
  ArrowLeft,
  Puzzle,
  Pencil,
  Users,
  Clock,
  Trophy,
  BarChart3,
  Sparkles,
  Printer,
  MonitorPlay,
  AlertTriangle,
} from "lucide-react"
import Link from "next/link"
import Image from "next/image"

export const metadata: Metadata = { title: "Veikla" }

const LIBRARY_STATUS_BADGES: Record<
  LibraryItemStatus,
  { label: string; className: string }
> = {
  pending_review: {
    label: "Biblioteka: laukia peržiūros",
    className: "border-highlight/40 text-highlight-ink",
  },
  approved: {
    label: "Biblioteka: patvirtinta",
    className: "border-primary/40 text-primary-ink",
  },
  rejected: {
    label: "Biblioteka: atmesta",
    className: "border-accent/40 text-accent-ink",
  },
}

export default async function GameDetailPage(
  props: {
    params: Promise<{ gameId: string }>
  }
) {
  const params = await props.params;
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // answer_hash intentionally excluded
  const CHALLENGE_FIELDS =
    "id, game_id, title, description, type, points, hints, options, order_index, image_url, maps_url, explanation, difficulty, hint_penalty, generated_by_di, verification_verdict, verification_issues, verification_confidence, prerequisites, needs_answer, created_at, updated_at"

  // teams has column-level grants only (00022), so embed the granted `id`
  // column; a `teams(count)` embed fails with "permission denied".
  const { data: game, error: gameError } = await supabase
    .from("games")
    .select(`*, challenges(${CHALLENGE_FIELDS}), teams(id)`)
    .eq("id", params.gameId)
    .eq("teacher_id", user!.id)
    .maybeSingle()

  if (gameError) {
    console.error("[game-detail] game query failed", {
      code: gameError.code,
      message: gameError.message,
    })
    throw new Error("Nepavyko įkelti veiklos")
  }

  if (!game) {
    notFound()
  }

  const challenges = (game.challenges || []) as Challenge[]
  const teamCount = ((game.teams as { id: string }[] | null) || []).length
  const settings = game.settings as GameSettings | null
  const status = game.status as GameStatus
  const isLive = status === "active" || status === "paused"
  const isFinished = status === "finished"
  const isDraft = status === "draft"

  const tasksNeedingAnswer = challenges
    .filter((c) => c.needs_answer)
    .sort((a, b) => a.order_index - b.order_index)
    .map((c) => ({ id: c.id, title: c.title }))

  // Own library submission status for this game (badge next to share button)
  const { data: libraryItem } = await supabase
    .from("library_items")
    .select("status")
    .eq("source_game_id", game.id)
    .eq("published_by", user!.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  // Finished games lead with results, computed server-side. If the answers
  // cannot be read in full, the page shows without the results block rather
  // than with partial numbers.
  const detailedStats = isFinished
    ? await computeDetailedStats(supabase, game.id).catch(() => null)
    : null

  // The team count is read once on the server. During a live session the
  // control centre shows the live count, so a tile here would stay at the
  // number from page load: show it only for a finished session.
  const statsCards = (
    <div className={isFinished ? "grid grid-cols-2 sm:grid-cols-4 gap-3" : "grid grid-cols-3 gap-3"}>
      <Card className="border-border/50 bg-white">
        <CardContent className="p-4 text-center">
          <Puzzle className="h-5 w-5 mx-auto mb-1 text-primary-ink" />
          <p className="text-2xl font-bold text-steam-dark">
            {challenges.length}
          </p>
          <p className="text-xs text-muted-foreground">Užduotys</p>
        </CardContent>
      </Card>
      {isFinished && (
        <Card className="border-border/50 bg-white">
          <CardContent className="p-4 text-center">
            <Users className="h-5 w-5 mx-auto mb-1 text-secondary-ink" />
            <p className="text-2xl font-bold text-steam-dark">{teamCount}</p>
            <p className="text-xs text-muted-foreground">Komandos</p>
          </CardContent>
        </Card>
      )}
      <Card className="border-border/50 bg-white">
        <CardContent className="p-4 text-center">
          <Trophy className="h-5 w-5 mx-auto mb-1 text-highlight-ink" />
          <p className="text-2xl font-bold text-steam-dark">
            {challenges.reduce(
              (sum: number, c: Challenge) => sum + (c.points || 0),
              0
            )}
          </p>
          <p className="text-xs text-muted-foreground">Viso taškų</p>
        </CardContent>
      </Card>
      <Card className="border-border/50 bg-white">
        <CardContent className="p-4 text-center">
          <Clock className="h-5 w-5 mx-auto mb-1 text-accent-ink" />
          <p className="text-2xl font-bold text-steam-dark">
            {settings?.time_limit_minutes || "∞"}
          </p>
          <p className="text-xs text-muted-foreground">Minutės</p>
        </CardContent>
      </Card>
    </div>
  )

  const challengeList = (
    <Card className="border-border/50 bg-white">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg flex items-center gap-2">
          <Puzzle className="h-5 w-5 text-primary-ink" />
          Užduotys
        </CardTitle>
        <Link href={`/games/${game.id}/builder`}>
          <Button
            size="sm"
            className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1"
          >
            <Pencil className="h-3.5 w-3.5" />
            Redaguoti užduotis
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {challenges.length > 0 ? (
          <div className="space-y-3">
            {[...challenges]
              .sort((a, b) => a.order_index - b.order_index)
              .map((challenge, index) => (
                <Link
                  key={challenge.id}
                  href={`/games/${game.id}/builder?task=${challenge.id}`}
                  aria-label={`Redaguoti „${challenge.title}“`}
                  className="group flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/30 transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary-ink shrink-0">
                    {index + 1}
                  </div>
                  {challenge.image_url && (
                    <Image src={challenge.image_url} alt="" width={40} height={40} className="rounded-lg object-cover shrink-0 border border-border/30" unoptimized />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-steam-dark truncate">
                      {challenge.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {challenge.points} tšk. &middot;{" "}
                      {challenge.type === "text"
                        ? "Tekstas"
                        : challenge.type === "number"
                        ? "Skaičius"
                        : "Pasirinkimas"}
                    </p>
                  </div>
                  {challenge.needs_answer && (
                    <Badge className="shrink-0 text-xs bg-accent/10 text-accent-ink border-accent/40 hover:bg-accent/15 gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Trūksta atsakymo
                    </Badge>
                  )}
                  <Badge variant="outline" className="shrink-0 text-xs">
                    {challenge.points} tšk.
                  </Badge>
                  <Pencil className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary-ink" aria-hidden="true" />
                </Link>
              ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Image src="/illustrations/empty-state.svg" alt="" width={128} height={128} className="mx-auto mb-3 opacity-50" />
            <p className="text-muted-foreground text-sm mb-3">
              Dar nėra užduočių
            </p>
            <Link href={`/games/${game.id}/builder`}>
              <Button
                size="sm"
                className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Kurti užduotis
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  )

  const gameInfoCard = (
    <Card className="border-border/50 bg-white">
      <CardContent className="p-4 space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Sukurtas</span>
          <span className="text-steam-dark font-medium">
            {new Date(game.created_at).toLocaleDateString("lt-LT", { timeZone: "Europe/Vilnius" })}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Maks. komandų</span>
          <span className="text-steam-dark font-medium">
            {settings?.max_teams || 50}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Rezultatų lentelė</span>
          <span className="text-steam-dark font-medium">
            {settings?.show_leaderboard ? "Taip" : "Ne"}
          </span>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div>
      {/* Back */}
      <Link href="/dashboard" className="inline-block mb-6">
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Visos veiklos
        </Button>
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-steam-dark">{game.title}</h1>
          {game.description && (
            <p className="text-muted-foreground mt-1">{game.description}</p>
          )}
          {libraryItem && (
            <Badge
              variant="outline"
              className={`mt-2 text-xs ${LIBRARY_STATUS_BADGES[libraryItem.status as LibraryItemStatus].className}`}
            >
              {LIBRARY_STATUS_BADGES[libraryItem.status as LibraryItemStatus].label}
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <GameStatusWatcher
            gameCode={game.game_code}
            status={status}
            timeLimit={settings?.time_limit_minutes ?? null}
            resumedAt={(game as { resumed_at?: string | null }).resumed_at ?? null}
          />
          <GameStatusActions
            gameId={game.id}
            status={status}
            challengeCount={challenges.length}
            tasksNeedingAnswer={tasksNeedingAnswer}
          />
          {isLive && (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="gap-2 border-accent/30 text-accent-ink hover:bg-accent/5"
            >
              <Link href={`/games/${game.id}/live`} target="_blank">
                <MonitorPlay className="h-4 w-4" aria-hidden="true" />
                Klasės ekranas
              </Link>
            </Button>
          )}
          {!isDraft && (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="gap-2 border-primary/30 text-primary-ink hover:bg-primary/5"
            >
              <Link href={`/games/${game.id}/analytics`}>
                <BarChart3 className="h-4 w-4" aria-hidden="true" />
                Analitika
              </Link>
            </Button>
          )}
          {isFinished && (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="gap-2 border-secondary/30 text-secondary-ink hover:bg-secondary/5"
            >
              <Link href={`/games/${game.id}/report`}>
                <Printer className="h-4 w-4" aria-hidden="true" />
                Spausdinti ataskaitą
              </Link>
            </Button>
          )}
          <GameDetailClient
            canPublish={(status === "active" || status === "finished") && challenges.length > 0}
            game={{
              id: game.id,
              title: game.title,
              description: game.description,
              status: status,
              settings: settings || { max_teams: 50, time_limit_minutes: null, show_leaderboard: true, shuffle_challenges: false },
              game_code: game.game_code,
            }}
          />
        </div>
      </div>

      {isFinished ? (
        /* ============ FINISHED: results first ============ */
        <div className="space-y-6">
          {challenges.length > 0 && (
            <GameResultsSummary
              gameId={game.id}
              totalChallenges={challenges.length}
            />
          )}
          {detailedStats && (
            <TeamResultsTable
              teamStats={detailedStats.team_stats}
              totalChallenges={challenges.length}
              fileLabel={game.title}
            />
          )}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">{challengeList}</div>
            <div className="space-y-6">
              {statsCards}
              {gameInfoCard}
            </div>
          </div>
        </div>
      ) : isLive ? (
        /* ============ ACTIVE/PAUSED: live view first ============ */
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <LiveControlCenter
              gameId={game.id}
              gameStatus={game.status}
              resumedAt={(game as { resumed_at?: string | null }).resumed_at ?? null}
              challengeCount={challenges.length}
              settings={{
                time_limit_minutes: settings?.time_limit_minutes ?? null,
                max_teams: settings?.max_teams ?? 50,
                joining_closed: settings?.joining_closed === true,
              }}
            />
            <LiveActivityFeed gameId={game.id} />
            {challenges.length > 0 && (
              <GameResultsSummary
                gameId={game.id}
                totalChallenges={challenges.length}
              />
            )}
            {challengeList}
          </div>
          <div className="space-y-6">
            <QRDisplay gameCode={game.game_code} />
            {statsCards}
            {gameInfoCard}
          </div>
        </div>
      ) : (
        /* ============ DRAFT: builder-centric ============ */
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <DraftReadinessChecklist
              challengeCount={challenges.length}
              tasksNeedingAnswer={tasksNeedingAnswer.length}
              tasksWithoutText={(challenges || []).filter((c) => !(c.description ?? "").trim()).length}
              tasksNeedingReview={
                (challenges || []).filter(
                  (c) =>
                    c.generated_by_di &&
                    !c.needs_answer &&
                    (c.verification_verdict === "uncertain" || c.verification_verdict === "fail")
                ).length
              }
              hasDescription={!!game.description}
              hasTimeLimit={!!settings?.time_limit_minutes}
            />
            {statsCards}
            {challengeList}
          </div>
          <div className="space-y-6">
            <QRDisplay gameCode={game.game_code} />
            {gameInfoCard}
          </div>
        </div>
      )}
    </div>
  )
}
