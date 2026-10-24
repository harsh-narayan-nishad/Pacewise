"use client";
import { BRAND_NAME } from "@/lib/brand";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, LayoutDashboard, Share2, UserCircle } from "lucide-react";
import { useCurrentUser } from "@/lib/devData/useDevStore";

const LINK_COLUMNS: Array<{ title: string; links: Array<{ label: string; href: string }> }> = [
  {
    title: "Product",
    links: [
      { label: "Find a story", href: "/" },
      { label: "Dashboard", href: "/dashboard" },
      { label: "Analytics", href: "/results" },
      { label: "Past test attempts", href: "/history" },
    ],
  },
  {
    title: "Practice",
    links: [
      { label: "Reading mode", href: "/" },
      { label: "Speed practice", href: "/" },
      { label: "Quiz yourself", href: "/history" },
      { label: "Reading history", href: "/results" },
    ],
  },
  {
    title: "Community",
    links: [
      { label: "Your profile", href: "/dashboard" },
      { label: "Saved stories", href: "/dashboard" },
      { label: "Add your own story", href: "/" },
    ],
  },
];

/**
 * Footer: (link columns, round action icons, legal row, and a big faded wordmark
 * that fades into the accent colour at the very bottom).
 */
export function Footer() {
  const pathname = usePathname();
  const user = useCurrentUser();
  const [copied, setCopied] = React.useState(false);
  // /reader is a full-screen fixed experience: an in-flow footer would sit on top of it (it is the only content in the document flow there).
  if (pathname === "/questions" || pathname === "/reader") return null;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable: nothing to do */
    }
  }

  const round = "flex h-12 w-12 items-center justify-center rounded-full bg-overlay/[0.08] text-ink-muted transition-colors hover:bg-overlay/[0.14] hover:text-ink";

  return (
    <footer className="relative overflow-hidden border-t border-overlay/10 bg-canvas-raised transition-colors">
      <div className="mx-auto max-w-6xl px-6 pt-16 sm:px-8">
        <div className="grid grid-cols-2 gap-x-6 gap-y-12 md:grid-cols-4">
          {LINK_COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <div className="mb-6 text-sm text-ink-muted">{col.title}</div>
              <ul className="space-y-4">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link href={l.href} className="text-lg text-ink transition-colors hover:text-ink-muted">{l.label}</Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
          <div className="md:text-right">
            <div className="mb-6 text-sm text-ink-muted">Quick actions</div>
            <div className="flex gap-3 md:justify-end">
              <Link href="/dashboard" aria-label="Dashboard" title="Dashboard" className={round}><LayoutDashboard className="h-5 w-5" /></Link>
              {user && <Link href={`/profile/${user.id}`} aria-label="Your profile" title="Your profile" className={round}><UserCircle className="h-5 w-5" /></Link>}
              <button onClick={copyLink} aria-label={`Copy link to ${BRAND_NAME}`} title={copied ? "Link copied" : "Copy link"} className={round}>
                {copied ? <Check className="h-5 w-5" /> : <Share2 className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-24 flex flex-col gap-3 text-base text-ink-muted sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} {BRAND_NAME}. All rights reserved.</span>
          <span>Read faster. Revise smarter. Together.</span>
        </div>
      </div>

      {/* Big wordmark that melts into an accent gradient at the bottom edge. */}
      <div aria-hidden className="pointer-events-none relative mt-6 select-none">
        <div className="whitespace-nowrap text-center font-display text-[17vw] !font-black uppercase leading-[0.8] tracking-[-0.05em] text-ink/[0.07] sm:text-[15vw]">
          {BRAND_NAME}
        </div>
        <div className="absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-b from-transparent to-accent-slow/40" />
      </div>
    </footer>
  );
}
