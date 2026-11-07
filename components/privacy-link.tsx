import Link from "next/link"

/** Link to the privacy notice, used on entry screens and consent forms. */
export function PrivacyLink({ className = "" }: { className?: string }) {
  return (
    <Link href="/privatumas" className={`underline underline-offset-2 hover:text-steam-dark ${className}`}>
      Privatumo pranešimas
    </Link>
  )
}
