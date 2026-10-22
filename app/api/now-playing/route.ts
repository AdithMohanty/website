import { getNowPlaying, type NowPlaying } from "@/lib/spotify";

// Every visitor polls this, so Spotify is asked as rarely as possible: the CDN
// shares each response for a minute, and each server instance reuses its last
// answer (or the one still on its way) for 30 seconds. Responses carry
// the time Spotify read the position plus the time they're sent, so clients
// can tell how old a shared answer is and still know where the song is.
const REUSE_MS = 30_000;
const FALLBACK: NowPlaying = { playing: false, profileUrl: "https://open.spotify.com" };

let recent: { at: number; value: Promise<NowPlaying> } | null = null;

function nowPlaying() {
  if (!recent || Date.now() - recent.at > REUSE_MS) {
    recent = { at: Date.now(), value: getNowPlaying().catch(() => FALLBACK) };
  }
  return recent.value;
}

export async function GET() {
  const value = await nowPlaying();
  return Response.json(value.playing ? { ...value, servedAt: Date.now() } : value, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
  });
}
