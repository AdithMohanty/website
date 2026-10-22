"use client";

import Link from "next/link";
import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from "react";
import ListenAlong from "../ListenAlong";
import { heardPosition, toggleListening, useListenAlong } from "../listenStore";
import { positionNow, useFastUpdates, useNowPlaying, type Track } from "../nowPlayingStore";
import { DEFAULT_PALETTE, loadCover, moodHue } from "./palette";
import { analyzePreview, genericProfile, type SongProfile } from "./profile";
import { SongPulse } from "./pulse";
import { LiquidRenderer } from "./renderer";

const MODE_KEY = "visualizer-mode";
const SETTINGS_EVENT = "visualizersettings";
const HEADPHONES = "M4 15v-3a8 8 0 0 1 16 0v3M4 15a2 2 0 0 1 2-2h1v7H6a2 2 0 0 1-2-2zM20 15a2 2 0 0 0-2-2h-1v7h1a2 2 0 0 0 2-2z";
const IDLE_MS = 2_500;

// Settings live in localStorage, with a fallback for when it's blocked.
const memory = new Map<string, string | null>();

function read(key: string) {
  if (memory.has(key)) return memory.get(key) ?? null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  memory.set(key, value);
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {}
  window.dispatchEvent(new Event(SETTINGS_EVENT));
}

function subscribeSettings(onChange: () => void) {
  window.addEventListener(SETTINGS_EVENT, onChange);
  return () => window.removeEventListener(SETTINGS_EVENT, onChange);
}

function useSetting(key: string, fallback: string) {
  return useSyncExternalStore(subscribeSettings, () => read(key) ?? fallback, () => fallback);
}

function subscribeFullscreen(onChange: () => void) {
  document.addEventListener("fullscreenchange", onChange);
  return () => document.removeEventListener("fullscreenchange", onChange);
}

