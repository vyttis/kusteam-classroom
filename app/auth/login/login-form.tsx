"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"
import { SteamLogo } from "@/components/steam-logo"
import { useToast } from "@/hooks/use-toast"
import { motion, AnimatePresence } from "framer-motion"
import { Mail, KeyRound, ArrowRight, ArrowLeft, Loader2 } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { PrivacyLink } from "@/components/privacy-link"

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 001 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  )
}

const OTP_MIN = 6
const OTP_MAX = 10

const NO_ACCOUNT =
  "Šiuo el. paštu vedėjo paskyros nėra. Paskyros prašymą galite pateikti veiklos pabaigoje arba per nuorodą, kurią gausite iš KU STEAM centro (steam@ku.lt)."

export function LoginForm() {
  const [email, setEmail] = useState("")
  const [otp, setOtp] = useState("")
  const [step, setStep] = useState<"email" | "otp">("email")
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const { toast } = useToast()
  const searchParams = useSearchParams()

  useEffect(() => {
    const error = searchParams.get("error")
    if (error) {
      const friendlyMessages: Record<string, string> = {
        auth_failed: "Bandykite dar kartą arba naudokite kitą prisijungimo būdą.",
        pkce_mismatch:
          "Prisijungimas nutrūko tarp skirtingų adresų. Bandykite dar kartą šiame puslapyje. Jei klaida kartojasi, praneškite administratoriui.",
        access_denied: "Prisijungimas atšauktas. Bandykite dar kartą.",
      }
      // Sign-up is closed: an unknown Google account comes back with a
      // "Signups not allowed" error from Supabase.
      const description = /signups? not allowed|not allowed for/i.test(error)
        ? NO_ACCOUNT
        : friendlyMessages[error] ?? error
      toast({
        title: "Prisijungimas nepavyko",
        description,
        variant: "destructive",
      })
    }
  }, [searchParams, toast])

  async function handleGoogleLogin() {
    setGoogleLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) {
      setGoogleLoading(false)
      toast({
        title: "Klaida",
        description: "Nepavyko prisijungti su Google. Bandykite dar kartą.",
        variant: "destructive",
      })
    }
  }

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return

    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // Accounts are created only by the super admin's approval.
        shouldCreateUser: false,
      },
    })
    setLoading(false)

    if (error) {
      const noAccount =
        error.code === "otp_disabled" || /signups? not allowed|user not found/i.test(error.message)
      toast({
        title: noAccount ? "Paskyros nėra" : "Klaida",
        description: noAccount ? NO_ACCOUNT : "Nepavyko išsiųsti kodo. Bandykite dar kartą.",
        variant: "destructive",
      })
      return
    }

    setStep("otp")
    toast({
      title: "Kodas išsiųstas!",
      description: "Patikrinkite savo el. pašto dėžutę.",
    })
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault()
    if (!otp) return

    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: "email",
    })
    setLoading(false)

    if (error) {
      toast({
        title: "Neteisingas kodas",
        description: "Patikrinkite kodą ir bandykite dar kartą.",
        variant: "destructive",
      })
      return
    }

    // Redirect to dashboard after successful login
    window.location.href = "/dashboard"
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-white via-white to-primary/5">
      {/* Background decorative elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-secondary/5 rounded-full blur-3xl" />
        <div className="absolute top-1/4 left-1/4 w-60 h-60 bg-highlight/5 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative z-10"
      >
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <SteamLogo size="large" />
        </div>

        <Card className="border-0 shadow-2xl shadow-primary/10 bg-white/80 backdrop-blur-xl">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-4 w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center">
              <Image src="/illustrations/hero-hacker.svg" alt="" width={56} height={56} />
            </div>
            <h1 className="text-2xl font-bold leading-none tracking-tight text-steam-dark">
              {step === "email" ? "Prisijungimas" : "Patvirtinkite kodą"}
            </h1>
            <CardDescription className="text-muted-foreground">
              {step === "email"
                ? "Prisijunkite su Google arba el. paštu"
                : `Kodas išsiųstas adresu ${email}`}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <AnimatePresence mode="wait">
              {step === "email" ? (
                <motion.div
                  key="email-form"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-4"
                >
                  {/* Google OAuth Button */}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleGoogleLogin}
                    disabled={googleLoading}
                    className="w-full h-12 border-border/60 bg-white hover:bg-muted/50 text-steam-dark font-medium text-base gap-3 transition-all"
                  >
                    {googleLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        <GoogleIcon className="h-5 w-5" />
                        Prisijungti su Google
                      </>
                    )}
                  </Button>

                  {/* Separator */}
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border/50" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-white px-3 text-muted-foreground">
                        arba
                      </span>
                    </div>
                  </div>

                  {/* Email OTP Form */}
                  <form onSubmit={handleSendOtp} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-steam-dark font-medium">
                        El. paštas
                      </Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="email"
                          type="email"
                          placeholder="vardas@mokykla.lt"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="pl-10 h-12 bg-white border-border/50 focus:border-primary focus:ring-primary/20"
                          required
                        />
                      </div>
                    </div>

                    <Button
                      type="submit"
                      disabled={loading || !email}
                      className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-base shadow-lg shadow-primary/25 transition-all hover:shadow-xl hover:shadow-primary/30"
                    >
                      {loading ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <>
                          Gauti prisijungimo kodą
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </form>
                </motion.div>
              ) : (
                <motion.form
                  key="otp-form"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  onSubmit={handleVerifyOtp}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label htmlFor="otp" className="text-steam-dark font-medium">
                      Patvirtinimo kodas
                    </Label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="otp"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        placeholder="12345678"
                        value={otp}
                        // Supabase sends 6 to 10 digits (the project uses 8).
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, OTP_MAX))}
                        className="pl-10 h-12 text-center text-2xl tracking-[0.35em] font-mono bg-white border-border/50 focus:border-primary focus:ring-primary/20"
                        maxLength={OTP_MAX}
                        required
                        autoFocus
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading || otp.length < OTP_MIN}
                    className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-base shadow-lg shadow-primary/25 transition-all hover:shadow-xl hover:shadow-primary/30"
                  >
                    {loading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        Patvirtinti
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setStep("email")
                      setOtp("")
                    }}
                    className="w-full text-muted-foreground hover:text-steam-dark"
                  >
                    Grįžti atgal
                  </Button>
                </motion.form>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>

        <div className="flex flex-col items-center gap-3 mt-6">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-steam-dark">
              <ArrowLeft className="h-4 w-4" />
              Grįžti į titulinį
            </Button>
          </Link>
          <p className="text-xs text-muted-foreground">
            STEAM LT Klaipėda &middot; Klaipėdos universitetas &middot; <PrivacyLink />
          </p>
        </div>
      </motion.div>
    </main>
  )
}
