import { getNowPlaying } from "@/lib/spotify";

export async function GET() {
  try {
    return Response.json(await getNowPlaying(), {
      headers: { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=15" },
    });
  } catch {
    return Response.json({ playing: false, profileUrl: "https://open.spotify.com" });
  }
}
