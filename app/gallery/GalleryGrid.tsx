"use client";

import { useEffect, useState } from "react";
import type { GalleryPhoto as Photo } from "@/lib/gallery";

function Caption({ photo }: { photo: Photo }) {
  if (!photo.place && !photo.date) return null;
  return (
    <>
      {photo.place && <span className="photo-place">{photo.place}</span>}
      {photo.date && <span className="photo-date">{photo.date}</span>}
    </>
  );
}

const COLUMN_COUNTS = [1, 2, 3];

// Photos arrive newest first. Put each into the currently shortest column so
// the newest ones sit across the top instead of down the first column.
function toColumns(photos: Photo[], count: number) {
  const columns: number[][] = Array.from({ length: count }, () => []);
  const heights = new Array(count).fill(0);
  photos.forEach((p, i) => {
    const c = heights.indexOf(Math.min(...heights));
    columns[c].push(i);
    heights[c] += p.width && p.height ? p.height / p.width : 1;
  });
  return columns;
}

function label(photo: Photo) {
  return [photo.place, photo.date].filter(Boolean).join(", ") || "Photo";
}

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
      {/* One layout per column count; CSS shows the one that fits the screen. */}
      {COLUMN_COUNTS.map((n) => (
        <div key={n} className={`gallery gallery--${n}`}>
          {toColumns(photos, n).map((column, c) => (
            <div key={c} className="gallery-column">
              {column.map((i) => {
                const p = photos[i];
                return (
                  <button
                    key={p.src}
                    type="button"
                    className="gallery-item"
                    onClick={() => setOpen(i)}
                    aria-label={`Open photo: ${label(p)}`}
                  >
                    <img src={p.src} alt={label(p)} width={p.width} height={p.height} loading="lazy" />
                    {(p.place || p.date) && (
                      <span className="gallery-caption">
                        <Caption photo={p} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      ))}

      {current && (
        <div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={label(current)}
          onClick={() => setOpen(null)}
        >
          <figure onClick={(e) => e.stopPropagation()}>
            <img src={current.src} alt={label(current)} />
            {(current.place || current.date) && (
              <figcaption>
                <Caption photo={current} />
              </figcaption>
            )}
          </figure>
          <button type="button" className="lightbox-close" aria-label="Close" onClick={() => setOpen(null)}>
            ×
          </button>
        </div>
      )}
    </>
  );
}
