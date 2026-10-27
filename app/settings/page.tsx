"use client";

import React from "react";
import { PageShell } from "@/components/ui/PageShell";
import { SettingsPanel } from "@/components/Account/SettingsPanel";

export default function SettingsPage() {
  return (
    <PageShell title="Settings" subtitle="Applies everywhere in the app.">
      <SettingsPanel />
    </PageShell>
  );
}
