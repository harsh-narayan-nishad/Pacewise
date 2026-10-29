"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { FileText } from "lucide-react";
import { NotesView } from "@/components/Notes/NotesView";
import { PublicShell } from "@/components/Notes/PublicShell";
import { BRAND_BLUE, BRAND_NAME } from "@/lib/brand";
import { devDataStore } from "@/lib/devData/store";
import { docFolders, docUrl } from "@/lib/docs/library";

/** What the QR code opens: read-only notes, then every document, no sign-in. */
export function PublicNotesPage({ userId }: { userId: string }) {
  // The owner's name comes from browser storage, which the server cannot see, so it is read after mount
  // (reading it during render made the server and browser HTML differ: a hydration error).
  const [owner, setOwner] = useState<{ name: string } | null>(null);
  useEffect(() => { setOwner(devDataStore.findUserById(userId) ?? null); }, [userId]);
  return (
    <PublicShell userId={userId}>
      <h1 className="font-display text-4xl leading-tight tracking-[-0.03em] text-ink sm:text-5xl">Notes.</h1>
      <p className="mb-8 mt-2 text-ink-muted">
        How CN, OS, OOP and DBMS are used in {BRAND_NAME}, with the tradeoffs.{owner ? <> Shared by {owner.name}.</> : null}
      </p>
      <NotesView />

      <h2 className="mb-2 mt-20 font-display text-3xl leading-tight tracking-[-0.03em] text-ink sm:text-5xl">Documents.</h2>
      <p className="mb-8 text-ink-muted">Every document of the project as a web page. Use the menu, or pick one below.</p>
      <div className="space-y-6">
        {docFolders().map((f) => (
          <section key={f.id || "root"} className="rounded-[32px] border border-overlay/10 bg-canvas-raised px-5 pb-5 pt-8 sm:px-10 sm:pt-10">
            <h3 className="font-display text-2xl leading-tight tracking-[-0.03em] text-ink sm:text-3xl">{f.label}</h3>
            <ul className="mt-4 divide-y divide-overlay/10">
              {f.docs.map((d) => (
                <li key={d.slug}>
                  <Link href={docUrl(userId, d.slug)} className="flex items-center gap-3 py-3.5 text-base text-ink transition-colors hover:opacity-70">
                    <FileText className="h-4 w-4 shrink-0 text-ink-muted" />
                    <span className="min-w-0 flex-1">{d.title}</span>
                    <span className="shrink-0 text-sm" style={{ color: BRAND_BLUE }}>Read</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </PublicShell>
  );
}
