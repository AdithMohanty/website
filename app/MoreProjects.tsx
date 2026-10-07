"use client";

import { useState, type ReactNode } from "react";

// The non-highlighted projects, collapsed behind a full-width button. They
// stay in the page (just inert) so search engines still see them.
export default function MoreProjects({ count, children }: { count: number; children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="more-projects">
      <div className={`entry-bullets-wrap${open ? " open" : ""}`}>
        <div className="entry-bullets-clip" inert={!open}>
          {children}
        </div>
      </div>
      <button
        type="button"
        className="more-projects-toggle"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? "Show fewer projects" : `Show ${count} more project${count === 1 ? "" : "s"}`}
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
      </button>
    </div>
  );
}
