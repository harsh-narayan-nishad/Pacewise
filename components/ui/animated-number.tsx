"use client";

import React, { useEffect, useRef } from "react";
import { useMotionValue, useTransform, animate, motion } from "framer-motion";

interface AnimatedNumberProps {
  value: number;
  decimals?: number;
  suffix?: string;
  className?: string;
}

/**
 * Springs from the previous displayed value to the next one instead of
 * snapping, so a ticking stat (like the live WPM-reduction percentage)
 * reads as a smooth Apple-style counter rather than a jittery label.
 * Kept as its own primitive since both the pause hint and the final
 * efficiency report animate numbers.
 */
export function AnimatedNumber({ value, decimals = 0, suffix = "", className }: AnimatedNumberProps) {
  const motionValue = useMotionValue(value);
  const rounded = useTransform(motionValue, (v) => `${v.toFixed(decimals)}${suffix}`);
  const prevValue = useRef(value);

  useEffect(() => {
    if (prevValue.current === value) return;
    prevValue.current = value;
    const controls = animate(motionValue, value, { duration: 0.5, ease: "easeOut" });
    return controls.stop;
  }, [value, motionValue]);

  return <motion.span className={className}>{rounded}</motion.span>;
}
