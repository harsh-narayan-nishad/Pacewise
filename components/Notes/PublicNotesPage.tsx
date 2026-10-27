"use client";

import React from "react";
import Link from "next/link";
import { NotesView } from "@/components/Notes/NotesView";
import { BRAND_BLUE, BRAND_NAME } from "@/lib/brand";
import { devDataStore } from "@/lib/devData/store";

/** What the QR code opens: read-only notes, no sign-in, no app chrome. */
export function PublicNotesPage({ userId }: { userId: string }) {
  const owner = devDataStore.findUserById(userId);
  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-10 sm:px-6 sm:pt-14">
      <header className="mb-10 flex items-baseline justify-between gap-3">
        <Link href="/" className="font-display text-xl tracking-[-0.02em] text-ink">{BRAND_NAME}</Link>
        <span className="text-sm" style={{ color: BRAND_BLUE }}>Shared notes</span>
      </header>
      <h1 className="font-display text-4xl leading-tight tracking-[-0.03em] text-ink sm:text-5xl">Notes.</h1>
      <p className="mb-8 mt-2 text-ink-muted">
        How CN, OS, OOP and DBMS are used in {BRAND_NAME}, with the tradeoffs.{owner ? <> Shared by {owner.name}.</> : null}
      </p>
      <NotesView />
    </div>
  );
}
