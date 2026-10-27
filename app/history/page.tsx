"use client";

import React from "react";
import { TestAttemptsPanel } from "@/components/Account/TestAttemptsPanel";

/** Past Test Attempts page; the list itself lives in TestAttemptsPanel (also used inside the profile). */
export default function HistoryPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <TestAttemptsPanel />
    </div>
  );
}
