"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

interface AdminNavProps {
  superAdmin: boolean
  pendingTemplates: number
}

/** Sections of administration, with the current one marked (ADM-13). */
export function AdminNav({ superAdmin, pendingTemplates }: AdminNavProps) {
  const pathname = usePathname()
  const items = [
    { href: "/admin", label: "Apžvalga", exact: true },
    { href: "/admin/users", label: "Vartotojai" },
    { href: "/admin/veiklos", label: "Veiklos" },
    { href: "/admin/library", label: "Moderavimas", count: pendingTemplates },
    ...(superAdmin
      ? [
          { href: "/admin/prasymai", label: "Prašymai" },
          { href: "/admin/di", label: "DI" },
        ]
      : []),
  ] as { href: string; label: string; exact?: boolean; count?: number }[]

  return (
    <nav aria-label="Administravimas" className="mb-6 -mx-4 overflow-x-auto px-4">
      <ul className="flex w-max gap-1 border-b border-border/60">
        {items.map((item) => {
          const current = item.exact ? pathname === item.href : pathname.startsWith(item.href)
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                  current
                    ? "border-primary text-steam-dark"
                    : "border-transparent text-muted-foreground hover:text-steam-dark"
                }`}
              >
                {item.label}
                {item.count ? (
                  <span className="rounded-full bg-accent-ink px-1.5 text-xs font-semibold leading-5 text-white">
                    <span className="sr-only">laukia </span>
                    {item.count}
                  </span>
                ) : null}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
