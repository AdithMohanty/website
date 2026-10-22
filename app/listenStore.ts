import { useSyncExternalStore } from "react";

// Listen along, in the visualizer: plays the song I'm playing in the visitor's
// own browser, through Spotify's embedded player, kept in step with my
// position. Shared by the visualizer and the player itself (ListenAlong.tsx).

export type ListenStatus =
  | "off"
  | "starting"
  // Hearing the full song, in step.
  | "playing"
  // Not logged in to Spotify in this browser: Spotify only plays a 30-second preview.
  | "preview"
  // The listener paused, or the browser wouldn't start playback on its own.
  | "paused"
  // Nothing playing on my end.
  | "waiting"
  // Spotify's player couldn't load.
  | "unavailable";

let status: ListenStatus = "off";
// The player's last position report, for the visualizer's clock.
let heard: { uri: string; position: number; at: number } | null = null;
const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

export function setListenStatus(next: ListenStatus) {
  if (next === "off" || next === "preview" || next === "waiting" || next === "unavailable") heard = null;
  if (next === status) return;
  status = next;
  listeners.forEach((l) => l());
}

export function getListenStatus() {
  return status;
}

export function toggleListening() {
  setListenStatus(status === "off" ? "starting" : "off");
}

export function useListenAlong() {
  return useSyncExternalStore(subscribe, () => status, () => "off" as ListenStatus);
}

// Called by the player as it plays a full song (null when it stops).
export function reportHeard(uri: string | null, positionMs = 0) {
  heard = uri ? { uri, position: positionMs, at: performance.now() } : null;
}

// Where the listener's player is in a song right now, in ms, or null if it
// isn't playing that full song.
export function heardPosition(uri: string) {
  if (status !== "playing" || !heard || heard.uri !== uri) return null;
  return heard.position + (performance.now() - heard.at);
}
