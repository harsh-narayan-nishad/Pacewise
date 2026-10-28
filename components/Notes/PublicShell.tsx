"use client";

import React from "react";
import Link from "next/link";
import GlassSurface from "@/components/ui/GlassSurface";
import { ThemeSwitch } from "@/components/Navigation/ThemeSwitch";
import { PublicMenu } from "@/components/Notes/PublicMenu";
import { BRAND_NAME } from "@/lib/brand";

/**
 * Frame for the public notes pages: the landing page's glass navbar (hamburger and name on the left,
 * theme switch on the right; no account, notifications or search because nobody is signed in), then the content.
 */
export function PublicShell({ userId, children }: { userId: string; children: React.ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-[100] overflow-visible border-b border-overlay/10 shadow-themed">
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
      </header>
      <div className="mx-auto w-full max-w-4xl px-4 pb-24 pt-10 sm:px-6 sm:pt-14">{children}</div>
    </>
  );
}
