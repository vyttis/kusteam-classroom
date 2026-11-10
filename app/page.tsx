import {
  HeroSection,
  ForWhomSection,
  WhatYouCanDoSection,
  HowItWorksSection,
  AccessSection,
  AboutCreatorsSection,
  Footer,
} from "@/components/landing"

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <main>
        <HeroSection />
        <ForWhomSection />
        <WhatYouCanDoSection />
        <HowItWorksSection />
        <AccessSection />
        <AboutCreatorsSection />
      </main>
      <Footer />
    </div>
  )
}
