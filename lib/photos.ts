import fs from "node:fs/promises";
import path from "node:path";
import { del, put } from "@vercel/blob";
import { env } from "./env";
import { GALLERY_KEY as KEY, type Photo } from "./gallery";
import { lookupPlace, placeName } from "./places.mjs";
import { getValue, setValue } from "./store";

// Photos live in Vercel Blob; the list of them (with place and date) in the
// same store as the location. Without a Blob token (local dev) images are
// written to public/uploads/ instead.

const MAX_SIZE = 2000;
const blobToken = () => env("BLOB_READ_WRITE_TOKEN");
const LOCAL_DIR = path.join(process.cwd(), "public", "uploads");

// "2024:07:31 13:53:52" (EXIF) or "2024-07-31T13:53:52-07:00" (Shortcuts) -> "2024-07-31"
function toDay(raw: unknown) {
  const m = typeof raw === "string" && raw.match(/^(\d{4})[:-](\d{2})[:-](\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : undefined;
}

function toNumber(v: unknown) {
  const n = typeof v === "string" && v.trim() ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : undefined;
}

type Hints = { date?: unknown; lat?: unknown; lon?: unknown; name?: unknown };

export async function addPhoto(input: Buffer, hints: Hints = {}): Promise<Photo> {
  // Loaded here, not at the top, so only uploads need the native image library.
  const [{ default: exifr }, { default: sharp }] = await Promise.all([
    import("exifr"),
    import("sharp"),
  ]);

  // Date and GPS: from the fields the sender passed, else from the photo itself.
  const exif = (await exifr
    .parse(input, { gps: true, reviveValues: false })
    .catch(() => null)) as Record<string, unknown> | null;
  const date = toDay(hints.date) ?? toDay(exif?.DateTimeOriginal ?? exif?.CreateDate);
  const lat = toNumber(hints.lat) ?? toNumber(exif?.latitude);
  const lon = toNumber(hints.lon) ?? toNumber(exif?.longitude);
  const place = lat !== undefined && lon !== undefined ? placeName(await lookupPlace(lat, lon)) : "";

  // .rotate() applies the EXIF orientation; sharp drops all metadata (GPS included).
  const { data, info } = await sharp(input)
    .rotate()
    .resize(MAX_SIZE, MAX_SIZE, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });

  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  let src: string;
  const token = blobToken();
  if (token) {
    const blob = await put(`gallery/${id}.jpg`, data, {
      access: "public",
      contentType: "image/jpeg",
      token,
    });
    src = blob.url;
  } else if (process.env.VERCEL) {
    throw new Error(
      "No BLOB_READ_WRITE_TOKEN found. In Vercel, connect the Blob store to this project " +
        "(including Production), then redeploy."
    );
  } else {
    await fs.mkdir(LOCAL_DIR, { recursive: true });
    await fs.writeFile(path.join(LOCAL_DIR, `${id}.jpg`), data);
    src = `/uploads/${id}.jpg`;
  }

  const photo: Photo = {
    id,
    src,
    width: info.width,
    height: info.height,
    date,
    place: place || undefined,
    name: typeof hints.name === "string" ? hints.name.slice(0, 200) : undefined,
    addedAt: new Date().toISOString(),
  };
  const photos = (await getValue<Photo[]>(KEY)) ?? [];
  await setValue(KEY, [...photos, photo]);
  return photo;
}

export async function removePhoto(id: string) {
  const photos = (await getValue<Photo[]>(KEY)) ?? [];
  const photo = photos.find((p) => p.id === id);
  if (!photo) return false;
  if (photo.src.startsWith("/uploads/")) {
    await fs.rm(path.join(process.cwd(), "public", photo.src), { force: true });
  } else {
    await del(photo.src, { token: blobToken() });
  }
  await setValue(
    KEY,
    photos.filter((p) => p.id !== id)
  );
  return true;
}
