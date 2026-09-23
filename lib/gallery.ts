import { getValue } from "./store";

// Reading the gallery list only. Uploading lives in lib/photos.ts, which pulls
// in the image tools; keep those out of pages.

export const GALLERY_KEY = "gallery";

export type Photo = {
  id: string;
  src: string;
  width: number;
  height: number;
  date?: string; // YYYY-MM-DD, local time where it was taken
  place?: string;
  name?: string; // original filename, used to skip re-uploads
  addedAt: string;
};

// What the gallery page shows for each photo.
export type GalleryPhoto = {
  src: string;
  width?: number;
  height?: number;
  place: string;
  date: string;
};

export async function listPhotos(): Promise<Photo[]> {
  const photos = (await getValue<Photo[]>(GALLERY_KEY)) ?? [];
  return photos.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
}

function formatDate(date?: string) {
  if (!date) return "";
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export async function getPhotos(): Promise<GalleryPhoto[]> {
  return (await listPhotos()).map((p) => ({
    src: p.src,
    width: p.width,
    height: p.height,
    place: p.place ?? "",
    date: formatDate(p.date),
  }));
}
