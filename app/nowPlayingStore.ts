import { useSyncExternalStore } from "react";
import type { NowPlaying } from "@/lib/spotify";

// One shared poller for the corner box.

export type Track = Extract<NowPlaying, { playing: true }>;
export type NowPlayingState = {
  data: NowPlaying | null;
  // Kept so the box doesn't go blank while it collapses.
  last: Track | null;
};

export const FALLBACK_PROFILE = "https://open.spotify.com";
// Every visitor runs this, so it checks rarely: about once a song. The card
// only needs to be roughly right, and the progress bar runs on its own between
// checks.
const CHECK_MS = 3 * 60_000;
// If the song should end before the next check, check just after it ends
// instead (that replaces the check, it doesn't add one), but never sooner
// than this, so a stuck position can't cause a burst.
const END_GRACE_MS = 2_000;
const MIN_WAIT_MS = 30_000;
// Coming back to the tab only rechecks if the last check is older than this.
const STALE_MS = CHECK_MS;

const initial: NowPlayingState = { data: null, last: null };
let state = initial;
const listeners = new Set<() => void>();
let started = false;
let loading = false;
let lastLoad = 0;
let timer: ReturnType<typeof setTimeout> | undefined;

function set(next: Partial<NowPlayingState>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

// Where the song is right now, in ms.
export function positionNow(t: Track) {
  return Math.min(t.durationMs, t.progressMs + Math.max(0, Date.now() - t.at));
}

async function load() {
  if (loading) return;
  loading = true;
  clearTimeout(timer);
  try {
    const sent = performance.now();
    const res = await fetch("/api/now-playing", { cache: "no-store" });
    const json = (await res.json()) as NowPlaying;
    if (json.playing) {
      // How old the position is by the time it reaches us, measured rather than
      // read off two different clocks: the server's own time since it asked
      // Spotify, half the rest of our round trip for the trip back, and however
      // long a CDN held it.
      const roundTrip = performance.now() - sent;
      const onServer = Math.max(0, json.servedAt - json.at);
      const cached = Number(res.headers.get("age")) * 1000 || 0;
      const age = onServer + Math.max(0, roundTrip - onServer) / 2 + cached;
      const now = Date.now();
      const track = { ...json, progressMs: Math.min(json.durationMs, json.progressMs + age), at: now };
      set({ data: track, last: track });
    } else {
      set({ data: json });
    }
  } catch {
    // Keep what we had through a blip.
    if (!state.data) set({ data: { playing: false, profileUrl: FALLBACK_PROFILE } });
  } finally {
    loading = false;
    lastLoad = Date.now();
    schedule();
  }
}

function schedule() {
  clearTimeout(timer);
  const d = state.data;
  let wait = CHECK_MS;
  if (d?.playing) wait = Math.min(wait, Math.max(MIN_WAIT_MS, d.durationMs - positionNow(d) + END_GRACE_MS));
  timer = setTimeout(tick, wait);
}

function tick() {
  // Hidden tabs wait for visibilitychange.
  if (document.hidden) return;
  void load();
}

function onVisible() {
  if (!document.hidden && Date.now() - lastLoad > STALE_MS) void load();
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  if (!started) {
    started = true;
    document.addEventListener("visibilitychange", onVisible);
    void load();
  }
  return () => {
    listeners.delete(onChange);
  };
}

export function useNowPlaying() {
  return useSyncExternalStore(subscribe, () => state, () => initial);
}
