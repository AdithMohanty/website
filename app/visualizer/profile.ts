// Listens to a song's 30-second preview once, in the browser, and boils it
// down to the song's own groove: a precise tempo, where its kicks, snares,
// hats and sustained bass fall across one bar, and its full spectrum at every
// 16th of that bar. Every part is scaled to its own
// range within this song, so a soft hi-hat line or a heavy 808 both register.

import { BANDS, bandLayout, fft, toBands } from "./spectrum";

export const STEPS = 16; // 16th notes in a bar.

export type SongProfile = {
  tempo: number;
  // Onset strength at each 16th of the bar, 0 to 1.
  kick: Float32Array;
  snare: Float32Array;
  hat: Float32Array;
  // How the low end moves through the bar (808 slides, sidechain pumping),
  // stretched to fill 0 to 1.
  sub: Float32Array;
  // How much sustained bass the song carries overall, 0 to 1.
  subLevel: number;
  // Loudness of every band (see spectrum.ts) at each 16th, 0 to 1: STEPS rows of BANDS.
  spectrum: Float32Array;
};

const HOP = 512;

// RBJ cookbook biquad, run over the whole clip.
function biquad(x: Float32Array, sr: number, type: "lowpass" | "bandpass" | "highpass", freq: number, q: number) {
  const w = (2 * Math.PI * freq) / sr;
  const cos = Math.cos(w);
  const alpha = Math.sin(w) / (2 * q);
  let b0: number, b1: number, b2: number;
  if (type === "lowpass") [b0, b1, b2] = [(1 - cos) / 2, 1 - cos, (1 - cos) / 2];
  else if (type === "highpass") [b0, b1, b2] = [(1 + cos) / 2, -(1 + cos), (1 + cos) / 2];
  else [b0, b1, b2] = [alpha, 0, -alpha];
  const a0 = 1 + alpha;
  const a1 = -2 * cos;
  const a2 = 1 - alpha;
  const y = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const out = (b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1;
    x1 = x[i];
    y2 = y1;
    y1 = out;
    y[i] = out;
  }
  return y;
}

// Log loudness per hop.
function envelope(x: Float32Array) {
  const n = Math.floor(x.length / HOP);
  const env = new Float32Array(n);
  for (let f = 0; f < n; f++) {
    let sum = 0;
    for (let i = f * HOP; i < (f + 1) * HOP; i++) sum += x[i] * x[i];
    env[f] = Math.log1p(100 * Math.sqrt(sum / HOP));
  }
  return env;
}

// Rises in loudness: where hits start.
function onsets(env: Float32Array) {
  const out = new Float32Array(env.length);
  for (let i = 2; i < env.length; i++) out[i] = Math.max(0, env[i] - Math.max(env[i - 1], env[i - 2] * 0.98));
  return out;
}

function sampleAt(x: Float32Array, frame: number) {
  const i = Math.floor(frame);
  if (i < 0 || i + 1 >= x.length) return 0;
  const t = frame - i;
  return x[i] * (1 - t) + x[i + 1] * t;
}

// Peak onset near a frame, so hits a hair off the grid still count.
function peakNear(x: Float32Array, frame: number) {
  const i = Math.round(frame);
  let m = 0;
  for (let k = i - 1; k <= i + 1; k++) if (k >= 0 && k < x.length) m = Math.max(m, x[k]);
  return m;
}

// Every band's tilted level over the clip, BANDS per frame, one frame per SPEC_HOP samples.
const SPEC_FFT = 4096;
const SPEC_HOP = 1024;
function spectrogram(x: Float32Array, sr: number) {
  const layout = bandLayout(sr, SPEC_FFT);
  const frames = Math.max(0, Math.floor((x.length - SPEC_FFT) / SPEC_HOP));
  const out = new Float32Array(frames * BANDS);
  const re = new Float32Array(SPEC_FFT);
  const im = new Float32Array(SPEC_FFT);
  const db = new Float32Array(SPEC_FFT / 2);
  const bands = new Float32Array(BANDS);
  const window = Float32Array.from({ length: SPEC_FFT }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / SPEC_FFT));
  for (let f = 0; f < frames; f++) {
    for (let i = 0; i < SPEC_FFT; i++) re[i] = x[f * SPEC_HOP + i] * window[i];
    im.fill(0);
    fft(re, im);
    for (let k = 0; k < db.length; k++) db[k] = 10 * Math.log10(re[k] * re[k] + im[k] * im[k] + 1e-12);
    toBands(db, layout, bands);
    out.set(bands, f * BANDS);
  }
  return out;
}

