"use client"

import { useEffect } from "react"

/**
 * Shown when the root layout itself fails. It replaces the whole document,
 * so it brings its own <html>, <body> and inline styles: globals.css,
 * fonts and the layout's providers are not available here.
 */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error("Root layout error:", error)
  }, [error])

  const digest =
    error && typeof error === "object" && "digest" in error && typeof error.digest === "string"
      ? error.digest
      : null

  return (
    <html lang="lt">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 16,
          background: "#F8FAFB",
          color: "#003B4E",
          fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        <title>Klaida | KU STEAM pamokos</title>
        <main style={{ maxWidth: 420, textAlign: "center" }}>
          <h1 style={{ fontSize: 24, lineHeight: 1.25, margin: "0 0 8px" }}>Puslapio nepavyko parodyti</h1>
          <p style={{ fontSize: 16, lineHeight: 1.5, margin: "0 0 24px", color: "#3D5A61" }}>
            Bandykite dar kartą. Jei klaida kartojasi, grįžkite į pradžią ir pabandykite po kelių minučių.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => retry()}
              style={{
                minHeight: 44,
                padding: "0 20px",
                border: 0,
                borderRadius: 10,
                background: "#003B4E",
                color: "#FFFFFF",
                fontSize: 16,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Bandyti dar kartą
            </button>
            {/* A full page load on purpose: the root layout is what failed. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              style={{
                minHeight: 44,
                padding: "0 20px",
                display: "inline-flex",
                alignItems: "center",
                borderRadius: 10,
                border: "1px solid #6F8A91",
                color: "#003B4E",
                fontSize: 16,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Į pradžią
            </a>
          </div>
          {digest && (
            <p style={{ fontSize: 13, marginTop: 24, color: "#3D5A61" }}>Klaidos kodas: {digest}</p>
          )}
        </main>
      </body>
    </html>
  )
}
