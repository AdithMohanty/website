import { useEffect, useSyncExternalStore } from "react";
import type { NowPlaying } from "@/lib/spotify";

// One poller shared by the corner box and the visualizer.

export type Track = Extract<NowPlaying, { playing: true }>;
export type NowPlayingState = {
  data: NowPlaying | null;
  // Kept so the box doesn't go blank while it collapses.
  last: Track | null;
};

export const FALLBACK_PROFILE = "https://open.spotify.com";
const SLOW_MS = 30_000;
// While the visualizer is open.
const FAST_MS = 3_000;
// Spotify can't push changes, so also check just after the song should end.
const END_GRACE_MS = 1_500;

const initial: NowPlayingState = { data: null, last: null };
let state = initial;
const listeners = new Set<() => void>();
let started = false;
let loading = false;
let lastLoad = 0;
let fastWatchers = 0;
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
  let wait = fastWatchers > 0 ? FAST_MS : SLOW_MS;
  if (d?.playing) wait = Math.min(wait, Math.max(1_000, d.durationMs - positionNow(d) + END_GRACE_MS));
  timer = setTimeout(tick, wait);
}

function tick() {
  // Hidden tabs wait for visibilitychange.
  if (document.hidden) return;
  void load();
}

function onVisible() {
  if (!document.hidden && Date.now() - lastLoad > 2_000) void load();
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

// Polls quickly while the calling component is mounted.
export function useFastUpdates() {
  useEffect(() => {
    fastWatchers++;
    if (Date.now() - lastLoad > FAST_MS) void load();
    else if (!loading) schedule();
    return () => {
      fastWatchers--;
      if (!loading) schedule();
    };
  }, []);
}
