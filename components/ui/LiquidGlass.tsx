"use client";

import React from "react";
import GlassSurface from "@/components/ui/GlassSurface";
import { cn } from "@/lib/utils";

interface LiquidGlassProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
  /** Corner radius in px (the glass layer and the clip use the same value). */
  radius?: number;
  /** How much frost the glass layer has; the navbar uses 0.55. */
  frost?: number;
}

/**
 * The navbar's liquid-glass surface as a reusable wrapper: a GlassSurface layer sits behind the
 * children, so any container can have the same effect without re-implementing it.
 */
export function LiquidGlass({ radius = 22, frost = 0.35, className, style, children, ...rest }: LiquidGlassProps) {
  return (
    <div className={cn("relative isolate overflow-hidden", className)} style={{ borderRadius: radius, ...style }} {...rest}>
      <div aria-hidden className="absolute inset-0 -z-10">
        <GlassSurface width="100%" height="100%" borderRadius={radius} backgroundOpacity={frost} blur={11} showEdgeHighlight={false} />
      </div>
      {children}
    </div>
  );
}
