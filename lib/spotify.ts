// Server only.

export type NowPlaying = { profileUrl: string } & (
  | { playing: false }
  | {
      playing: true;
      title: string;
      artist: string;
      url: string;
      // Track id, for the visualizer's preview lookup. Null for local files.
      id: string | null;
      isrc?: string;
      uri: string;
      image?: string;
      // Largest cover, for the visualizer.
      art?: string;
      progressMs: number;
      durationMs: number;
      // Server time progressMs was read at, and when the response left. Clients
      // use the gap, plus their own round trip, to tell where the song is now.
      at: number;
      servedAt: number;
      features?: SongFeatures;
      // The playlist (or album, or artist) it's playing from.
      context?: { url: string; name: string };
    }
);

// What the visualizer moves to. Spotify no longer gives these to new apps, so
// they come from ReccoBeats, which has the same numbers for Spotify tracks.
export type SongFeatures = {
  tempo: number;
  // 0 to 1.
  energy: number;
  danceability: number;
  // How happy it sounds.
  valence: number;
  acousticness: number;
  // 1 major, 0 minor.
  mode: number;
};

const FALLBACK_PROFILE = "https://open.spotify.com";

let cachedToken: { value: string; expires: number } | null = null;

async function getAccessToken() {
  if (cachedToken && Date.now() < cachedToken.expires) return cachedToken.value;

  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  const refresh = process.env.SPOTIFY_REFRESH_TOKEN;
  if (!id || !secret || !refresh) return null;

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refresh }),
    cache: "no-store",
  });
  if (!res.ok) return null;

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: data.access_token, expires: Date.now() + (data.expires_in - 60) * 1000 };
  return cachedToken.value;
}

type SpotifyItem = {
  id: string | null;
  name: string;
  uri: string;
  duration_ms: number;
  external_urls: { spotify: string };
  external_ids?: { isrc?: string };
  // Tracks
  artists?: { name: string }[];
  album?: { name: string; images: { url: string; width: number }[] };
  // Podcast episodes
  show?: { name: string; images: { url: string; width: number }[] };
};

function smallestImage(images?: { url: string; width: number }[]) {
  if (!images?.length) return undefined;
  return [...images].sort((a, b) => a.width - b.width)[0].url;
}

function largestImage(images?: { url: string; width: number }[]) {
  if (!images?.length) return undefined;
  return [...images].sort((a, b) => b.width - a.width)[0].url;
}

// Keyed by Spotify track id. Null means ReccoBeats doesn't know the song.
const featureCache = new Map<string, SongFeatures | null>();

async function getFeatures(id: string | null): Promise<SongFeatures | undefined> {
  if (!id) return undefined;
  if (featureCache.has(id)) return featureCache.get(id) ?? undefined;
  try {
    const res = await fetch(`https://api.reccobeats.com/v1/audio-features?ids=${id}`, {
      signal: AbortSignal.timeout(2_000),
      cache: "no-store",
    });
    if (!res.ok) return undefined;
    const data = (await res.json()) as { content?: SongFeatures[] };
    const f = data.content?.[0];
    const features = f?.tempo
      ? {
          tempo: f.tempo,
          energy: f.energy,
          danceability: f.danceability,
          valence: f.valence,
          acousticness: f.acousticness,
          mode: f.mode,
        }
      : null;
    if (featureCache.size > 500) featureCache.clear();
    featureCache.set(id, features);
    return features ?? undefined;
  } catch {
    // Timed out or down: try again on the next poll.
    return undefined;
  }
}

const CONTEXT_NAMES: Record<string, string> = {
  collection: "Liked Songs",
  album: "Album",
  artist: "Artist",
  playlist: "Playlist",
};
const contextNameCache = new Map<string, string>();

async function getContext(
  token: string,
  ctx: { type: string; uri: string; href?: string; external_urls?: { spotify?: string } } | null,
  item: SpotifyItem
) {
  const url = ctx?.external_urls?.spotify;
  if (!ctx || !url) return undefined;
  if (ctx.type === "album" && item.album?.name) return { url, name: item.album.name };
  let name = contextNameCache.get(ctx.uri);
  if (!name && ctx.type === "playlist" && ctx.href) {
    const res = await fetch(`${ctx.href}?fields=name`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    }).catch(() => null);
    if (res?.ok) name = ((await res.json()) as { name?: string }).name;
    if (name) contextNameCache.set(ctx.uri, name);
  }
  return { url, name: name ?? CONTEXT_NAMES[ctx.type] ?? "Playlist" };
}

let profileUrl: string | null = null;

async function getProfileUrl(token: string) {
  if (profileUrl) return profileUrl;
  const res = await fetch("https://api.spotify.com/v1/me", {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return FALLBACK_PROFILE;
  const me = (await res.json()) as { external_urls?: { spotify?: string } };
  profileUrl = me.external_urls?.spotify ?? FALLBACK_PROFILE;
  return profileUrl;
}

export async function getNowPlaying(): Promise<NowPlaying> {
  const token = await getAccessToken();
  if (!token) return { playing: false, profileUrl: FALLBACK_PROFILE };
  const profile = await getProfileUrl(token);

  const sent = Date.now();
  const res = await fetch(
    "https://api.spotify.com/v1/me/player/currently-playing?additional_types=episode",
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
  );
  // Spotify read the position somewhere in the round trip; the middle is the best guess.
  const at = Math.round((sent + Date.now()) / 2);
  // 204 = nothing playing.
  if (res.status !== 200) return { playing: false, profileUrl: profile };

  const data = (await res.json()) as {
    is_playing: boolean;
    progress_ms: number | null;
    item: SpotifyItem | null;
    context: { type: string; uri: string; href?: string; external_urls?: { spotify?: string } } | null;
  };
  if (!data.is_playing || !data.item) return { playing: false, profileUrl: profile };

  const item = data.item;
  const images = item.album?.images ?? item.show?.images;
  const [features, context] = await Promise.all([
    item.artists ? getFeatures(item.id) : undefined,
    getContext(token, data.context, item),
  ]);
  return {
    playing: true,
    profileUrl: profile,
    title: item.name,
    artist: item.artists?.map((a) => a.name).join(", ") ?? item.show?.name ?? "",
    url: item.external_urls.spotify,
    id: item.artists ? item.id : null,
    isrc: item.external_ids?.isrc,
    uri: item.uri,
    image: smallestImage(images),
    art: largestImage(images),
    progressMs: data.progress_ms ?? 0,
    durationMs: item.duration_ms,
    at,
    features,
    context,
    servedAt: Date.now(),
  };
}
