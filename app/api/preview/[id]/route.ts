import { getPreviewUrl } from "@/lib/preview";

type Ctx = { params: Promise<{ id: string }> };

// Streams a song's preview clip from our own origin, so the visualizer can
// decode it whichever CDN it comes from.
export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params;
  if (!/^[A-Za-z0-9]{22}$/.test(id)) return new Response(null, { status: 400 });
  const isrc = new URL(req.url).searchParams.get("isrc");

  const url = await getPreviewUrl(id, isrc && /^[A-Z0-9]{12}$/.test(isrc) ? isrc : null);
  if (!url) return new Response(null, { status: 404 });
  const audio = await fetch(url, { cache: "no-store" }).catch(() => null);
  if (!audio?.ok || !audio.body) return new Response(null, { status: 502 });

  return new Response(audio.body, {
    headers: {
      "Content-Type": audio.headers.get("Content-Type") ?? "audio/mpeg",
      "Cache-Control": "public, max-age=86400, s-maxage=604800",
    },
  });
}
