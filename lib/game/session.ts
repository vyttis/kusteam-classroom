import type { PlayerSession } from "@/types/game"

const SESSION_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

/**
 * Shown when the browser refuses to store the team's session (private
 * browsing with storage off, blocked site data): without it the team would
 * be created and lost on the next page.
 */
export const STORAGE_BLOCKED_MESSAGE =
  "Ši naršyklė neleidžia išsaugoti jūsų komandos, todėl prisijungti nepavyks. Išjunkite privataus naršymo režimą arba leiskite svetainei saugoti duomenis ir bandykite dar kartą."

/**
 * localStorage access throws in browsers that block site data, and the
 * property itself may throw. Every read and write goes through these.
 */
export function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeStored(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

function removeStored(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // Storage blocked: nothing was stored either.
  }
}

/** Whether this browser can keep a team's session: asked before a team is created. */
export function canStorePlayerSession(): boolean {
  const probe = "ctf_storage_probe"
  try {
    localStorage.setItem(probe, "1")
    const kept = localStorage.getItem(probe) === "1"
    localStorage.removeItem(probe)
    return kept
  } catch {
    return false
  }
}

export function getPlayerSession(gameCode: string): PlayerSession | null {
  const stored = readStored(`ctf_session_${gameCode}`)
  if (!stored) return null

  try {
    const session: PlayerSession = JSON.parse(stored)

    // Validate session has required fields
    if (!session.session_token || !session.team_id) {
      clearPlayerSession(gameCode)
      return null
    }

    // Check expiry (sessions without created_at are treated as legacy — still valid)
    if (session.created_at && Date.now() - session.created_at > SESSION_TTL_MS) {
      clearPlayerSession(gameCode)
      return null
    }

    return session
  } catch {
    clearPlayerSession(gameCode)
    return null
  }
}

/** false when the browser refused to store it. */
export function savePlayerSession(gameCode: string, session: PlayerSession): boolean {
  const withTimestamp: PlayerSession = {
    ...session,
    created_at: session.created_at ?? Date.now(),
  }
  return writeStored(`ctf_session_${gameCode}`, JSON.stringify(withTimestamp))
}

export function clearPlayerSession(gameCode: string): void {
  removeStored(`ctf_session_${gameCode}`)
  removeStored(`ctf_start_${gameCode}`)
  removeStored(`ctf_reflection_${gameCode}`)
}
