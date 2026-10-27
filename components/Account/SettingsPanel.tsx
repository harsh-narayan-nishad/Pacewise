"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useReadingDispatch, useReadingState } from "@/contexts/ReadingContext";
import { WPM_PRESETS } from "@/lib/wpmCalculator";
import { FontSettings } from "@/types";

const THEMES: FontSettings["brightness"][] = ["dark", "light", "sepia"];
const FAMILIES: FontSettings["family"][] = ["serif", "sans", "mono"];
const label = (v: string) => v[0].toUpperCase() + v.slice(1);

/** Theme / font / speed preferences. Shared by /settings and the profile tab. */
export function SettingsPanel() {
  const state = useReadingState();
  const dispatch = useReadingDispatch();
  const { fonts } = state;

  return (
      <div className="space-y-5">
        <Card>
          <div className="mb-3 text-sm text-ink-muted">Theme</div>
          <div className="flex flex-wrap gap-2">
            {THEMES.map((t) => (
              <Button key={t} size="sm" variant={fonts.brightness === t ? "primary" : "outline"} onClick={() => dispatch({ type: "UPDATE_FONTS", fonts: { brightness: t } })}>
                {label(t)}
              </Button>
            ))}
          </div>
        </Card>
        <Card>
          <div className="mb-3 text-sm text-ink-muted">Reading font</div>
          <div className="flex flex-wrap gap-2">
            {FAMILIES.map((f) => (
              <Button key={f} size="sm" variant={fonts.family === f ? "primary" : "outline"} onClick={() => dispatch({ type: "UPDATE_FONTS", fonts: { family: f } })}>
                {label(f)}
              </Button>
            ))}
          </div>
        </Card>
        <Card>
          <div className="mb-3 text-sm text-ink-muted">Reading speed</div>
          <div className="flex flex-wrap gap-2">
            {WPM_PRESETS.map((p) => (
              <Button key={p} size="sm" variant={state.selectedWpm === p ? "primary" : "outline"} onClick={() => dispatch({ type: "SET_WPM", wpm: p })}>
                {p} wpm
              </Button>
            ))}
          </div>
        </Card>
      </div>
  );
}
