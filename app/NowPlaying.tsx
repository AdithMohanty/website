"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, type CSSProperties } from "react";
import { FALLBACK_PROFILE, useNowPlaying } from "./nowPlayingStore";
import { useRainbow } from "./RainbowToggle";

function Icon({ d }: { d: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

const NOTE = "M9 18V6l10-2v12M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM19 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z";

// Equalizer bars that bounce while a song plays.
function Bars() {
  return (
    <span className="spotify-bars is-live" aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}

// Mirror tiles for the disco ball, laid out on a sphere: rings of latitude,
// fewer tiles toward the poles. Each is tilted a hair off true so they catch
// the light one at a time as the ball turns, and a few reflect colored light.
const BANDS = 14;
const BAND = Math.PI / BANDS;
const MIRRORS = Array.from({ length: BANDS }, (_, row) => {
  const lat = -Math.PI / 2 + BAND * (row + 0.5);
  const count = Math.max(4, Math.round(28 * Math.cos(lat)));
  return Array.from({ length: count }, (_, i) => {
    const seed = Math.abs(Math.sin(row * 91.7 + i * 47.3) * 43758.5) % 1;
    return { lat, lon: (i / count) * Math.PI * 2, width: (Math.PI * 2) / count, seed, tilt: (seed - 0.5) * 0.5 };
  });
}).flat();

const SIZE = 40;
const RADIUS = 17;
// The room's light, up and to the left, and the viewer straight on.
const LIGHT = [-0.5, 0.6, 0.62];
const HALF = (() => {
  const h = [LIGHT[0], LIGHT[1], LIGHT[2] + 1];
  const n = Math.hypot(h[0], h[1], h[2]);
  return h.map((v) => v / n);
})();

// Draws the ball turned by `turn` radians, its colored mirrors shifting with `time`.
function drawBall(ctx: CanvasRenderingContext2D, turn: number, time: number) {
  const c = SIZE / 2;
  const at = (lat: number, lon: number): [number, number] => [
    c + RADIUS * Math.cos(lat) * Math.sin(lon),
    c - RADIUS * Math.sin(lat),
  ];
  ctx.clearRect(0, 0, SIZE, SIZE);
  ctx.beginPath();
  ctx.arc(c, c, RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = "#18181e";
  ctx.fill();

  for (const m of MIRRORS) {
    const lon = m.lon + turn;
    const x = Math.cos(m.lat) * Math.sin(lon + m.tilt);
    const y = Math.sin(m.lat + m.tilt * 0.6);
    const z = Math.cos(m.lat) * Math.cos(lon + m.tilt);
    if (Math.cos(m.lat) * Math.cos(lon) <= 0.05) continue;
    const diffuse = Math.max(0, x * LIGHT[0] + y * LIGHT[1] + z * LIGHT[2]);
    const flash = Math.max(0, x * HALF[0] + y * HALF[1] + z * HALF[2]) ** 80;
    // Toward the rim the mirrors face away and go dark.
    const facing = Math.cos(m.lat) * Math.cos(lon);
    const light = Math.min(97, 18 + 50 * diffuse * (0.4 + 0.6 * facing) + 70 * flash);
    ctx.fillStyle =
      m.seed < 0.2
        ? `hsl(${(m.seed * 1800 + time * 60) % 360} 90% ${Math.min(92, light + 12)}%)`
        : `hsl(225 10% ${light}%)`;
    const h = BAND * 0.42;
    const w = m.width * 0.42;
    const corners = [at(m.lat - h, lon - w), at(m.lat - h, lon + w), at(m.lat + h, lon + w), at(m.lat + h, lon - w)];
    ctx.beginPath();
    ctx.moveTo(...corners[0]);
    for (let k = 1; k < 4; k++) ctx.lineTo(...corners[k]);
    ctx.closePath();
    ctx.fill();
  }

  // A soft sheen on the lit side and shadow on the far one.
  const shade = ctx.createRadialGradient(c - 6, c - 7, 1, c, c, RADIUS);
  shade.addColorStop(0, "rgba(255,255,255,0.28)");
  shade.addColorStop(0.5, "rgba(255,255,255,0)");
  shade.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.beginPath();
  ctx.arc(c, c, RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = shade;
  ctx.fill();
}

// The easter egg: in rainbow mode while a song plays, a mirror ball pops up
// beside the card, turning and flashing, and it leads to the visualizer.
function DiscoBall() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fast = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    canvas.width = canvas.height = SIZE * dpr;
    ctx.scale(dpr, dpr);
    let turn = 0;
    let raf = 0;
    let last = performance.now();
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      drawBall(ctx, 0.4, 0);
      return;
    }
    function frame(now: number) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      // Spins up on hover.
      turn += dt * (fast.current ? 2.6 : 0.7);
      drawBall(ctx!, turn, now / 1000);
    }
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <Link
      href="/visualizer"
      className="disco"
      aria-label="Open the music visualizer"
      title="Disco mode"
      onPointerEnter={() => (fast.current = true)}
      onPointerLeave={() => (fast.current = false)}
    >
      <canvas ref={canvasRef} className="disco-ball" aria-hidden="true" />
      <i className="disco-sparkle" />
      <i className="disco-sparkle" />
      <i className="disco-sparkle" />
    </Link>
  );
}

export default function NowPlaying() {
  const { data, last } = useNowPlaying();
  const rainbow = useRainbow();
  const titleRef = useRef<HTMLSpanElement>(null);

  const playing = data?.playing === true;
  const track = playing ? data : last;
  const profile = data?.profileUrl ?? FALLBACK_PROFILE;

  // Long titles scroll on hover so the whole name can be read.
  useLayoutEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    const overflow = el.scrollWidth - el.clientWidth;
    el.style.setProperty("--overflow", `${Math.max(0, overflow)}px`);
    el.classList.toggle("is-long", overflow > 2);
  }, [track?.title, playing]);

  const label = playing && track
    ? `Now playing on Spotify: ${track.title} by ${track.artist}. Opens Spotify`
    : "Not listening right now. Open my Spotify profile";
  const tooltip = playing && data.context ? `Playing from ${data.context.name}` : undefined;

  return (
    <div className={`spotify${playing ? " is-playing" : ""}`}>
      <div className="spotify-lift">
        <a
          className="spotify-card"
          href={playing && track ? track.url : profile}
          target="_blank"
          rel="noreferrer"
          aria-label={label}
          title={playing ? tooltip : "Not listening right now"}
        >
          <span className="spotify-square">
            {playing && track?.image ? (
              // Keyed so each new cover fades in.
              <img key={track.image} src={track.image} alt="" />
            ) : (
              <Icon d={NOTE} />
            )}
          </span>
          <span className="spotify-details" aria-hidden="true">
            <span className="spotify-title" ref={titleRef}>
              <span>{track?.title}</span>
            </span>
            <span className="spotify-artist">{track?.artist}</span>
          </span>
          {playing && <Bars />}
          {playing && data.durationMs > 0 && (
            <span
              // Restart from the fresh position after every poll.
              key={`${data.uri}:${data.at}`}
              className="spotify-progress"
              style={
                {
                  "--from": data.progressMs / data.durationMs,
                  animationDuration: `${data.durationMs - data.progressMs}ms`,
                } as CSSProperties
              }
            />
          )}
        </a>
        {playing && rainbow && <DiscoBall />}
      </div>
    </div>
  );
}
