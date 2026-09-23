"use client";

import { useState } from "react";

export default function EntryBullets({ bullets }: { bullets: string[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="entry-details">
      <button
        type="button"
        className="entry-toggle"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <svg
          className={`entry-chevron${open ? " open" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
        {open ? "Hide details" : "Show details"}
      </button>
      <div className={`entry-bullets-wrap${open ? " open" : ""}`}>
        <div className="entry-bullets-clip">
          <ul className="entry-bullets">
            {bullets.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
