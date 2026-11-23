import { describe, expect, it } from "vitest"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"

// STEAM LT Klaipėda colours (brand book): dark blue #003B4E, pink #FF306D,
// blue #008CB5, green #00D99B, yellow #FFCE4E. Text is black, white or dark
// blue. White on the green is 1.8:1, on the yellow 1.5:1 and on the pink
// 3.6:1, all below the 4.5:1 that WCAG AA asks for body text, so those
// surfaces take their -foreground token (dark blue or black) instead.

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return tsxFiles(path)
    return path.endsWith(".tsx") ? [path] : []
  })
}

const STRING_LITERAL = /(["`])([^"`\n]*?)\1/g
const SOLID_GREEN = /^bg-(primary|steam-green|success)$/
const SOLID_YELLOW_OR_PINK = /^bg-(highlight|steam-yellow|accent|steam-pink)$/

function whiteTextOn(surface: RegExp): string[] {
  const offenders: string[] = []
  for (const file of [...tsxFiles("app"), ...tsxFiles("components")]) {
    const source = readFileSync(file, "utf8")
    for (const match of source.matchAll(STRING_LITERAL)) {
      const tokens = match[2].split(/\s+/)
      if (tokens.some((t) => surface.test(t)) && tokens.includes("text-white")) {
        const line = source.slice(0, match.index).split("\n").length
        offenders.push(`${file}:${line}`)
      }
    }
  }
  return offenders
}

type Rgb = [number, number, number]

function hexToRgb(hex: string): Rgb {
  const h = hex.replace("#", "")
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  const sat = s / 100
  const light = l / 100
  const k = (n: number) => (n + h / 30) % 12
  const a = sat * Math.min(light, 1 - light)
  const f = (n: number) => light - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return [f(0), f(8), f(4)].map((v) => Math.round(v * 255)) as Rgb
}

function luminance([r, g, b]: Rgb): number {
  const channel = (v: number) => {
    const c = v / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** A colour at the given opacity over a background (a Tailwind `/20` tint). */
function over(color: Rgb, background: Rgb, alpha: number): Rgb {
  return color.map((v, i) => Math.round(v * alpha + background[i] * (1 - alpha))) as Rgb
}

/** The custom properties of one rule in globals.css, as RGB. */
function tokens(selector: ":root" | ".dark"): Record<string, Rgb> {
  const css = readFileSync("app/globals.css", "utf8")
  const start = css.indexOf(`${selector} {`)
  expect(start, `${selector} block in globals.css`).toBeGreaterThan(-1)
  const block = css.slice(start, css.indexOf("\n  }", start))
  const out: Record<string, Rgb> = {}
  for (const m of block.matchAll(/--([a-z-]+):\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%/g)) {
    out[m[1]] = hslToRgb(Number(m[2]), Number(m[3]), Number(m[4]))
  }
  return out
}

const WHITE: Rgb = [255, 255, 255]
const BRAND = {
  dark: "#003B4E",
  pink: "#FF306D",
  blue: "#008CB5",
  green: "#00D99B",
  yellow: "#FFCE4E",
} as const

const AA_TEXT = 4.5
const AA_LARGE = 3

describe("contrast tokens", () => {
  it("never put white text on the brand green", () => {
    expect(whiteTextOn(SOLID_GREEN)).toEqual([])
  })

  it("never put white text on the brand yellow or pink", () => {
    expect(whiteTextOn(SOLID_YELLOW_OR_PINK)).toEqual([])
  })

  it("uses the exact brand colours", () => {
    const light = tokens(":root")
    const dark = tokens(".dark")
    for (const theme of [light, dark]) {
      expect(theme.primary).toEqual(hexToRgb(BRAND.green))
      expect(theme.secondary).toEqual(hexToRgb(BRAND.blue))
      expect(theme.accent).toEqual(hexToRgb(BRAND.pink))
      expect(theme.highlight).toEqual(hexToRgb(BRAND.yellow))
      expect(theme["primary-foreground"]).toEqual(hexToRgb(BRAND.dark))
    }
    expect(light.ring).toEqual(hexToRgb(BRAND.dark))
    expect(dark.background).toEqual(hexToRgb(BRAND.dark))

    const config = readFileSync("tailwind.config.ts", "utf8")
    for (const [name, hex] of Object.entries(BRAND)) {
      expect(config).toContain(`${name}: "${hex}"`)
    }
    // The earlier near-brand palette is gone from the tokens.
    for (const old of ["#00D296", "#FA2864", "#FAC846", "#008CB4", "#00323C"]) {
      expect(config).not.toContain(old)
    }
  })

  describe.each([":root", ".dark"] as const)("%s", (selector) => {
    const t = tokens(selector)

    it("text on its surface meets AA (4.5:1)", () => {
      const pairs: [string, string][] = [
        ["foreground", "background"],
        ["card-foreground", "card"],
        ["popover-foreground", "popover"],
        ["muted-foreground", "background"],
        ["muted-foreground", "muted"],
        ["muted-foreground", "card"],
        ["foreground", "muted"],
        ["primary-foreground", "primary"],
        ["secondary-foreground", "secondary"],
        ["accent-foreground", "accent"],
        ["highlight-foreground", "highlight"],
        ["success-foreground", "success"],
        ["destructive-foreground", "destructive"],
        // Solid -ink fills (secondary button and badge, count bubbles).
        ["ink-foreground", "secondary-ink"],
        ["ink-foreground", "accent-ink"],
        ["ink-foreground", "primary-ink"],
        ["ink-foreground", "highlight-ink"],
      ]
      for (const [text, surface] of pairs) {
        expect(contrast(t[text], t[surface]), `${text} on ${surface}`).toBeGreaterThanOrEqual(AA_TEXT)
      }
    })

    it("-ink text meets AA on the page, the card and the muted surface", () => {
      for (const ink of ["primary-ink", "secondary-ink", "accent-ink", "highlight-ink"]) {
        for (const surface of ["background", "card", "muted"]) {
          expect(contrast(t[ink], t[surface]), `${ink} on ${surface}`).toBeGreaterThanOrEqual(AA_TEXT)
        }
      }
    })

    it("control edges and the focus ring reach 3:1", () => {
      expect(contrast(t.input, t.background), "input on background").toBeGreaterThanOrEqual(AA_LARGE)
      expect(contrast(t.ring, t.background), "ring on background").toBeGreaterThanOrEqual(AA_LARGE)
    })
  })

  it("light theme: -ink text stays AA on a 20% tint of its own colour", () => {
    const t = tokens(":root")
    for (const name of ["primary", "secondary", "accent", "highlight"]) {
      const tint = over(t[name], t.background, 0.2)
      expect(contrast(t[`${name}-ink`], tint), `${name}-ink on ${name}/20`).toBeGreaterThanOrEqual(AA_TEXT)
    }
  })

  it("white text is safe on the dark blue and on the light -ink fills", () => {
    const t = tokens(":root")
    expect(contrast(WHITE, hexToRgb(BRAND.dark))).toBeGreaterThanOrEqual(AA_TEXT)
    for (const ink of ["primary-ink", "secondary-ink", "accent-ink", "highlight-ink", "destructive"]) {
      expect(contrast(WHITE, t[ink]), `white on ${ink}`).toBeGreaterThanOrEqual(AA_TEXT)
    }
  })

  it("dark blocks: green and yellow carry small text, pink and blue only large text and icons", () => {
    const dark = hexToRgb(BRAND.dark)
    expect(contrast(hexToRgb(BRAND.green), dark)).toBeGreaterThanOrEqual(AA_TEXT)
    expect(contrast(hexToRgb(BRAND.yellow), dark)).toBeGreaterThanOrEqual(AA_TEXT)
    expect(contrast(hexToRgb(BRAND.pink), dark)).toBeGreaterThanOrEqual(AA_LARGE)
    expect(contrast(hexToRgb(BRAND.blue), dark)).toBeGreaterThanOrEqual(AA_LARGE)
  })

  it("white is not a text colour for the green, yellow, pink or blue surface tokens", () => {
    const t = tokens(":root")
    for (const name of ["primary", "highlight", "accent", "secondary", "success"]) {
      expect(t[`${name}-foreground`], `${name}-foreground`).not.toEqual(WHITE)
    }
  })
})
