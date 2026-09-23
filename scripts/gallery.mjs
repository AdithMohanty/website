// Uploads the photos in gallery-originals/ (private, never committed) to the
// site's gallery, skipping ones already uploaded. Each photo is shrunk and
// stripped of metadata here; its date and GPS are sent alongside so the site
// can show where and when it was taken.
//
//   npm run gallery                              (to http://localhost:3000)
//   npm run gallery -- https://adithmohanty.com  (to the live site)

import fs from "node:fs";
import path from "node:path";
import exifr from "exifr";
import sharp from "sharp";

const ROOT = process.cwd();
const ORIGINALS = path.join(ROOT, "gallery-originals");
const IMAGE = /\.(jpe?g|png|webp|tiff?)$/i;
const site = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");

function readSecret() {
  const env = path.join(ROOT, ".env.local");
  if (!fs.existsSync(env)) return undefined;
  const m = fs.readFileSync(env, "utf8").match(/^LOCATION_SECRET=(.*)$/m);
  return m?.[1].trim().replace(/^["']|["']$/g, "");
}

const secret = readSecret();
if (!secret) {
  console.error("Set LOCATION_SECRET in .env.local first.");
  process.exit(1);
}
if (!fs.existsSync(ORIGINALS)) {
  console.error("Put photos in gallery-originals/ first.");
  process.exit(1);
}

const listRes = await fetch(`${site}/api/gallery`).catch(() => null);
if (!listRes?.ok) {
  console.error(`Couldn't reach ${site}/api/gallery. Is the site running and deployed?`);
  process.exit(1);
}
const uploaded = new Set((await listRes.json()).map((p) => p.name));

const files = fs.readdirSync(ORIGINALS).filter((f) => IMAGE.test(f) && !uploaded.has(f));
console.log(`${files.length} new photo(s) to upload to ${site}`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = 0;

for (const [i, file] of files.entries()) {
  const src = path.join(ORIGINALS, file);
  const exif = (await exifr.parse(src, { gps: true, reviveValues: false }).catch(() => null)) ?? {};
  const small = await sharp(src)
    .rotate()
    .resize(2000, 2000, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 90 })
    .toBuffer();

  const form = new FormData();
  form.append("photo", new Blob([small], { type: "image/jpeg" }), file);
  form.append("name", file);
  const date = exif.DateTimeOriginal ?? exif.CreateDate;
  if (typeof date === "string") form.append("date", date);
  if (typeof exif.latitude === "number" && typeof exif.longitude === "number") {
    form.append("lat", String(exif.latitude));
    form.append("lon", String(exif.longitude));
  }

  const res = await fetch(`${site}/api/gallery`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
    body: form,
  });
  const json = await res.json().catch(() => ({}));
  if (res.ok) {
    console.log(`[${i + 1}/${files.length}] ${file}  ${json.place ?? "(no location)"}  ${json.date ?? "(no date)"}`);
  } else {
    failed++;
    console.log(`[${i + 1}/${files.length}] ${file}  FAILED: ${json.error ?? res.status}`);
  }
  // The place lookup service allows about one request per second.
  await sleep(1100);
}

console.log(failed ? `Done, ${failed} failed.` : "Done.");
