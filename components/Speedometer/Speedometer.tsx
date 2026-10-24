"use client";

import React from "react";
import CometDial from "@/components/Speedometer/CometDial";
import { SPEED_BAND_COLOR, speedBand } from "@/lib/wpmCalculator";

interface SpeedometerProps {
  wpm: number;
  max?: number;
  size?: number;
}

/**
 * Design refresh of the live reading-speed gauge — same call site, same
 * props, same job (a glance-able instrument next to the story, driven by
 * `wpm`), new look: CometDial's comet-trail arc with a glowing "pin" head
 * marking the current value, instead of the old plain needle+ring.
 *
 * CometDial is normally an interactive drag control, but here it's used
 * read-only (`disabled`, no `onChange`): `value={wpm}` drives it exactly
 * like the old gauge's `animate={{ strokeDashoffset }}` did — CometDial's
 * own controlled-`value` effect springs the dial toward whatever `wpm`
 * becomes next, picking up the comet-trail/velocity visuals "for free"
 * from faster WPM changes without this component needing to compute them
 * itself. `disabled` only turns off pointer/keyboard dragging — the
 * spring animation and comet trail stay fully live.
 *
 * The band color (slow/medium/fast/extreme — see wpmCalculator.ts) still
 * drives the dial's accent and the pin, exactly as before, just applied
 * to CometDial's `accent` prop instead of a hand-rolled SVG stroke.
 */
export function Speedometer({ wpm, max = 1000, size = 152 }: SpeedometerProps) {
  const band = speedBand(wpm);
  const color = SPEED_BAND_COLOR[band];
  const thickness = Math.max(3, Math.round(size / 36));

  return (
    <div className="flex flex-col items-center gap-2">
      <CometDial
        value={Math.round(wpm)}
        min={0}
        max={max}
        step={1}
        unit="wpm"
        label="Reading speed"
        accent={color}
        ink="rgb(var(--ink))"
        size={size}
        sweep={280}
        thickness={thickness}
        speed={35}
        cometReach={Math.round(size * 0.55)}
        cometWidth={thickness * 2}
        disabled
      />
      <span className="text-[10px] uppercase tracking-wider" style={{ color }}>
        {band}
      </span>
    </div>
  );
}
