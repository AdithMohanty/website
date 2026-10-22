"use client";

import { useEffect, useEffectEvent, useRef } from "react";
import { getListenStatus, reportHeard, setListenStatus, toggleListening, useListenAlong, type ListenStatus } from "./listenStore";
import { positionNow, useFastUpdates, useNowPlaying, type Track } from "./nowPlayingStore";

// Spotify's embed player, driven through its iFrame API.
type Playback = { playingURI: string; isPaused: boolean; isBuffering: boolean; duration: number; position: number };
type Controller = {
  loadUri(uri: string, preferVideo?: boolean, startAt?: number): void;
  play(): void;
  pause(): void;
  resume(): void;
  seek(seconds: number): void;
  destroy(): void;
  addListener(event: "playback_update", cb: (e: { data: Playback }) => void): void;
  addListener(event: "ready", cb: () => void): void;
};
type IFrameAPI = {
  createController(
    el: HTMLElement,
    options: { uri: string; width: string | number; height: number },
    cb: (c: Controller) => void
  ): void;
};

declare global {
  interface Window {
    onSpotifyIframeApiReady?: (api: IFrameAPI) => void;
  }
}

// Drift past this and the player jumps back in step.
const MAX_DRIFT_MS = 2_000;
// Spotify plays a preview this long to visitors who aren't logged in.
const PREVIEW_MS = 30_000;
// Long enough for playback to start; past it the browser held it back.
const START_GRACE_MS = 3_000;

let api: Promise<IFrameAPI> | null = null;
function loadApi() {
  api ??= new Promise<IFrameAPI>((resolve, reject) => {
    window.onSpotifyIframeApiReady = resolve;
    const script = document.createElement("script");
    script.src = "https://open.spotify.com/embed/iframe-api/v1";
    script.async = true;
    script.onerror = () => {
      api = null;
      reject(new Error("Spotify's player didn't load"));
    };
    document.body.appendChild(script);
  });
  return api;
}

const NOTES: Record<Exclude<ListenStatus, "off">, string> = {
  starting: "Joining…",
  playing: "Listening along",
  preview: "Preview · log in to Spotify for full songs",
  paused: "Press play to listen along",
  waiting: "Waiting for the next song",
  unavailable: "Spotify's player couldn't load",
};

// While listening, my position is checked every few seconds.
function FastUpdates() {
  useFastUpdates();
  return null;
}

// The listen-along dock: Spotify's player following whatever I'm playing.
// Part of the visualizer: leaving it stops listening.
export default function ListenAlong() {
  const status = useListenAlong();
  const { data } = useNowPlaying();
  const on = status !== "off";
  const track = data?.playing && data.uri.startsWith("spotify:track:") ? data : null;

  const hostRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<Controller | null>(null);
  const trackRef = useRef<Track | null>(track);
  const loaded = useRef<{ uri: string; at: number } | null>(null);
  const lastSeek = useRef(0);

  // Load my song where I am in it, or pick back up where I am.
  const follow = useEffectEvent(() => {
    const c = controllerRef.current;
    trackRef.current = track;
    if (!c) return;
    if (!track) {
      c.pause();
      reportHeard(null);
      setListenStatus("waiting");
      return;
    }
    const at = positionNow(track) / 1000;
    if (loaded.current?.uri !== track.uri) {
      c.loadUri(track.uri, false, at);
      loaded.current = { uri: track.uri, at: performance.now() };
    } else {
      c.seek(Math.round(at));
    }
    c.play();
    setListenStatus("starting");
    setTimeout(() => {
      if (loaded.current?.uri === track.uri && performance.now() - loaded.current.at >= START_GRACE_MS) {
        if (getListenStatus() === "starting") setListenStatus("paused");
      }
    }, START_GRACE_MS + 50);
  });

  const onPlayback = useEffectEvent((p: Playback) => {
    const t = trackRef.current;
    if (!t || p.playingURI !== t.uri) return;
    if (p.isPaused) {
      reportHeard(null);
      if (!p.isBuffering) setListenStatus("paused");
      return;
    }
    // A song that's all there or a short preview of one.
    if (p.duration < PREVIEW_MS + 2_000 && t.durationMs > p.duration + 5_000) {
      setListenStatus("preview");
      return;
    }
    setListenStatus("playing");
    reportHeard(t.uri, p.position);
    const mine = positionNow(t);
    const now = performance.now();
    if (Math.abs(mine - p.position) > MAX_DRIFT_MS && now - lastSeek.current > 4_000) {
      lastSeek.current = now;
      controllerRef.current?.seek(Math.round(mine / 1000));
    }
  });

  useEffect(() => () => setListenStatus("off"), []);

  // The player exists while listening along, from the first song on.
  const hasTrack = !!track;
  useEffect(() => {
    if (!on || !hasTrack) return;
    let cancelled = false;
    let controller: Controller | null = null;
    loadApi()
      .then((spotify) => {
        if (cancelled || !hostRef.current || !trackRef.current) return;
        const el = document.createElement("div");
        hostRef.current.appendChild(el);
        spotify.createController(el, { uri: trackRef.current.uri, width: "100%", height: 80 }, (c) => {
          if (cancelled) return c.destroy();
          controller = c;
          controllerRef.current = c;
          c.addListener("playback_update", (e) => onPlayback(e.data));
          follow();
        });
      })
      .catch(() => {
        if (!cancelled) setListenStatus("unavailable");
      });
    return () => {
      cancelled = true;
      controller?.destroy();
      controllerRef.current = null;
      loaded.current = null;
      reportHeard(null);
    };
  }, [on, hasTrack]);

  // Follow song changes, pauses and resumes on my end.
  const followKey = track ? `${track.uri}:${Math.round(track.progressMs / 5_000)}` : "none";
  useEffect(() => {
    if (!on) return;
    if (!track) {
      follow();
      return;
    }
    // A poll only matters here if the song changed or I skipped around in it.
    const t = trackRef.current;
    if (!loaded.current || !t || t.uri !== track.uri || Math.abs(positionNow(t) - positionNow(track)) > MAX_DRIFT_MS) {
      follow();
    }
    trackRef.current = track;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, followKey]);

  if (!on) return null;
  return (
    <div className="listen" role="region" aria-label="Listen along">
      <FastUpdates />
      <div className="listen-head">
        <span className="listen-note" role="status">
          <span className={`spotify-bars${status === "playing" ? " is-live" : ""}`} aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
          {NOTES[status]}
        </span>
        <button type="button" className="listen-close" onClick={toggleListening} aria-label="Stop listening along">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </div>
      <div className="listen-player" ref={hostRef} />
    </div>
  );
}
