import type { Metadata } from "next"
import localFont from "next/font/local"
import "./globals.css"
import { Toaster } from "@/components/ui/toaster"
import { MotionProvider } from "@/components/shared/motion-provider"

// Metropolis is the STEAM LT Klaipėda typeface: Regular for text, Bold for
// headings, SemiBold only for interface labels. It is not on Google Fonts,
// so the files are self-hosted (public domain, see fonts/Metropolis-LICENSE.txt;
// taken from @fontsource/metropolis 5.3.0). They cover ą č ę ė į š ų ū ž.
const metropolis = localFont({
  src: [
    { path: "./fonts/Metropolis-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/Metropolis-RegularItalic.woff2", weight: "400", style: "italic" },
    { path: "./fonts/Metropolis-SemiBold.woff2", weight: "600", style: "normal" },
    { path: "./fonts/Metropolis-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-metropolis",
  display: "swap",
  fallback: ["system-ui", "-apple-system", "Segoe UI", "Arial", "sans-serif"],
})

// Activity codes and other fixed-width text.
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
})

// Canonical public address of the classroom; .vercel.app hosts are
// infrastructure only and never appear in metadata or shared links.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://pamokos.kusteam.app"
const DESCRIPTION =
  "KU STEAM AI LAB platforma, kurioje vedėjai kuria ir veda interaktyvias veiklas, o dalyviai prie jų prisijungia su kodu."

export const metadata: Metadata = {
  // Each page names itself ("Mano veiklos | KU STEAM pamokos"); the default
  // stays for pages without a title of their own.
  title: { default: "KU STEAM CLASSROOM | Interaktyvios pamokos", template: "%s | KU STEAM pamokos" },
  description: DESCRIPTION,
  icons: {
    icon: "/icon.svg",
  },
  metadataBase: new URL(SITE_URL),
  alternates: { canonical: "/" },
  openGraph: {
    title: "KU STEAM CLASSROOM",
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: "KU STEAM AI LAB",
    type: "website",
    locale: "lt_LT",
  },
  twitter: {
    card: "summary_large_image",
    title: "KU STEAM CLASSROOM",
    description: DESCRIPTION,
  },
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nosnippet: true,
    googleBot: {
      index: false,
      follow: false,
      noarchive: true,
      nosnippet: true,
    },
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="lt" suppressHydrationWarning>
      <body
        className={`${metropolis.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <MotionProvider>
          {children}
        </MotionProvider>
        <Toaster />
      </body>
    </html>
  )
}