// Fold the spectrogram onto the 16 steps of a bar, between this song's quiet
// and loud. Each band's own movement through the bar is drawn out a little, so
// a pad that barely changes still shows, but a hit in it stands out.
function foldSpectrum(spec: Float32Array, startFrame: number, stepFrames: number) {
  const frames = spec.length / BANDS;
  // Envelope frames (HOP) to spectrogram frames (SPEC_HOP), centered on the window.
  const toSpec = (f: number) => (f * HOP - SPEC_FFT / 2) / SPEC_HOP;
  const sums = new Float32Array(STEPS * BANDS);
  const counts = new Float32Array(STEPS);
  for (let s = 0, f = startFrame; ; s++, f += stepFrames) {
    const a = Math.max(0, Math.round(toSpec(f)));
    const b = Math.min(frames, Math.max(a + 1, Math.round(toSpec(f + stepFrames))));
    if (a >= frames) break;
    for (let i = a; i < b; i++) for (let k = 0; k < BANDS; k++) sums[(s % STEPS) * BANDS + k] += spec[i * BANDS + k] / (b - a);
    counts[s % STEPS]++;
  }
  const lo = percentile(spec, 0.2);
  const hi = percentile(spec, 0.995);
  const out = sums.map((v, i) => {
    const n = counts[Math.floor(i / BANDS)];
    return n ? Math.min(1, Math.max(0, (v / n - lo) / (hi - lo + 1e-6))) : 0;
  });
  for (let k = 0; k < BANDS; k++) {
    let min = 1;
    let max = 0;
    for (let s = 0; s < STEPS; s++) {
      min = Math.min(min, out[s * BANDS + k]);
      max = Math.max(max, out[s * BANDS + k]);
    }
    for (let s = 0; s < STEPS; s++) {
      const v = out[s * BANDS + k];
      out[s * BANDS + k] = v * (0.55 + (0.45 * (v - min)) / (max - min + 0.05));
    }
  }
  return out;
}

function percentile(x: Float32Array, p: number) {
  const sorted = Float32Array.from(x).sort();
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
}

// How well a tempo's beat grid lines up with the hits, and where it starts.
function fitGrid(onset: Float32Array, fps: number, bpm: number) {
  const period = (60 / bpm) * fps;
  let best = { score: -1, phase: 0 };
  for (let phase = 0; phase < period; phase += 0.25) {
    let score = 0;
    for (let f = phase; f < onset.length; f += period) score += sampleAt(onset, f);
    if (score > best.score) best = { score, phase };
  }
  return best;
}

function findTempo(onset: Float32Array, fps: number, hint?: number) {
  // With a hint, search finely around it (and its double and half); otherwise sweep.
  const centers = hint ? [hint, hint * 2, hint / 2].filter((t) => t >= 60 && t <= 200) : [];
  const candidates: number[] = [];
  if (centers.length) {
    for (const c of centers) for (let t = c * 0.97; t <= c * 1.03; t += 0.05) candidates.push(t);
  } else {
    for (let t = 70; t <= 180; t += 0.25) candidates.push(t);
  }
  // Slower tempos fit more phases by luck; favor the hint's octave a little.
  let best = { bpm: hint ?? 120, score: -1, phase: 0 };
  for (const bpm of candidates) {
    const fit = fitGrid(onset, fps, bpm);
    const bias = hint && Math.abs(bpm / hint - 1) < 0.04 ? 1.05 : 1;
    const score = fit.score * bias * Math.sqrt(bpm / 120);
    if (score > best.score) best = { bpm, score, phase: fit.phase };
  }
  // Produced music is nearly always a whole number of BPM.
  const whole = Math.round(best.bpm);
  if (Math.abs(whole - best.bpm) < 0.15) {
    const fit = fitGrid(onset, fps, whole);
    if (fit.score * Math.sqrt(whole / 120) >= best.score * 0.97) best = { ...best, bpm: whole, phase: fit.phase };
  }
  return best;
}

// Fold a band's hits onto the 16 steps of a bar, scaled to the song's own range.
// Bands with nothing landing on the grid (no real pattern) fade out.
function foldPattern(onset: Float32Array, startFrame: number, stepFrames: number) {
  const sums = new Float32Array(STEPS);
  const counts = new Float32Array(STEPS);
  for (let s = 0, f = startFrame; f < onset.length - 1; s++, f += stepFrames) {
    sums[s % STEPS] += peakNear(onset, f);
    counts[s % STEPS]++;
  }
  const pattern = sums.map((v, i) => (counts[i] ? v / counts[i] : 0));
  let mean = 0;
  for (const v of onset) mean += v;
  mean /= onset.length || 1;
  const max = Math.max(...pattern);
  if (!max) return pattern;
  // How far the strongest step stands out from the band's average.
  const presence = Math.min(1, Math.max(0, (max / (mean + 1e-6) - 1.3) / 2));
  return pattern.map((v) => {
    const n = v / max;
    return n * n * (0.25 + 0.75 * presence);
  });
}

