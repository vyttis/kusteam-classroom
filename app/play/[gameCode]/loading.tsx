/**
 * Player route skeleton: mirrors the play page layout so participants do
 * not see a jarring spinner-to-content flash on iOS Safari. It pulses only
 * when motion is allowed.
 */
export default function PlayLoading() {
  const block = "rounded-full bg-foreground/10 motion-safe:animate-pulse"
  return (
    <div className="min-h-screen px-4 pb-8 pt-3 supports-[min-height:100dvh]:min-h-dvh" role="status">
      <span className="sr-only">Kraunama...</span>
      <div className="mx-auto max-w-lg space-y-4" aria-hidden="true">
        {/* Header row */}
        <div className="flex min-h-11 items-center justify-between">
          <div className={`h-9 w-24 ${block}`} />
          <div className={`h-9 w-24 ${block}`} />
        </div>

        {/* Progress */}
        <div className={`h-2 ${block}`} />

        {/* Task card */}
        <div className="space-y-3 rounded-2xl border border-border bg-white p-5">
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 ${block}`} />
            <div className="flex-1 space-y-2">
              <div className={`h-5 w-3/4 ${block}`} />
              <div className={`h-4 w-20 ${block}`} />
            </div>
          </div>
          <div className="space-y-2 pt-2">
            <div className={`h-4 w-full ${block}`} />
            <div className={`h-4 w-5/6 ${block}`} />
            <div className={`h-4 w-2/3 ${block}`} />
          </div>
          <div className={`h-12 w-full ${block}`} />
          <div className={`h-12 w-full ${block}`} />
        </div>
      </div>
    </div>
  )
}
