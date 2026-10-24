"use client";

import React from "react";

interface Props {
  checked: boolean;
  onChange: (on: boolean) => void;
}

/** "Reading mode  Off / On" switch for the navbar. */
export function ReadingModeToggle({ checked, onChange }: Props) {
  return (
    <div className="sr-switch" title="Reading mode: scroll the story yourself instead of auto-scroll practice">
      <input id="reading-mode-switch" className="switch" type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <label htmlFor="reading-mode-switch">
        <span className="switch-x-text"><span className="hidden sm:inline">Reading mode</span><span className="sm:hidden">Read</span></span>
        <span className="switch-x-toggletext">
          <span className="switch-x-unchecked"><span className="switch-x-hiddenlabel">Unchecked: </span>Off</span>
          <span className="switch-x-checked"><span className="switch-x-hiddenlabel">Checked: </span>On</span>
        </span>
      </label>
    </div>
  );
}
