// Builds a four-color palette from an album cover: a deep background, two
// mids and a bright accent. It's built around the cover's most vivid hue
// rather than its most common color, so a mostly white cover with hot pink
// type comes out pink, not gray. Covers with no real color take a hue from the
// song's mood instead.

export type RGB = [number, number, number];

function hex(h: string): RGB {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

// Until a cover loads: the site's blue run through violet and pink.
export const DEFAULT_PALETTE: RGB[] = [hex("#070918"), hex("#3b1fa3"), hex("#6ea8fe"), hex("#ff5fa2")];

const BINS = 36;

function hsl(h: number, s: number, l: number): RGB {
  const hue = (((h % 360) + 360) % 360) / 360;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t: number) => {
    t = ((t % 1) + 1) % 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [channel(hue + 1 / 3), channel(hue), channel(hue - 1 / 3)];
}

function toHsl(r: number, g: number, b: number) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (!d) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  return { h: h < 0 ? h + 360 : h, s, l };
}

// Strongest hue in a weighted histogram, refined to the weighted mean of its neighborhood.
function peakHue(hist: Float32Array, sinSum: Float32Array, cosSum: Float32Array, skipNear?: number) {
  let best = -1;
  for (let i = 0; i < BINS; i++) {
    if (skipNear !== undefined) {
      const center = (i + 0.5) * (360 / BINS);
      const gap = Math.abs(((center - skipNear + 540) % 360) - 180);
      if (gap < 45) continue;
    }
    if (best < 0 || hist[i] > hist[best]) best = i;
  }
  if (best < 0) return null;
  let s = 0, c = 0, w = 0;
  for (const k of [best - 1, best, best + 1]) {
    const i = (k + BINS) % BINS;
    s += sinSum[i];
    c += cosSum[i];
    w += hist[i];
  }
  return { hue: (Math.atan2(s, c) * 180) / Math.PI, weight: w };
}

function paletteOf(img: HTMLImageElement, moodHue: number): RGB[] {
  const size = 48;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return DEFAULT_PALETTE;
  ctx.drawImage(img, 0, 0, size, size);
  const px = ctx.getImageData(0, 0, size, size).data;

  const hist = new Float32Array(BINS);
  const sinSum = new Float32Array(BINS);
  const cosSum = new Float32Array(BINS);
  let vivid = 0;
  for (let i = 0; i < px.length; i += 4) {
    const { h, s, l } = toHsl(px[i] / 255, px[i + 1] / 255, px[i + 2] / 255);
    // Chroma: saturated mid-lightness pixels count most, whites and blacks not at all.
    const w = s * (1 - Math.abs(2 * l - 1));
    const weight = w * w;
    const bin = Math.floor((h / 360) * BINS) % BINS;
    hist[bin] += weight;
    sinSum[bin] += weight * Math.sin((h * Math.PI) / 180);
    cosSum[bin] += weight * Math.cos((h * Math.PI) / 180);
    vivid += w;
  }
  vivid /= px.length / 4;

  // Barely any color on the cover: take the hue from the song instead.
  const primary = vivid > 0.02 ? (peakHue(hist, sinSum, cosSum)?.hue ?? moodHue) : moodHue;
  const second = vivid > 0.02 ? peakHue(hist, sinSum, cosSum, primary) : null;
  const total = hist.reduce((a, b) => a + b, 0);
  // A real second color if the cover has one, otherwise a neighbor of the first.
  const secondary = second && second.weight > total * 0.12 ? second.hue : primary - 45;

  return [
    hsl(primary, 0.65, 0.06),
    hsl(primary, 0.8, 0.3),
    hsl(secondary, 0.75, 0.5),
    hsl(primary + 12, 1, 0.68),
  ];
}

// Warm for happy songs (pink through orange), cool for sad ones (violet through teal).
export function moodHue(valence = 0.5) {
  return valence > 0.5 ? 330 + 70 * (valence - 0.5) * 2 : 270 - 70 * (0.5 - valence) * 2;
}

export async function loadCover(url: string, fallbackHue: number) {
  const img = new Image();
  // Spotify's image CDN allows this, so the cover can be read and used as a texture.
  img.crossOrigin = "anonymous";
  img.src = url;
  await img.decode();
  return { img, palette: paletteOf(img, fallbackHue) };
}
