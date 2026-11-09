/** @type {import('next').NextConfig} */
const nextConfig = {
  // No "X-Powered-By: Next.js".
  poweredByHeader: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
  async headers() {
    return [
      // Security headers on every response. The classroom is never shown
      // inside another site (frame-ancestors / X-Frame-Options stop
      // clickjacking of the facilitator and admin pages). The camera is used
      // only by the participant QR scanner on this site.
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=()" },
        ],
      },
      {
        source: "/((?!opengraph-image).*)",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow, noarchive, nosnippet",
          },
        ],
      },
      // Long-cache static illustrations served from /public — they don't change
      // between deploys (filename + Vercel asset versioning takes care of busting).
      {
        source: "/illustrations/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      // KU STEAM TEAM sign-in: the callback URL carries a one-time code, so
      // nothing here is cached and no referrer leaves these pages. Listed
      // after the site-wide rule, so this Referrer-Policy wins.
      {
        source: "/auth/team/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Cache-Control", value: "no-store" },
        ],
      },
      // /api/health is for uptime monitors — never cache.
      {
        source: "/api/health",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, max-age=0",
          },
        ],
      },
    ]
  },
}

export default nextConfig
