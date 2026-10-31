"use client";

import React from "react";

/*
 * Twelve-tick spinner (the iOS look): one turn per second, ticks fading round the dial, Apple's system gray
 * (#8E8E93). It fades in over 200 ms when it appears. The same loader the docs Prev / Next buttons use.
 */
const CSS = `
.ts-box{position:relative;width:54px;height:54px;transform-origin:0 0;animation:ts-fade-in .2s ease-out both}
.ts-tick{position:absolute;left:46%;top:38%;width:8%;height:24%;border-radius:50px;background:rgb(142,142,147);opacity:0;animation:ts-fade 1s linear infinite}
@keyframes ts-fade{from{opacity:1}to{opacity:.2}}
@keyframes ts-fade-in{from{opacity:0}to{opacity:1}}
@media (prefers-reduced-motion:reduce){.ts-tick{animation:none;opacity:.6}}
`;

export function TickSpinner({ size = 54, label = "Loading" }: { size?: number; label?: string }) {
  return (
    <span role="status" aria-label={label} className="inline-block" style={{ width: size, height: size }}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <span className="ts-box block" aria-hidden style={{ transform: `scale(${size / 54})` }}>
        {Array.from({ length: 12 }, (_, i) => (
          <span key={i} className="ts-tick" style={{ transform: `rotate(${i * 30}deg) translate(0, -130%)`, animationDelay: i === 0 ? "0s" : `${-(1.2 - 0.1 * i).toFixed(1)}s` }} />
        ))}
      </span>
    </span>
  );
}

export default TickSpinner;
