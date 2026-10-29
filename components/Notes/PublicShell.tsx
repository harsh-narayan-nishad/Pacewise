"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import GlassSurface from "@/components/ui/GlassSurface";
import { ThemeSwitch } from "@/components/Navigation/ThemeSwitch";
import { DocSearch } from "@/components/Notes/DocSearch";
import { PublicMenu } from "@/components/Notes/PublicMenu";
import { BRAND_NAME } from "@/lib/brand";

/**
 * Frame for the public notes pages: the landing page's glass navbar (hamburger and name on the left,
 * theme switch on the right; no account, notifications or search because nobody is signed in), then the content.
 */
export function PublicShell({ userId, children, autoHideNav = false }: { userId: string; children: React.ReactNode; autoHideNav?: boolean }) {
  const [hidden, setHidden] = useState(false);
  // Document pages: the bar slides away while reading downward and returns on any upward scroll.
  useEffect(() => {
    if (!autoHideNav) return;
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (y < 64) setHidden(false);
      else if (y > last + 6) setHidden(true);
      else if (y < last - 6) setHidden(false);
      last = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [autoHideNav]);
  return (
    <>
      <header className={`sticky top-0 z-[95] overflow-visible border-b border-overlay/10 shadow-themed ${autoHideNav ? "transition-transform duration-300" : ""} ${hidden ? "-translate-y-full" : ""}`}>
        <div className="absolute inset-0 -z-10">
          <GlassSurface width="100%" height="100%" borderRadius={0} backgroundOpacity={0.55} blur={11} showEdgeHighlight={false} />
        </div>
        <div className="relative mx-auto flex h-14 w-full items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-4">
            <PublicMenu userId={userId} />
            <Link href={`/notes/${encodeURIComponent(userId)}`} aria-label={`${BRAND_NAME} notes`} className="rounded-lg transition-opacity hover:opacity-80">
              <span className="text-[13px] font-medium tracking-tight text-ink">{BRAND_NAME}</span>
            </Link>
          </div>
          <ThemeSwitch />
        </div>
        <div className="pointer-events-none absolute z-10 inset-x-0 top-0 flex h-14 items-center justify-center px-24 sm:px-40">
          <div className="pointer-events-auto"><DocSearch userId={userId} /></div>
        </div>
      </header>
      <div className="mx-auto w-full max-w-4xl px-4 pb-24 pt-10 sm:px-6 sm:pt-14">{children}</div>
    </>
  );
}
