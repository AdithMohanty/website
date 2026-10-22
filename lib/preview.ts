// Server only.
// Finds a song's 30-second preview clip, which the visualizer analyzes for the
// song's own groove. Spotify's API stopped returning previews, but its embed
// page still carries one; Deezer's, looked up by ISRC, is the fallback.

const cache = new Map<string, string | null>();

async function fromSpotifyEmbed(id: string) {
  const res = await fetch(`https://open.spotify.com/embed/track/${id}`, {
    headers: { "User-Agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(4_000),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const match = (await res.text()).match(/"audioPreview":\{"url":"(https:\/\/p\.scdn\.co\/[^"]+)"/);
  return match?.[1] ?? null;
}

async function fromDeezer(isrc: string) {
  const res = await fetch(`https://api.deezer.com/track/isrc:${encodeURIComponent(isrc)}`, {
    signal: AbortSignal.timeout(4_000),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { preview?: string };
  return data.preview || null;
}

// Deezer's links expire, so only Spotify's are cached.
export async function getPreviewUrl(id: string, isrc: string | null) {
  if (cache.has(id)) return cache.get(id) ?? null;
  const spotify = await fromSpotifyEmbed(id).catch(() => null);
  if (spotify) {
    if (cache.size > 500) cache.clear();
    cache.set(id, spotify);
    return spotify;
  }
  return isrc ? fromDeezer(isrc).catch(() => null) : null;
}
