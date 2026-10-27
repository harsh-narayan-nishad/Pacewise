"use client";

import React from "react";
import { PageShell } from "@/components/ui/PageShell";
import { ReadingHistoryPanel } from "@/components/Account/ReadingHistoryPanel";

export default function ReadingHistoryPage() {
  return (
    <PageShell title="Reading history" subtitle="Every story you've read, newest first.">
      <ReadingHistoryPanel />
    </PageShell>
  );
}
