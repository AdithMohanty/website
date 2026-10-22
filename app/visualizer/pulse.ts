import type { SongFeatures } from "@/lib/spotify";
import { STEPS, type SongProfile } from "./profile";
import { BANDS } from "./spectrum";

// Turns where the song is right now into what the liquid moves to, using the
// song's own groove (from its preview) laid over its beat grid. No audio is
// heard live: it plays the song's pattern in step with Spotify's position.
//
// Each part of the groove drives something different:
//   kick                  punches the center blob
//   sustained bass / 808  sizes the center blob and the glow
//   snare / clap          sends a ripple across
//   mids / hi-hats        swell the smaller blobs; hats sparkle
//   downbeats             lean the camera on each bar
//   16-bar phrases        build over the last four bars, then drop
//   the song's shape      eases in over the intro and settles over the outro
//   a new song            bursts out as its cover fades in
//   every frequency band  its own ring on the center blob, bar in the halo
//                         and specks in the dust

export type Levels = {
  bass: number;
  mid: number;
  high: number;
  energy: number;
  kick: number;
  snare: number;
  // 0 to 1 over the last four bars of a phrase.
  build: number;
  // Flash at the top of each phrase.
  drop: number;
  // Accent at the top of each bar.
  downbeat: number;
  // Beats elapsed, for motion that moves at the song's tempo. Accumulated
  // rather than read from the position, so song changes don't make it jump.
  beat: number;
  // Like beat, but half as fast for fast songs, so the drifting motion
  // follows the feel rather than racing.
  groove: number;
  // How much the scene sways along: the song's danceability.
  swing: number;
  // Burst when the song changes, fading over a second or so.
  change: number;
  // Tint shift, in radians of hue.
  hue: number;
  // Overall brightness, from the song's mood.
  glow: number;
  // Every band (see spectrum.ts), 0 to 1.
  spectrum: Float32Array;
};

const PHRASE_BARS = 16;
// How long each hit rings, in seconds.
const DECAY = { kick: 0.11, snare: 0.15, hat: 0.045 };

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const frac = (x: number) => x - Math.floor(x);

// A hit's level now: the strongest of the last few steps, faded by how long ago it landed.
function ring(pattern: Float32Array, step: number, stepPhase: number, stepSec: number, decay: number) {
  let level = 0;
  for (let k = 0; k < 4; k++) {
    const v = pattern[(((step - k) % STEPS) + STEPS) % STEPS];
    if (v) level = Math.max(level, v * Math.exp(-((k + stepPhase) * stepSec) / decay));
  }
  return level;
}

export class SongPulse {
  levels: Levels = {
    bass: 0, mid: 0, high: 0, energy: 0, kick: 0, snare: 0, build: 0, drop: 0, downbeat: 0,
    beat: 0, groove: 0, swing: 0.5, change: 0, hue: 0, glow: 1, spectrum: new Float32Array(BANDS),
  };
  private songId: string | null = null;
  // Where each band is headed this frame.
  private target = new Float32Array(BANDS);

  // dt in seconds, now in ms, positionMs null when nothing is playing.
  update(
    dt: number,
    now: number,
    positionMs: number | null,
    profile: SongProfile | null,
    f?: SongFeatures,
    song?: { id: string | null; durationMs: number },
  ): Levels {
    this.follow(dt, now, positionMs, profile, f, song);
    const L = this.levels;
    const ease = (from: number, to: number, rate: number) => from + (to - from) * (1 - Math.exp(-dt * rate));

    // Bands jump up with a sound and fall back a little slower.
    for (let b = 0; b < BANDS; b++) {
      const v = L.spectrum[b];
      L.spectrum[b] = ease(v, this.target[b], this.target[b] > v ? 45 : 9);
    }
    return L;
  }

