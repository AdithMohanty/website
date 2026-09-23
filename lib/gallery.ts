import fs from "node:fs";
import path from "node:path";

// Images in public/gallery/, newest filename first. Caption comes from the
// filename: 2026-08-golden-gate.jpg -> "Golden gate".
const GALLERY_DIR = path.join(process.cwd(), "public", "gallery");
const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif)$/i;

export type Photo = {
  src: string;
  caption: string;
};

function captionFromFile(file: string) {
  const base = file
    .replace(IMAGE_EXT, "")
    .replace(/^\d{4}-\d{2}(-\d{2})?[-_ ]*/, "")
    .replace(/[-_]+/g, " ")
    .trim();
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : "";
}

export function getPhotos(): Photo[] {
  if (!fs.existsSync(GALLERY_DIR)) return [];
  return fs
    .readdirSync(GALLERY_DIR)
    .filter((f) => IMAGE_EXT.test(f))
    .sort((a, b) => b.localeCompare(a))
    .map((f) => ({
      src: `/gallery/${encodeURIComponent(f)}`,
      caption: captionFromFile(f),
    }));
}
