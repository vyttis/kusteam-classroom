import { NextResponse } from "next/server"

/** Shown to a participant when a read failed for a moment; asking again is safe. */
export const RETRY_LATER_MESSAGE = "Laikinas ryšio sutrikimas. Bandykite dar kartą po kelių sekundžių."

type QueryError = { code?: string; message?: string } | null | undefined

/**
 * 503 for a database read that FAILED, as opposed to one that found nothing.
 * Participant routes must keep the two apart: "no such team" makes the phone
 * drop its stored session, while a failed read only asks it to try again.
 * The failure is logged; the answer is never cached.
 */
export function retryLater(where: string, error: QueryError) {
  console.error(
    JSON.stringify({
      event: "participant_read_failed",
      where,
      code: error?.code ?? null,
      message: error?.message ?? null,
    })
  )
  return NextResponse.json(
    { error: RETRY_LATER_MESSAGE, code: "retry" },
    { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "2" } }
  )
}

/** PostgREST's "no row" from .single(): an expected miss, not a failure. */
export const NO_ROW = "PGRST116"
