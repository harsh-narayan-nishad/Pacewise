"use client";

import React from "react";
import { PageShell } from "@/components/ui/PageShell";
import { AnalyticsPanel } from "@/components/Account/AnalyticsPanel";

export default function AnalyticsPage() {
  return (
    <PageShell wide title="Analytics" subtitle="How your speed and comprehension are trending.">
      <AnalyticsPanel />
    </PageShell>
  );
}
