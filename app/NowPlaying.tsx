"use client";

import { useEffect, useState } from "react";
import type { NowPlaying as NowPlayingData } from "@/lib/spotify";

const POLL_MS = 30_000;
const FALLBACK_PROFILE = "https://open.spotify.com";

type Track = Extract<NowPlayingData, { playing: true }>;

export default function NowPlaying() {
  const [data, setData] = useState<NowPlayingData | null>(null);
  // Kept so the text doesn't vanish while the box collapses.
  const [lastTrack, setLastTrack] = useState<Track | null>(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const res = await fetch("/api/now-playing", { cache: "no-store" });
        const json = (await res.json()) as NowPlayingData;
        if (!alive) return;
        setData(json);
        if (json.playing) setLastTrack(json);
      } catch {
        if (alive) setData((d) => ({ playing: false, profileUrl: d?.profileUrl ?? FALLBACK_PROFILE }));
      }
    }
    function poll() {
      if (!document.hidden) load();
    }
    load();
    const id = setInterval(poll, POLL_MS);
    document.addEventListener("visibilitychange", poll);
    return () => {
      alive = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", poll);
    };
  }, []);

  const playing = data?.playing === true;
  const track = playing ? data : lastTrack;
  const href = playing ? data.url : data?.profileUrl ?? FALLBACK_PROFILE;
  const label = playing
    ? `Now playing on Spotify: ${data.title} by ${data.artist}`
    : "Not listening right now. Open my Spotify profile";

  return (
    <a
      className={`spotify${playing ? " is-playing" : ""}`}
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      title={playing ? undefined : "Not listening right now"}
    >
      <span className="spotify-square">
        {playing && track?.image && <img src={track.image} alt="" />}
      </span>
      <span className="spotify-details" aria-hidden="true">
        <span className="spotify-label">Now playing</span>
        <span className="spotify-title">{track?.title}</span>
        <span className="spotify-artist">{track?.artist}</span>
      </span>
    </a>
  );
}
