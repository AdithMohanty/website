"use client";

import { useEffect, useState } from "react";
import type { PublicLocation } from "@/lib/location";

const POLL_MS = 10 * 60_000;

export default function CurrentLocation() {
  const [loc, setLoc] = useState<PublicLocation | null>(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const res = await fetch("/api/location", { cache: "no-store" });
        const json = (await res.json()) as PublicLocation;
        if (alive) setLoc(json);
      } catch {}
    }
    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  if (!loc?.known) return null;

  const weather =
    loc.tempF !== undefined
      ? `, where it's ${loc.tempF}°F${loc.condition ? ` and ${loc.condition}` : ""}`
      : "";

  return (
    <p className="current-location">
      I am currently in <strong>{loc.place}</strong>
      {weather}.
    </p>
  );
}