function clockText(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

const subscribeNothing = () => () => {};

// Browser features, all false during the server render.
function useClientCheck(check: () => boolean) {
  return useSyncExternalStore(subscribeNothing, check, () => false);
}

// three.js draws through WebGPU, or WebGL 2 where there's no WebGPU.
let gpu: boolean | undefined;
function lacksGPU() {
  gpu ??= "gpu" in navigator || !!document.createElement("canvas").getContext("webgl2");
  return !gpu;
}

export default function Visualizer() {
  const { data, last } = useNowPlaying();
  useFastUpdates();
  const track = data?.playing ? data : last;
  const art = track?.art;
  const songId = track?.id ?? null;
  const isrc = track?.isrc;
  const features = track?.features;
  const tempoHint = features?.tempo;

  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // What's playing now, for the frame loop.
  const playingRef = useRef<Track | null>(null);
  // The current song's groove, from its preview.
  const profileRef = useRef<{ id: string; profile: SongProfile } | null>(null);
  const featuresRef = useRef(features);
  const rendererRef = useRef<LiquidRenderer | null>(null);
  const coverRef = useRef<HTMLImageElement | null>(null);
  const paletteRef = useRef(Float32Array.from(DEFAULT_PALETTE.flat()));
  const meltRef = useRef(false);
  // Readouts updated straight from the frame loop, without re-rendering.
  const timeRef = useRef<HTMLSpanElement>(null);
  const progressRef = useRef<HTMLElement>(null);
  const beatsRef = useRef<HTMLSpanElement>(null);
  const overUi = useRef(false);

  const [hasCover, setHasCover] = useState(false);
  const [idle, setIdle] = useState(false);
  const listen = useListenAlong();
  const listening = listen !== "off";

  const mode = useSetting(MODE_KEY, "liquid") === "melt" ? "melt" : "liquid";
  const fullscreen = useSyncExternalStore(subscribeFullscreen, () => !!document.fullscreenElement, () => false);
  const canFullscreen = useClientCheck(() => document.fullscreenEnabled);
  const noGPU = useClientCheck(lacksGPU);

  useEffect(() => {
    playingRef.current = data?.playing ? data : null;
    featuresRef.current = features;
  }, [data, features]);

  // Song position in, pixels out, every frame.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pulse = new SongPulse();

    let renderer: LiquidRenderer | null = null;
    let disposed = false;
    LiquidRenderer.create(canvas)
      .then((r) => {
        if (disposed) return r.dispose();
        renderer = r;
        if (coverRef.current) r.setCover(coverRef.current);
        rendererRef.current = r;
      })
      .catch((e) => console.error(e));

    const palette = Float32Array.from(paletteRef.current);
    let raf = 0;
    let last = performance.now();
    let flow = Math.random() * 100;
    let melt = meltRef.current ? 1 : 0;
    // Fraction of CSS pixels the blob layer renders at. The liquid layer
    // renders at a fraction of this again (see the renderer).
    let scale = 0.75;
    let slow = 0;
    let nextDraw = 0;
    // Our own steady song clock. Polls nudge it rather than yank it, so a
    // late poll doesn't make the beat stutter.
    let clock = 0;
    let clockId: string | null = null;

    let shownSecond = -1;
    let shownBeat = -1;
    // Where the visualizer thinks the song is, so you can check it against what you hear.
    function showPosition(pos: number, duration: number, tempo?: number) {
      const second = Math.floor(pos / 1000);
      if (second !== shownSecond && timeRef.current) {
        shownSecond = second;
        timeRef.current.textContent = `${clockText(pos)} / ${clockText(duration)}`;
      }
      progressRef.current?.style.setProperty("transform", `scaleX(${Math.min(1, Math.max(0, pos / duration))})`);
      const beats = beatsRef.current?.children;
      if (!beats) return;
      const beat = tempo ? Math.floor((pos / 60_000) * tempo) : -1;
      if (beat === shownBeat) return;
      shownBeat = beat;
      for (let i = 0; i < beats.length; i++) beats[i].classList.toggle("is-on", beat >= 0 && beat % 4 === i);
    }

    function frame(now: number) {
      raf = requestAnimationFrame(frame);
      // 60fps is plenty. On high-refresh screens this draws every other frame,
      // on a steady beat rather than whenever enough time has piled up.
      if (now < nextDraw - 2) return;
      nextDraw = Math.max(nextDraw + 1000 / 60, now);
      const step = (now - last) / 1000;
      last = now;
      const dt = Math.min(step, 0.1);
      // Frames running long mean the GPU is behind: render fewer pixels.
      // (Very long gaps are a hidden tab, not a slow GPU.)
      if (step < 0.25) {
        slow = step > 1 / 40 ? slow + step : Math.max(0, slow - step * 0.25);
        if (slow > 1 && scale > 0.4) {
          scale *= 0.85;
          slow = 0;
        }
      }
      const w = Math.max(1, Math.round(canvas!.clientWidth * scale));
      const h = Math.max(1, Math.round(canvas!.clientHeight * scale));
      if (canvas!.width !== w || canvas!.height !== h) {
        canvas!.width = w;
        canvas!.height = h;
      }

      const playing = playingRef.current;
      const groove = playing && profileRef.current?.id === playing.id ? profileRef.current.profile : null;
      if (playing) {
        // Listening along, the beat follows exactly what the player is playing.
        const target = heardPosition(playing.uri) ?? positionNow(playing);
        if (clockId !== playing.id || Math.abs(target - clock) > 350) clock = target;
        // Real elapsed time, not the capped dt, so dropped frames don't make it fall behind.
        else clock += step * 1000 + (target - clock) * (1 - Math.exp(-dt * 1.5));
        clockId = playing.id;
      }
      const levels = pulse.update(dt, now, playing ? clock : null, groove, featuresRef.current, playing ?? undefined);
      if (playing) showPosition(clock, playing.durationMs, groove?.tempo);
      // The liquid flows faster for energetic songs, kicks, and build-ups.
      flow += dt * (0.12 + 0.5 * levels.energy + 0.35 * levels.kick + 0.7 * levels.build);
      const k = 1 - Math.exp(-dt / 0.8);
      const target = paletteRef.current;
      for (let i = 0; i < palette.length; i++) palette[i] += (target[i] - palette[i]) * k;
      melt += ((meltRef.current ? 1 : 0) - melt) * (1 - Math.exp(-dt * 2.5));
      renderer?.draw({ time: flow, levels, palette, melt }, dt);
    }
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      disposed = true;
      renderer?.dispose();
      rendererRef.current = null;
    };
  }, []);

  useEffect(() => {
    meltRef.current = mode === "melt" && hasCover;
  }, [mode, hasCover]);

  // Recolor from each new cover.
  useEffect(() => {
    if (!art) return;
    let cancelled = false;
    loadCover(art, moodHue(featuresRef.current?.valence))
      .then(({ img, palette }) => {
        if (cancelled) return;
        coverRef.current = img;
        rendererRef.current?.setCover(img);
        paletteRef.current = Float32Array.from(palette.flat());
        setHasCover(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [art]);

  // Learn each song's groove from its preview clip.
  const [tempo, setTempo] = useState<number | null>(null);
  useEffect(() => {
    if (!songId) return;
    let cancelled = false;
    const fallback = () =>
      tempoHint
        ? genericProfile(tempoHint, featuresRef.current?.danceability ?? 0.6, featuresRef.current?.energy ?? 0.6)
        : null;
    fetch(`/api/preview/${songId}${isrc ? `?isrc=${isrc}` : ""}`)
      .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject(new Error(String(res.status)))))
      .then((buf) => analyzePreview(buf, tempoHint))
      .catch(() => fallback())
      .then((profile) => {
        if (cancelled) return;
        profileRef.current = profile ? { id: songId, profile } : null;
        setTempo(profile?.tempo ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [songId, isrc, tempoHint]);

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else rootRef.current?.requestFullscreen().catch(() => {});
  }

  function setMode(next: "liquid" | "melt") {
    write(MODE_KEY, next);
  }

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
    if (e.key === "f" && canFullscreen) toggleFullscreen();
    if (e.key === "m" && hasCover) setMode(mode === "melt" ? "liquid" : "melt");
    if (e.key === "l") toggleListening();
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => onKey(e);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Fade the controls and cursor out when the mouse rests.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    function arm() {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!overUi.current) setIdle(true);
      }, IDLE_MS);
    }
    function wake() {
      setIdle(false);
      arm();
    }
    arm();
    window.addEventListener("pointermove", wake);
    window.addEventListener("pointerdown", wake);
    window.addEventListener("keydown", wake);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pointermove", wake);
      window.removeEventListener("pointerdown", wake);
      window.removeEventListener("keydown", wake);
    };
  }, []);

  // Keep the screen awake while it's on.
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    let active = true;
    function request() {
      if (document.visibilityState !== "visible" || !navigator.wakeLock) return;
      navigator.wakeLock
        .request("screen")
        .then((l) => {
          if (active) lock = l;
          else void l.release();
        })
        .catch(() => {});
    }
    request();
    document.addEventListener("visibilitychange", request);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", request);
      void lock?.release();
    };
  }, []);

  const hold = {
    onPointerEnter: () => {
      overUi.current = true;
    },
    onPointerLeave: () => {
      overUi.current = false;
    },
  };

  return (
    <div ref={rootRef} className={`viz${idle ? " is-idle" : ""}${listening ? " has-player" : ""}`}>
      <canvas ref={canvasRef} className="viz-canvas" aria-hidden="true" />
      <ListenAlong />
      {noGPU && <p className="viz-fallback">This visualizer needs WebGPU or WebGL 2, which this browser doesn&apos;t support.</p>}

      <div className="viz-ui">
        <div className="viz-top">
          <Link href="/" className="viz-panel viz-back" {...hold}>
            <span aria-hidden="true">←</span> Back
          </Link>

          <div className="viz-panel viz-controls" {...hold}>
            <div className="viz-row">
              <div className="viz-segment" role="group" aria-label="Style">
                <button type="button" aria-pressed={mode === "liquid"} onClick={() => setMode("liquid")}>
                  Liquid
                </button>
                <button
                  type="button"
                  aria-pressed={mode === "melt"}
                  disabled={!hasCover}
                  title={hasCover ? "Melts the album cover" : "Needs a song playing"}
                  onClick={() => setMode("melt")}
                >
                  Melt
                </button>
              </div>
              <button
                type="button"
                className="viz-icon-btn"
                aria-pressed={listening}
                onClick={toggleListening}
                disabled={!data?.playing && !listening}
                aria-label={listening ? "Stop listening along" : "Listen along"}
                title={data?.playing ? "Listen along: play this song here, in step" : "Nothing playing to listen along to"}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d={HEADPHONES} />
                </svg>
              </button>
              {canFullscreen && (
                <button
                  type="button"
                  className="viz-icon-btn"
                  onClick={toggleFullscreen}
                  aria-label={fullscreen ? "Exit full screen" : "Full screen"}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true">
                    <path d={fullscreen ? "M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" : "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"} />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="viz-bottom">
          {track ? (
            <a className="viz-panel viz-track" href={track.url} target="_blank" rel="noreferrer" {...hold}>
              {(track.art ?? track.image) && <img src={track.art ?? track.image} alt="" />}
              <span className="viz-track-text">
                <span className="viz-track-label">{data?.playing ? "Now playing" : "Paused"}</span>
                <span className="viz-track-title">{track.title}</span>
                <span className="viz-track-artist">{track.artist}</span>
                {data?.playing && (
                  <span className="viz-track-meta">
                    <span ref={timeRef} className="viz-track-time" />
                    {tempo && <span className="viz-track-bpm">{Math.round(tempo)} BPM</span>}
                    {tempo && (
                      <span ref={beatsRef} className="viz-beats" aria-hidden="true">
                        <i />
                        <i />
                        <i />
                        <i />
                      </span>
                    )}
                  </span>
                )}
                {data?.playing && (
                  <span className="viz-progress" aria-hidden="true">
                    <i ref={progressRef} />
                  </span>
                )}
              </span>
            </a>
          ) : data ? (
            <p className="viz-panel viz-track viz-track-empty">Nothing playing on Spotify right now.</p>
          ) : null}
          <p className="viz-keys">
            F full screen · M style · L listen along
          </p>
        </div>
      </div>
    </div>
  );
}