export async function analyzePreview(audio: ArrayBuffer, tempoHint?: number): Promise<SongProfile> {
  const decoded = await new OfflineAudioContext(1, 1, 44100).decodeAudioData(audio);
  const sr = decoded.sampleRate;
  const mono = new Float32Array(decoded.length);
  for (let c = 0; c < decoded.numberOfChannels; c++) {
    const data = decoded.getChannelData(c);
    for (let i = 0; i < data.length; i++) mono[i] += data[i] / decoded.numberOfChannels;
  }
  const fps = sr / HOP;

  const lowEnv = envelope(biquad(mono, sr, "lowpass", 120, 0.7));
  const midEnv = envelope(biquad(mono, sr, "bandpass", 1800, 0.8));
  const highEnv = envelope(biquad(mono, sr, "highpass", 7000, 0.7));
  const kickOn = onsets(lowEnv);
  const snareOn = onsets(midEnv);
  const hatOn = onsets(highEnv);

  const all = kickOn.map((v, i) => v * 1.4 + snareOn[i] + hatOn[i] * 0.6);
  const { bpm } = findTempo(all, fps, tempoHint);
  const stepFrames = ((60 / bpm) * fps) / 4;
  // Line the grid up on the drums that sit on the beat. Offbeat hats would pull it a 16th off.
  const { phase } = fitGrid(kickOn.map((v, i) => v + 0.3 * snareOn[i]), fps, bpm);

  // The grid's beat 1 is ambiguous within the bar: pick the rotation that puts
  // kicks on 1 and 3 and snares on 2 and 4, like most music.
  let start = phase;
  let bestScore = -Infinity;
  for (let r = 0; r < 4; r++) {
    const s = phase + r * 4 * stepFrames;
    const k = foldPattern(kickOn, s, stepFrames);
    const n = foldPattern(snareOn, s, stepFrames);
    const score = k[0] * 2 + k[8] - k[4] - k[12] + n[4] + n[12] - n[0];
    if (score > bestScore) {
      bestScore = score;
      start = s;
    }
  }

  // Sustained bass: the low band's level at each step, between this song's quiet and loud.
  const lo = percentile(lowEnv, 0.05);
  const hi = percentile(lowEnv, 0.98);
  const subSums = new Float32Array(STEPS);
  const subCounts = new Float32Array(STEPS);
  for (let s = 0, f = start; f < lowEnv.length - 1; s++, f += stepFrames) {
    subSums[s % STEPS] += Math.min(1, Math.max(0, (sampleAt(lowEnv, f + stepFrames / 2) - lo) / (hi - lo + 1e-6)));
    subCounts[s % STEPS]++;
  }

  const sub = subSums.map((v, i) => (subCounts[i] ? v / subCounts[i] : 0));
  const subMin = Math.min(...sub);
  const subMax = Math.max(...sub);
  // Bass loudness against the whole mix, so bass-heavy songs weigh more.
  const fullEnv = envelope(mono);
  // Measured ratios run about 0.6 (light) to 0.9 (808-heavy).
  const ratio = percentile(lowEnv, 0.6) / (percentile(fullEnv, 0.6) + 1e-6);
  const subLevel = Math.min(1, Math.max(0, (ratio - 0.6) / 0.3));

  return {
    tempo: bpm,
    kick: foldPattern(kickOn, start, stepFrames),
    snare: foldPattern(snareOn, start, stepFrames),
    hat: foldPattern(hatOn, start, stepFrames),
    sub: sub.map((v) => (subMax - subMin > 0.05 ? (v - subMin) / (subMax - subMin) : 0.5)),
    subLevel,
    spectrum: foldSpectrum(spectrogram(mono, sr), start, stepFrames),
  };
}

// Without a preview: a plain groove from the song's tempo and feel.
export function genericProfile(tempo: number, danceability: number, energy: number): SongProfile {
  const kick = new Float32Array(STEPS);
  const snare = new Float32Array(STEPS);
  const hat = new Float32Array(STEPS);
  const sub = new Float32Array(STEPS).fill(0.5);
  for (let s = 0; s < STEPS; s += 4) kick[s] = danceability > 0.55 || s % 8 === 0 ? 1 : 0;
  snare[4] = snare[12] = 1;
  for (let s = 0; s < STEPS; s++) hat[s] = s % 2 === 0 ? 0.8 * danceability : energy > 0.65 ? 0.4 * danceability : 0;
  // A rough spectrum from the pattern: kicks in the lows, snares in the mids, hats up top.
  const spectrum = new Float32Array(STEPS * BANDS);
  for (let s = 0; s < STEPS; s++) {
    for (let k = 0; k < BANDS; k++) {
      const x = k / (BANDS - 1);
      const hit = kick[s] * Math.exp(-((x / 0.15) ** 2)) + snare[s] * Math.exp(-(((x - 0.5) / 0.15) ** 2)) + hat[s] * Math.exp(-(((x - 0.85) / 0.12) ** 2));
      spectrum[s * BANDS + k] = Math.min(1, 0.25 + 0.15 * energy + 0.6 * hit);
    }
  }
  return { tempo, kick, snare, hat, sub, subLevel: 0.3 + 0.4 * energy, spectrum };
}
