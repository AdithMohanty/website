// Splits sound into bands spaced the way we hear pitch (evenly per octave),
// from the deepest sub-bass up to the air above the cymbals.

export const BANDS = 32;
const LOW_HZ = 35;
const HIGH_HZ = 16_000;
// Music carries far more energy low down (about 3 dB less per octave up):
// tilt most of that back, so hats register clearly while the kick still leads.
const TILT_DB_PER_OCTAVE = 2.5;

// Band i covers EDGES[i]..EDGES[i + 1] Hz.
const EDGES = Array.from({ length: BANDS + 1 }, (_, i) => LOW_HZ * (HIGH_HZ / LOW_HZ) ** (i / BANDS));

// The FFT bins each band averages over, at least one per band, and its tilt.
export function bandLayout(sampleRate: number, fftSize: number) {
  const binHz = sampleRate / fftSize;
  const last = fftSize / 2 - 1;
  return Array.from({ length: BANDS }, (_, i) => {
    const lo = Math.min(last, Math.max(1, Math.floor(EDGES[i] / binHz)));
    const hi = Math.min(last + 1, Math.max(lo + 1, Math.floor(EDGES[i + 1] / binHz)));
    const center = Math.sqrt(EDGES[i] * EDGES[i + 1]);
    return { lo, hi, tilt: TILT_DB_PER_OCTAVE * Math.log2(center / 1000) };
  });
}

export type BandLayout = ReturnType<typeof bandLayout>;

// A power spectrum in dB per bin, down to tilted dB per band.
export function toBands(db: Float32Array, layout: BandLayout, out: Float32Array) {
  for (let b = 0; b < BANDS; b++) {
    const { lo, hi, tilt } = layout[b];
    let power = 0;
    for (let k = lo; k < hi; k++) power += 10 ** (db[k] / 10);
    out[b] = 10 * Math.log10(power / (hi - lo) + 1e-12) + tilt;
  }
}

// In-place radix-2 FFT; re and im are the same power-of-two length.
export function fft(re: Float32Array, im: Float32Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci;
        const ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
        const next = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = next;
      }
    }
  }
}
