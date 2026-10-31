"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  ChevronUp,
  ChevronDown,
  Settings2,
  Eye,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { WPM_PRESETS } from "@/lib/wpmCalculator";
import { FontSettings } from "@/types";
import { useReadingDispatch, useReadingState } from "@/contexts/ReadingContext";
import GlassSurface from "@/components/ui/GlassSurface";

interface ControlsProps {
  isPlaying: boolean;
  wpm: number;
  fonts: FontSettings;
  onPlayPause: () => void;
  onRestart: () => void;
  onSkip: () => void;
  /** Omit to lock the speed: it is chosen on the story page before reading starts. */
  onSpeedChange?: (wpm: number) => void;
  onFontsChange: (fonts: Partial<FontSettings>) => void;
}

/**
 * A single bottom "dock" that expands into a customization panel, rather
 * than many permanently-visible toolbars — matches the "no unnecessary UI"
 * requirement for the reading screen while still exposing every control.
 *
 * The panel's open/closed state now lives in the shared reducer
 * (`settingsPanelOpen`) instead of local component state, so the gear icon
 * here and the Settings button in TopNav both drive the same panel rather
 * than each owning a disconnected copy of "is it open."
 */
export function Controls({
  isPlaying,
  wpm,
  fonts,
  onPlayPause,
  onRestart,
  onSkip,
  onSpeedChange,
  onFontsChange,
}: ControlsProps) {
  const state = useReadingState();
  const dispatch = useReadingDispatch();
  const panelOpen = state.settingsPanelOpen;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-20 flex flex-col items-center gap-3 px-4 pb-5 sm:px-8">
      <AnimatePresence>
        {panelOpen && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-overlay/10 p-5 shadow-themed"
          >
            {/* Restored glass treatment, same full-bleed-layer-behind-content
                pattern as TopNav (GlassSurface's own root is overflow-hidden,
                so it's rendered behind the content rather than wrapping it,
                to avoid clipping anything). */}
            <div className="absolute inset-0 -z-10">
              <GlassSurface width="100%" height="100%" borderRadius={16} backgroundOpacity={0.55} blur={11} />
            </div>
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm font-medium text-ink">Reading customization</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => dispatch({ type: "RESET_FONTS_TO_DEFAULT" })}
              >
                <Undo2 className="h-3.5 w-3.5" /> Reset to default
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Slider label="Font size" value={fonts.size} min={16} max={48} unit="px" onChange={(v) => onFontsChange({ size: v })} />
              <Slider label="Line height" value={Math.round(fonts.lineHeight * 10) / 10} min={1.2} max={2.6} step={0.1} onChange={(v) => onFontsChange({ lineHeight: v })} />
              <Slider label="Letter spacing" value={fonts.letterSpacing} min={-1} max={4} step={0.5} unit="px" onChange={(v) => onFontsChange({ letterSpacing: v })} />
              <Slider label="Content width" value={fonts.contentWidth} min={30} max={90} unit="vw" onChange={(v) => onFontsChange({ contentWidth: v })} />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {(["serif", "sans", "mono"] as const).map((f) => (
                <Button key={f} size="sm" variant={fonts.family === f ? "primary" : "outline"} onClick={() => onFontsChange({ family: f })}>
                  {f}
                </Button>
              ))}
              <div className="mx-1 w-px bg-overlay/10" />
              {(["dark", "light", "sepia"] as const).map((b) => (
                <Button key={b} size="sm" variant={fonts.brightness === b ? "primary" : "outline"} onClick={() => onFontsChange({ brightness: b })}>
                  {b}
                </Button>
              ))}
              <div className="mx-1 w-px bg-overlay/10" />
              <Button size="sm" variant={fonts.focusMode ? "primary" : "outline"} onClick={() => onFontsChange({ focusMode: !fonts.focusMode })}>
                <Eye className="h-3.5 w-3.5" /> Focus
              </Button>
              <Button size="sm" variant={fonts.guideLine ? "primary" : "outline"} onClick={() => onFontsChange({ guideLine: !fonts.guideLine })}>
                Guide line
              </Button>
            </div>

            {onSpeedChange ? (
            <div className="mt-4">
              <div className="mb-1.5 text-xs text-ink-muted">Preset speeds (wpm)</div>
              <div className="flex flex-wrap gap-1.5">
                {WPM_PRESETS.map((p) => (
                  <Button key={p} size="sm" variant={wpm === p ? "primary" : "outline"} onClick={() => onSpeedChange(p)}>
                    {p}
                  </Button>
                ))}
                <input
                  type="number"
                  value={wpm}
                  onChange={(e) => onSpeedChange(Number(e.target.value) || 0)}
                  className="h-8 w-20 rounded-full border border-overlay/15 bg-transparent px-3 text-center text-sm text-ink"
                  aria-label="Custom WPM"
                />
              </div>
            </div>
            ) : (
              <p className="mt-4 text-xs text-ink-muted">Reading speed: {wpm} wpm, set before you started.</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative flex items-center gap-2 overflow-hidden rounded-full border border-overlay/10 px-3 py-2 shadow-themed">
        <div className="absolute inset-0 -z-10">
          <GlassSurface width="100%" height="100%" borderRadius={999} backgroundOpacity={0.55} blur={11} />
        </div>
        {onSpeedChange && (
          <Button size="icon" variant="ghost" onClick={() => onSpeedChange(wpm - 25)} aria-label="Decrease speed">
            <ChevronDown className="h-4 w-4" />
          </Button>
        )}
        <Button size="icon" variant="ghost" onClick={onRestart} aria-label="Restart">
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Button size="icon" onClick={onPlayPause} aria-label={isPlaying ? "Pause" : "Play"} className="h-12 w-12">
          {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
        </Button>
        <Button size="icon" variant="ghost" onClick={onSkip} aria-label="Skip to questions">
          <SkipForward className="h-4 w-4" />
        </Button>
        {onSpeedChange && (
          <Button size="icon" variant="ghost" onClick={() => onSpeedChange(wpm + 25)} aria-label="Increase speed">
            <ChevronUp className="h-4 w-4" />
          </Button>
        )}
        <div className="mx-1 h-6 w-px bg-overlay/10" />
        <Button
          size="icon"
          variant={panelOpen ? "primary" : "ghost"}
          onClick={() => dispatch({ type: "TOGGLE_SETTINGS_PANEL" })}
          aria-label="Customize"
        >
          <Settings2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
