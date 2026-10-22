"use client";

import { useLayoutEffect, useRef, type CSSProperties } from "react";
import { FALLBACK_PROFILE, useNowPlaying } from "./nowPlayingStore";

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

// A line of text that, when it's too long for the card, scrolls through on a
// loop: a pause to read the start, then a seamless scroll round to it again.
// Measured straight from the DOM, so it rechecks when the text or width changes.
const CYCLE_GAP = 32;
const CYCLE_SPEED = 28; // px per second
function Cycle({ text, className }: { text?: string; className: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    const first = el?.querySelector<HTMLElement>(".cycle-text");
    if (!el || !first) return;
    function measure() {
      const long = first!.offsetWidth > el!.clientWidth + 1;
      const shift = first!.offsetWidth + CYCLE_GAP;
      el!.classList.toggle("is-cycling", long);
      el!.style.setProperty("--shift", `${shift}px`);
      // The scroll takes 80% of each loop; the rest is the pause at the start.
      el!.style.setProperty("--cycle", `${(shift / CYCLE_SPEED / 0.8).toFixed(2)}s`);
    }
    measure();
    const resize = new ResizeObserver(measure);
    resize.observe(el);
    // The web font can land after first paint and change the width.
    document.fonts?.ready.then(measure);
    return () => resize.disconnect();
  }, [text]);
  return (
    <span ref={ref} className={`cycle ${className}`}>
      <span className="cycle-track">
        <span className="cycle-text">{text}</span>
        <span className="cycle-text" aria-hidden="true">
          {text}
        </span>
      </span>
    </span>
  );
}

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

export default function NowPlaying() {
  const { data, last } = useNowPlaying();

  const playing = data?.playing === true;
  const track = playing ? data : last;
  const profile = data?.profileUrl ?? FALLBACK_PROFILE;

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
            <Cycle className="spotify-title" text={track?.title} />
            <Cycle className="spotify-artist" text={track?.artist} />
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
      </div>
    </div>
  );
}
