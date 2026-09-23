import { lookupPlace, placeName } from "./places.mjs";
import { getValue, setValue } from "./store";

// Only the city and coordinates rounded to ~10 km are stored.

const KEY = "location";

type StoredLocation = {
  city: string;
  region?: string;
  country?: string;
  countryCode?: string;
  lat: number;
  lon: number;
  updatedAt: string;
};

export type PublicLocation =
  | { known: false }
  | {
      known: true;
      place: string;
      city: string;
      region?: string;
      country?: string;
      timezone?: string;
      tempF?: number;
      condition?: string;
      updatedAt: string;
    };

function coarse(n: number) {
  return Math.round(n * 10) / 10;
}

function clean(v: unknown, max = 80) {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

// State and country come from the coordinates, so the phone only has to send
// city, lat and lon.
export async function saveLocation(body: Record<string, unknown>) {
  const city = clean(body.city);
  const lat = Number(body.lat ?? body.latitude);
  const lon = Number(body.lon ?? body.longitude);
  if (!city || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new Error("Send city, lat and lon.");
  }
  const found = await lookupPlace(lat, lon);
  const loc: StoredLocation = {
    city,
    region: found.region ?? (clean(body.region ?? body.state) || undefined),
    country: found.country ?? (clean(body.country) || undefined),
    countryCode: found.countryCode,
    lat: coarse(lat),
    lon: coarse(lon),
    updatedAt: new Date().toISOString(),
  };
  await setValue(KEY, loc);
  return loc;
}

// Open-Meteo (WMO) weather codes.
function describe(code: number) {
  if (code === 0) return "clear";
  if (code <= 2) return "partly cloudy";
  if (code === 3) return "cloudy";
  if (code <= 48) return "foggy";
  if (code <= 57) return "drizzly";
  if (code <= 67) return "rainy";
  if (code <= 77) return "snowy";
  if (code <= 82) return "rainy";
  if (code <= 86) return "snowy";
  return "stormy";
}

type Weather = { timezone: string; tempF: number; condition: string };
let weatherCache: { key: string; at: number; data: Weather } | null = null;
const WEATHER_TTL = 10 * 60 * 1000;

async function getWeather(lat: number, lon: number): Promise<Weather | null> {
  const key = `${lat},${lon}`;
  if (weatherCache?.key === key && Date.now() - weatherCache.at < WEATHER_TTL) {
    return weatherCache.data;
  }
  const res = await fetch(
    "https://api.open-meteo.com/v1/forecast?" +
      new URLSearchParams({
        latitude: String(lat),
        longitude: String(lon),
        current: "temperature_2m,weather_code",
        temperature_unit: "fahrenheit",
        timezone: "auto",
      }),
    { cache: "no-store" }
  );
  if (!res.ok) return null;
  const json = (await res.json()) as {
    timezone: string;
    current: { temperature_2m: number; weather_code: number };
  };
  const data = {
    timezone: json.timezone,
    tempF: Math.round(json.current.temperature_2m),
    condition: describe(json.current.weather_code),
  };
  weatherCache = { key, at: Date.now(), data };
  return data;
}

export async function getPublicLocation(): Promise<PublicLocation> {
  const loc = await getValue<StoredLocation>(KEY);
  if (!loc) return { known: false };
  const weather = await getWeather(loc.lat, loc.lon).catch(() => null);
  return {
    known: true,
    place: placeName(loc),
    city: loc.city,
    region: loc.region,
    country: loc.country,
    updatedAt: loc.updatedAt,
    ...weather,
  };
}
