"use client";

import { useEffect, useState } from "react";
import type { Photo } from "@/lib/gallery";

export default function GalleryGrid({ photos }: { photos: Photo[] }) {
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    if (open === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowRight") setOpen((i) => (i === null ? i : (i + 1) % photos.length));
      if (e.key === "ArrowLeft")
        setOpen((i) => (i === null ? i : (i - 1 + photos.length) % photos.length));
    }
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, photos.length]);

  const current = open === null ? null : photos[open];

  return (
    <>
      <div className="gallery">
        {photos.map((p, i) => (
          <button
            key={p.src}
            type="button"
            className="gallery-item"
            onClick={() => setOpen(i)}
            aria-label={p.caption ? `Open ${p.caption}` : "Open photo"}
          >
            <img src={p.src} alt={p.caption} loading="lazy" />
            {p.caption && <span className="gallery-caption">{p.caption}</span>}
          </button>
        ))}
      </div>

      {current && (
        <div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={current.caption || "Photo"}
          onClick={() => setOpen(null)}
        >
          <figure onClick={(e) => e.stopPropagation()}>
            <img src={current.src} alt={current.caption} />
            {current.caption && <figcaption>{current.caption}</figcaption>}
          </figure>
          <button type="button" className="lightbox-close" aria-label="Close" onClick={() => setOpen(null)}>
            ×
          </button>
        </div>
      )}
    </>
  );
}
