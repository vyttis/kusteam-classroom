/**
 * What a person sees when the TEAM sign-in cannot continue (contract
 * section 7). The texts are exactly the contract's; no codes or ids are ever
 * shown. Client-safe: no server imports.
 */

export type TeamSsoMessageKind = "nesuteikta" | "sustabdyta" | "negalioja" | "atsijungta" | "nepasiekiamas"

export interface TeamSsoMessage {
  text: string
  /** Label of the button to TEAM, or null when the contract gives none. */
  button: string | null
}

export const TEAM_SSO_MESSAGES: Record<TeamSsoMessageKind, TeamSsoMessage> = {
  nesuteikta: {
    text: "Ši veikla jums nesuteikta. Jei manote, kad tai klaida, rašykite steam@ku.lt.",
    button: "Grįžti į KU STEAM TEAM",
  },
  sustabdyta: {
    text: "Jūsų KU STEAM TEAM prieiga sustabdyta. Kreipkitės į KU STEAM centrą: steam@ku.lt.",
    button: null,
  },
  negalioja: {
    text: "Prisijungimo nuoroda nebegalioja. Atidarykite veiklą iš KU STEAM TEAM dar kartą.",
    button: "Atidaryti KU STEAM TEAM",
  },
  atsijungta: {
    text: "Atsijungėte nuo KU STEAM TEAM. Norėdami tęsti, prisijunkite iš naujo.",
    button: "Atidaryti KU STEAM TEAM",
  },
  nepasiekiamas: {
    text: "KU STEAM TEAM šiuo metu nepasiekiamas. Pabandykite po kelių minučių.",
    button: "Bandyti dar kartą",
  },
}

const KINDS = Object.keys(TEAM_SSO_MESSAGES) as TeamSsoMessageKind[]

/**
 * The message for an error code from TEAM (`error` on the callback), a
 * redeem status reason or a session status reason. Anything unknown is
 * treated as an expired link: the person starts again from TEAM.
 */
export function messageKindFor(code: string | null | undefined): TeamSsoMessageKind {
  switch (code) {
    case "access_denied":
    case "grant_revoked":
    case "not_member":
      return "nesuteikta"
    case "blocked":
      return "sustabdyta"
    case "logged_out":
      return "atsijungta"
    case "temporarily_unavailable":
    case "slow_down":
    case "network":
      return "nepasiekiamas"
    default:
      // invalid_state, invalid_grant, invalid_request, expired, unknown
      return "negalioja"
  }
}

export function parseMessageKind(raw: string | string[] | undefined | null): TeamSsoMessageKind {
  const value = Array.isArray(raw) ? raw[0] : raw
  return KINDS.includes(value as TeamSsoMessageKind) ? (value as TeamSsoMessageKind) : "negalioja"
}

/** Same-origin path of the message page. */
export function messagePath(kind: TeamSsoMessageKind): string {
  return `/auth/team/pranesimas?p=${kind}`
}
