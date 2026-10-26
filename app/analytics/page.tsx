"use client";

import React, { useEffect, useState } from "react";
import { Analytics } from "@/components/Analytics/Analytics";
import { PageShell } from "@/components/ui/PageShell";
import { storage } from "@/lib/storage";
import { ReadingHistoryEntry } from "@/types";

export default function AnalyticsPage() {
  const [history, setHistory] = useState<ReadingHistoryEntry[]>([]);
  useEffect(() => setHistory(storage.getHistory()), []);
  return (
    <PageShell title="Analytics" subtitle="How your speed and comprehension are trending.">
      <Analytics history={history} />
    </PageShell>
  );
}
