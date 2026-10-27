"use client";

import React, { useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";
import { qrMatrix } from "@/lib/qr";
import { notesUrl } from "@/lib/publicRoutes";

/**
 * This person's own QR code: it opens their public notes page (no login needed). The code is
 * built from the signed-in user's id, so every user — and every session — gets a different one.
 */
export function ProfileQr({ userId }: { userId: string }) {
  const [copied, setCopied] = useState(false);

  const url = useMemo(() => notesUrl(userId), [userId]);
  const matrix = useMemo(() => {
    if (!url) return null;
    try { return qrMatrix(url); } catch { return null; }
  }, [url]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch { /* clipboard blocked: the link stays visible to copy by hand */ }
  }

  if (!matrix) return null;
  const quiet = 2;
  const n = matrix.length + quiet * 2;
  return (
    <div className="flex flex-col items-end gap-2">
      <a href={url} target="_blank" rel="noreferrer" aria-label="Open your notes page (the QR code opens the same page)" className="block rounded-2xl bg-white p-2 shadow-themed">
        <svg viewBox={`0 0 ${n} ${n}`} className="h-28 w-28" shapeRendering="crispEdges" role="img" aria-label="QR code for your notes page">
          <rect width={n} height={n} fill="#fff" />
          {matrix.map((row, r) => row.map((dark, c) => dark ? <rect key={`${r}-${c}`} x={c + quiet} y={r + quiet} width={1} height={1} fill="#000" /> : null))}
        </svg>
      </a>
      <button type="button" onClick={copy} className="flex max-w-[11rem] items-center gap-1.5 text-xs text-ink-muted transition-colors hover:text-ink">
        {copied ? <Check className="h-3.5 w-3.5 shrink-0" /> : <Copy className="h-3.5 w-3.5 shrink-0" />}
        <span className="truncate">{copied ? "Link copied" : "Copy notes link"}</span>
      </button>
    </div>
  );
}
