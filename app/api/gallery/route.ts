import { revalidatePath } from "next/cache";
import { isAuthorized } from "@/lib/auth";
import { listPhotos } from "@/lib/gallery";
import { addPhoto, removePhoto } from "@/lib/photos";

export async function GET() {
  return Response.json(await listPhotos());
}

// Form fields: photo (file, required), and optionally date, lat, lon, name.
// date/lat/lon override what's stored in the photo, for senders that strip it.
export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "Send the photo as multipart form data." }, { status: 400 });
  }
  const file = form.get("photo");
  if (!(file instanceof Blob) || file.size === 0) {
    return Response.json({ error: "Missing the photo field." }, { status: 400 });
  }
  try {
    const photo = await addPhoto(Buffer.from(await file.arrayBuffer()), {
      date: form.get("date"),
      lat: form.get("lat"),
      lon: form.get("lon"),
      name: form.get("name") ?? (file instanceof File ? file.name : undefined),
    });
    revalidatePath("/gallery");
    return Response.json({ ok: true, place: photo.place ?? null, date: photo.date ?? null, src: photo.src });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}

// DELETE /api/gallery?id=<id>
export async function DELETE(req: Request) {
  if (!isAuthorized(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const id = new URL(req.url).searchParams.get("id");
  if (!id || !(await removePhoto(id))) {
    return Response.json({ error: "No photo with that id." }, { status: 404 });
  }
  revalidatePath("/gallery");
  return Response.json({ ok: true });
}
