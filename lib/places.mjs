// Coordinates -> "Berkeley, CA" in the US, "Banff, Canada" elsewhere.
// Plain JS so both the site and scripts/gallery.mjs can use it.

/**
 * @typedef {{ city?: string, region?: string, country?: string, countryCode?: string }} Place
 */

/**
 * Reverse-geocode with OpenStreetMap's Nominatim. Coordinates are rounded to
 * ~1 km before they leave the machine.
 * @param {number} lat
 * @param {number} lon
 * @returns {Promise<Place>}
 */
export async function lookupPlace(lat, lon) {
  try {
    const res = await fetch(
      "https://nominatim.openstreetmap.org/reverse?" +
        new URLSearchParams({
          lat: (Math.round(lat * 100) / 100).toString(),
          lon: (Math.round(lon * 100) / 100).toString(),
          format: "jsonv2",
          zoom: "14",
        }),
      {
        headers: { "User-Agent": "adithmohanty.com", "Accept-Language": "en" },
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      }
    );
    if (!res.ok) return {};
    /** @type {{ address?: Record<string, string> }} */
    const { address = {} } = await res.json();
    const countryCode = address.country_code?.toLowerCase();
    const town =
      address.city ?? address.town ?? address.village ?? address.hamlet ?? address.municipality;
    return {
      // Out in nature there's no town: fall back to the county (US) or province.
      city: town ?? (countryCode === "us" ? address.county : address.state),
      // e.g. "US-CA" -> "CA"
      region: countryCode === "us" ? address["ISO3166-2-lvl4"]?.split("-")[1] : address.state,
      country: address.country,
      countryCode,
    };
  } catch {
    return {};
  }
}

/**
 * @param {Place} place
 * @returns {string}
 */
export function placeName({ city, region, country, countryCode }) {
  const other = countryCode === "us" ? region : country;
  if (!city) return other ?? "";
  return other && other !== city ? `${city}, ${other}` : city;
}
