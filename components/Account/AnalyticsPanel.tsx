"use client";

import React, { useEffect, useState } from "react";
import { Analytics } from "@/components/Analytics/Analytics";
import { storage } from "@/lib/storage";
import { ReadingHistoryEntry } from "@/types";

/** Speed / comprehension trends. Shared by /analytics and the profile tab. */
export function AnalyticsPanel() {
  const [history, setHistory] = useState<ReadingHistoryEntry[]>([]);
  useEffect(() => setHistory(storage.getHistory()), []);
  return <Analytics history={history} />;
}
