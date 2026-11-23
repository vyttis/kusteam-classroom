import { ImageResponse } from "next/og"

export const alt = "KU STEAM CLASSROOM | Interaktyvios pamokos"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #003B4E 0%, #004D5C 50%, #003B4E 100%)",
          fontFamily: "system-ui, sans-serif",
          padding: "60px 80px",
        }}
      >
        {/* Decorative circles */}
        <div
          style={{
            position: "absolute",
            top: -80,
            right: -80,
            width: 300,
            height: 300,
            borderRadius: "50%",
            background: "rgba(0, 210, 150, 0.08)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -60,
            left: -60,
            width: 200,
            height: 200,
            borderRadius: "50%",
            background: "rgba(0, 140, 180, 0.06)",
          }}
        />

        {/* Title */}
        <div
          style={{
            fontSize: 48,
            fontWeight: 800,
            color: "white",
            letterSpacing: "-0.02em",
            textAlign: "center",
            lineHeight: 1.15,
            display: "flex",
            marginBottom: 16,
            maxWidth: 800,
          }}
        >
          KU STEAM CLASSROOM
        </div>

        {/* Accent line */}
        <div
          style={{
            width: 80,
            height: 4,
            borderRadius: 2,
            background: "#00D99B",
            marginBottom: 24,
            display: "flex",
          }}
        />

        {/* Description */}
        <div
          style={{
            fontSize: 22,
            color: "rgba(255, 255, 255, 0.7)",
            textAlign: "center",
            lineHeight: 1.5,
            maxWidth: 700,
            display: "flex",
          }}
        >
          Interaktyvios pamokos: vedėjas kuria veiklą, dalyviai prisijungia su kodu
        </div>

        {/* Bottom badge */}
        <div
          style={{
            position: "absolute",
            bottom: 48,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#00D99B",
              display: "flex",
            }}
          />
          <div
            style={{
              fontSize: 16,
              color: "rgba(255, 255, 255, 0.5)",
              letterSpacing: "0.05em",
              display: "flex",
            }}
          >
            Klaipėdos universiteto STEAM metodinis centras
          </div>
        </div>
      </div>
    ),
    { ...size }
  )
}
