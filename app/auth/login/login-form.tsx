"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"
import { SteamLogo } from "@/components/steam-logo"
import { SteamRays } from "@/components/brand/steam-rays"
import { useToast } from "@/hooks/use-toast"
import { motion, AnimatePresence } from "framer-motion"
import { Mail, KeyRound, Lock, ArrowRight, ArrowLeft, Loader2 } from "lucide-react"
import Link from "next/link"
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
  const [password, setPassword] = useState("")
  const [otp, setOtp] = useState("")
  const [step, setStep] = useState<"email" | "otp">("email")
  // Why a code was asked for: to sign in without a password, or to set a new one.
  const [purpose, setPurpose] = useState<"signin" | "reset">("signin")
  const [resendIn, setResendIn] = useState(0)
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

  useEffect(() => {
    if (resendIn <= 0) return
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [resendIn])

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password) return
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setLoading(false)
      // One message for a wrong password, an unknown address and an account
      // that has no password yet: the form does not reveal which it is.
      toast({
        title: "Prisijungti nepavyko",
        description:
          "Neteisingas el. paštas arba slaptažodis. Jei slaptažodžio dar nesusikūrėte arba jį pamiršote, spauskite „Pamiršau slaptažodį“: atsiųsime kodą el. paštu.",
        variant: "destructive",
      })
      return
    }
    window.location.href = "/dashboard"
  }

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

  async function sendCode(why: "signin" | "reset") {
    if (!email) {
      toast({ title: "Įrašykite el. paštą", description: "Kodą siunčiame jūsų paskyros el. pašto adresu." })
      document.getElementById("email")?.focus()
      return
    }
    setPurpose(why)

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
    setResendIn(60)
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
        title: "Kodas netinka",
        description: "Kodas neteisingas arba nebegalioja. Patikrinkite jį arba paprašykite naujo.",
        variant: "destructive",
      })
      return
    }

    // After "Pamiršau slaptažodį" the facilitator sets a new password first.
    window.location.href = purpose === "reset" ? "/slaptazodis?pamirsau=1" : "/dashboard"
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted px-4 py-10">
      <div className="w-full max-w-md">
        {/* The rays draw once: the one deliberate motion of this screen.
            Next to the large ray element the logo is the wordmark alone. */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <SteamRays draw className="h-32 w-32" />
          <SteamLogo size="large" symbol={false} />
        </div>

        <Card className="rounded-2xl border-0 bg-white shadow-sm">
          <CardHeader className="space-y-2 pb-4 text-center">
            <h1 className="text-[1.75rem] font-bold leading-tight tracking-tight text-steam-dark">
              {step === "email" ? "Prisijungimas" : "Patvirtinkite kodą"}
            </h1>
            <CardDescription className="text-sm leading-relaxed text-muted-foreground">
              {step === "email"
                ? "Prisijunkite el. paštu ir slaptažodžiu arba su Google"
                : purpose === "reset"
                  ? `Kodą išsiuntėme adresu ${email}. Jį patvirtinę susikursite naują slaptažodį.`
                  : `Kodas išsiųstas adresu ${email}`}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <div className="mb-6 space-y-2 rounded-xl bg-muted p-4 text-sm leading-relaxed text-foreground">
              <p>Mokytojui reikia KU STEAM centro patvirtintos CLASSROOM paskyros. Prisijungimas naujos paskyros nesukuria. Dėl prieigos rašykite <a href="mailto:steam@ku.lt" className="font-semibold underline underline-offset-4">steam@ku.lt</a>.</p>
              <p>KU STEAM darbuotojams: <a href="https://komanda.kusteam.app" className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4">prisijungti per TEAM</a>.</p>
            </div>
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
                    className="h-12 w-full gap-3 bg-white text-base text-steam-dark"
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
                      <span className="w-full border-t border-border" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-white px-3 font-semibold tracking-wide text-muted-foreground">
                        arba
                      </span>
                    </div>
                  </div>

                  {/* Email OTP Form */}
                  <form onSubmit={handlePasswordLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email" className="font-semibold text-steam-dark">
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
                          autoComplete="username"
                          className="h-12 bg-white pl-10 text-base md:text-base"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="password" className="font-semibold text-steam-dark">
                        Slaptažodis
                      </Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="password"
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          autoComplete="current-password"
                          className="h-12 bg-white pl-10 text-base md:text-base"
                          required
                        />
                      </div>
                    </div>

                    <Button
                      type="submit"
                      disabled={loading || !email || !password}
                      size="lg"
                    className="w-full"
                    >
                      {loading ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <>
                          Prisijungti
                          <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        </>
                      )}
                    </Button>
                  </form>

                  <div className="flex flex-col items-center gap-1 text-sm">
                    <button
                      type="button"
                      onClick={() => sendCode("reset")}
                      disabled={loading}
                      className="inline-flex min-h-11 items-center font-semibold text-steam-dark underline underline-offset-4"
                    >
                      Pamiršau slaptažodį
                    </button>
                    <button
                      type="button"
                      onClick={() => sendCode("signin")}
                      disabled={loading}
                      className="inline-flex min-h-11 items-center font-semibold text-steam-dark underline underline-offset-4"
                    >
                      Prisijungti su kodu iš laiško
                    </button>
                  </div>
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
                    <Label htmlFor="otp" className="font-semibold text-steam-dark">
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
                        className="h-12 bg-white pl-10 text-center font-mono text-2xl tracking-[0.35em]"
                        maxLength={OTP_MAX}
                        required
                        autoFocus
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading || otp.length < OTP_MIN}
                    size="lg"
                    className="w-full"
                  >
                    {loading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        Patvirtinti
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </>
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => sendCode(purpose)}
                    disabled={loading || resendIn > 0}
                    className="w-full"
                  >
                    {resendIn > 0 ? `Siųsti kodą dar kartą (po ${resendIn} s)` : "Siųsti kodą dar kartą"}
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setStep("email")
                      setOtp("")
                    }}
                    className="w-full text-steam-dark"
                  >
                    Grįžti atgal
                  </Button>
                </motion.form>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>

        <div className="flex flex-col items-center gap-3 mt-6">
          <Button asChild variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-steam-dark">
            <Link href="/">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Grįžti į titulinį
            </Link>
          </Button>
          <a href="https://kusteam.app/veiklos" className="inline-flex min-h-11 items-center text-sm font-medium text-steam-dark underline underline-offset-4">Grįžti į veiklų katalogą</a>
          <p className="text-xs text-muted-foreground">
            STEAM LT Klaipėda &middot; Klaipėdos universitetas &middot; <PrivacyLink />
          </p>
        </div>
      </div>
    </main>
  )
}
