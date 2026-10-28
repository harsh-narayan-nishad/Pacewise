import type { CSSProperties } from "react";

/** Shared look for chart hover cards so every tooltip in the app uses the same type and shape. */
export const CHART_TOOLTIP_STYLE: CSSProperties = {
  background: "rgb(var(--canvas-raised))",
  border: "1px solid rgb(var(--overlay) / 0.1)",
  borderRadius: 16,
  padding: "10px 14px",
  fontFamily: "inherit",
  fontSize: 13,
  lineHeight: 1.4,
  color: "rgb(var(--ink))",
  boxShadow: "0 10px 30px -12px rgb(var(--shadow-color) / 0.35)",
};
export const CHART_TOOLTIP_LABEL_STYLE: CSSProperties = { color: "rgb(var(--ink-muted))", fontWeight: 500, marginBottom: 2 };

/** Class names for custom (non-recharts) hover cards. */
export const HOVER_CARD_CLASS = "rounded-2xl border border-overlay/10 bg-canvas-raised px-3.5 py-2.5 text-[13px] leading-snug text-ink shadow-themed";
