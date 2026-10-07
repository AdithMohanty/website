"use client";

import { useSyncExternalStore } from "react";

const COLORS = ["#ff5f5f", "#ffe066", "#5fa8ff"];

// Arcs in rainbow colors when on, plain outline when off.
function RainbowIcon({ on }: { on: boolean }) {
  const arcs = [9, 6.5, 4];
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true">
      {arcs.map((r, i) => (
        <path
          key={r}
          d={`M${12 - r} 17a${r} ${r} 0 0 1 ${r * 2} 0`}
          stroke={on ? COLORS[i] : "currentColor"}
        />
      ))}
    </svg>
  );
}

function subscribe(onChange: () => void) {
  window.addEventListener("rainbowchange", onChange);
  return () => window.removeEventListener("rainbowchange", onChange);
}

// Turns the grid's cursor trail rainbow. The grid reads data-rainbow on <html>,
// which layout.tsx sets before paint. Kept in sessionStorage: it survives a
// reload but a new tab starts with it off.
export default function RainbowToggle() {
  // null during server render, so the button stays hidden until we know.
  const on = useSyncExternalStore(
    subscribe,
    () => document.documentElement.hasAttribute("data-rainbow"),
    () => null
  );

  const toggle = () => {
    const next = !on;
    document.documentElement.toggleAttribute("data-rainbow", next);
    window.dispatchEvent(new Event("rainbowchange"));
    try {
      sessionStorage.setItem("rainbow", next ? "on" : "off");
    } catch {}
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className="theme-toggle"
      aria-label={on ? "Turn off rainbow trail" : "Turn on rainbow trail"}
      aria-pressed={!!on}
      style={{ opacity: on === null ? 0 : 1 }}
    >
      <RainbowIcon on={!!on} />
    </button>
  );
}