  private follow(
    dt: number,
    now: number,
    positionMs: number | null,
    profile: SongProfile | null,
    f?: SongFeatures,
    song?: { id: string | null; durationMs: number },
  ) {
    const L = this.levels;
    const ease = (from: number, to: number, rate: number) => from + (to - from) * (1 - Math.exp(-dt * rate));

    // The first song after loading fades in on its own; later ones burst.
    const id = song?.id ?? null;
    if (id && id !== this.songId) {
      if (this.songId) L.change = 1;
      this.songId = id;
    }
    L.change *= Math.exp(-dt / 0.6);

    if (positionMs === null || !profile) {
      // Nothing to follow: a slow breath so the liquid still drifts.
      // (Playing while the song's groove loads breathes a little livelier.)
      const s = now / 1000;
      const lift = positionMs === null ? 0 : 0.15;
      for (const k of ["kick", "snare", "drop", "build", "downbeat"] as const) L[k] = ease(L[k], 0, 5);
      L.bass = ease(L.bass, 0.3 + lift + 0.15 * Math.sin(s * 0.7), 2);
      L.mid = ease(L.mid, 0.3 + lift + 0.12 * Math.sin(s * 0.43 + 1), 2);
      L.high = ease(L.high, 0.15 + lift, 2);
      L.energy = L.bass * 0.5 + L.mid * 0.35 + L.high * 0.15;
      L.beat += dt * 0.5;
      L.groove += dt * 0.5;
      L.swing = ease(L.swing, 0.3, 1);
      L.hue = ease(L.hue, 0, 0.5);
      L.glow = ease(L.glow, 1, 1);
      for (let b = 0; b < BANDS; b++) this.target[b] = 0.12 + 0.05 * Math.sin(s * 0.8 + b * 0.4);
      return;
    }

    const energy = f?.energy ?? 0.65;
    const valence = f?.valence ?? 0.5;
    // The song's shape: intros ease in over their first ten seconds or so,
    // and the last stretch settles as the song winds down.
    const duration = song?.durationMs ?? 0;
    const intro = 0.6 + 0.4 * smoothstep(0, 10_000, positionMs);
    const outro = duration > 30_000 ? 1 - 0.35 * smoothstep(duration - 15_000, duration, positionMs) : 1;
    // Calm, acoustic songs move less.
    const drive = (0.55 + 0.45 * energy * (1 - 0.5 * (f?.acousticness ?? 0))) * intro * outro;

    const beats = (positionMs / 60_000) * profile.tempo;
    const steps = beats * 4;
    const step = Math.floor(steps) % STEPS;
    const stepPhase = frac(steps);
    const stepSec = 15 / profile.tempo;
    const bars = beats / 4;

    // Hits swell in over ~25 ms instead of jumping in one frame, then follow
    // their decay exactly.
    const kick = ring(profile.kick, step, stepPhase, stepSec, DECAY.kick) * drive;
    const snare = ring(profile.snare, step, stepPhase, stepSec, DECAY.snare) * drive;
    L.kick = kick > L.kick ? ease(L.kick, kick, 40) : kick;
    L.snare = snare > L.snare ? ease(L.snare, snare, 40) : snare;
    const hat = ring(profile.hat, step, stepPhase, stepSec, DECAY.hat);
    // The bass line glides between steps rather than jumping.
    const sub = profile.sub[step] + (profile.sub[(step + 1) % STEPS] - profile.sub[step]) * stepPhase;

    // Phrases: build through the last four bars, drop at the top of the next.
    L.build = smoothstep(0.75, 1, (bars % PHRASE_BARS) / PHRASE_BARS) * drive;
    L.drop = bars > 2 ? drive * Math.exp(-(bars % PHRASE_BARS) * 3) : 0;
    // Beat 1 of every bar, ringing for about a quarter second.
    L.downbeat = drive * Math.exp(-(frac(bars) * 4 * 60) / profile.tempo / 0.25);

    // Bass-heavy songs sit heavier all the way through, and the 808 moves on top.
    const bass = profile.subLevel * (0.45 + 0.35 * sub) + 0.6 * L.kick;
    L.bass = ease(L.bass, Math.min(1.2, 0.15 + bass + 0.25 * L.drop), 30);
    L.mid = ease(L.mid, 0.2 + 0.45 * L.snare + 0.2 * valence, 20);
    L.high = ease(L.high, 0.06 + 0.7 * hat * drive + 0.3 * L.build, 40);
    L.energy = ease(L.energy, 0.2 + 0.5 * drive + 0.25 * profile.subLevel + 0.4 * L.build, 3);

    L.beat += dt * (profile.tempo / 60);
    L.groove += dt * ((profile.tempo > 150 ? profile.tempo / 2 : profile.tempo) / 60);
    L.swing = ease(L.swing, f?.danceability ?? 0.6, 1);
    // Tint steps every four bars; happier songs wander further.
    const tint = Math.floor(bars / 4) % 4;
    L.hue = ease(L.hue, (tint - 1.5) * (0.12 + 0.18 * valence), 1.5);
    // Minor keys sit a little darker.
    L.glow = ease(L.glow, 0.9 + 0.1 * (f?.mode ?? 1) + 0.1 * valence, 1);

    // The song's spectrum at this 16th, holding through most of the step and
    // gliding into the next.
    const spec = profile.spectrum;
    const row = step * BANDS;
    const next = ((step + 1) % STEPS) * BANDS;
    const glide = stepPhase * stepPhase;
    for (let b = 0; b < BANDS; b++) {
      this.target[b] = (spec[row + b] + (spec[next + b] - spec[row + b]) * glide) * (0.5 + 0.5 * drive);
    }
  }
}
