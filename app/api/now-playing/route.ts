import { getNowPlaying } from "@/lib/spotify";

// Kept short so listen-along and the visualizer pick up song changes quickly.
// Responses carry their own timestamp, so a cached one still says where the song is.
export async function GET() {
  try {
    return Response.json(await getNowPlaying(), {
      headers: { "Cache-Control": "public, s-maxage=2, stale-while-revalidate=3" },
    });
  } catch {
    return Response.json({ playing: false, profileUrl: "https://open.spotify.com" });
  }
}
