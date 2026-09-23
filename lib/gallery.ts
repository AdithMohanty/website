import { listPhotos } from "./photos";

// What the gallery page shows for each photo.
export type GalleryPhoto = {
  src: string;
  width?: number;
  height?: number;
  place: string;
  date: string;
};

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
