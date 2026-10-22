import * as THREE from "three/webgpu";
import {
  abs, atan, cross, dot, exp, float, floor, Fn, hash, hue, instanceIndex, int, length, mix, mx_fractal_noise_float,
  mx_noise_float, normalGeometry, sRGBTransferEOTF, sRGBTransferOETF, normalize, pass, positionViewDirection, pow, screenCoordinate, screenUV, select,
  sin, smoothstep, cos, sqrt, texture, transformNormalToView, uniform, uniformArray, uv, varying, vec2, vec3, vec4, PI2,
} from "three/tsl";
import { bloom } from "three/addons/tsl/display/BloomNode.js";
import { chromaticAberration } from "three/addons/tsl/display/ChromaticAberrationNode.js";
import type { Levels } from "./pulse";
import { BANDS } from "./spectrum";

// Glossy liquid blobs floating in front of a flowing, warped liquid, built
// entirely from three.js: node materials, a real 3D scene and a post-processing
// pipeline. It draws through WebGPU where the browser has it and WebGL 2
// otherwise. Each part of the song has a job you can see:
//   kick          punches the center blob and pushes the camera in
//   bass / 808    deepens the liquid's warp, sizes and wobbles the blobs
//   snare         sends a shockwave ring and a ripple across the liquid
//   mids          swell the orbiting blobs
//   hats          sparkle the dust and sharpen the highlights on the glass
//   downbeats     sway the camera on each bar
//   build-ups     pull everything in; drops burst it out with a flash
//   song change   a burst of dust and a hue spin as the new cover fades in
//   every band    bass at the bottom to treble at the top, everywhere: a bar
//                 in the halo, a ring of ripples on the center blob (finer
//                 for higher bands) and a layer of the dust
//
// The liquid is all noise and nearly all of the cost, but it's soft, so it
// renders into a small target and is stretched up. The blobs refract it.

// Liquid resolution relative to the canvas.
const BACKGROUND_SCALE = 0.4;
const SATELLITES = 5;
const DUST = 700;

export type Frame = { time: number; levels: Levels; palette: Float32Array; melt: number };

// Blob 0 is the kick; 1-3 swell with the mids, 4-5 with the hats. They drift
// on figure-eight paths at the song's pace (one loop every 16 bars), weaving
// in depth, gather in build-ups and fling out on drops. xyz center, w radius.
function placeBlobs(out: Float32Array, time: number, l: Levels) {
  out[0] = 0.08 * Math.sin(time * 0.7);
  out[1] = 0.08 * Math.cos(time * 0.5);
  out[2] = 0;
  out[3] = 0.42 + 0.16 * l.bass + 0.16 * l.kick + 0.06 * l.downbeat;
  const spread = 1.15 * (1 - 0.5 * l.build) + 0.8 * l.drop + 0.5 * l.change;
  const b = (l.groove * Math.PI * 2) / 64;
  for (let i = 1; i <= SATELLITES; i++) {
    const base = 0.13 + 0.04 * Math.sin(i * 3.1);
    out[i * 4] = spread * 1.3 * Math.sin(b + i * 1.7);
    out[i * 4 + 1] = spread * Math.sin(2 * b + i * 2.9);
    out[i * 4 + 2] = 0.6 * spread * Math.cos(b + i * 2.3);
    out[i * 4 + 3] = i < 4 ? base + 0.1 * l.mid + 0.05 * l.snare : base + 0.1 * l.high;
  }
}

// A 1x1 black stand-in until the first cover loads.
function blank() {
  const tex = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
  tex.needsUpdate = true;
  return tex;
}

export class LiquidRenderer {
  private renderer: THREE.WebGPURenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
  private pipeline: THREE.RenderPipeline;
  private liquidQuad: THREE.QuadMesh;
  private liquidTarget: THREE.RenderTarget;
  private center: THREE.Mesh;
  private satellites: THREE.InstancedMesh;
  private ring: THREE.Mesh;
  private dust: THREE.InstancedMesh;
  private halo = new THREE.Group();
  private bars: THREE.InstancedMesh;
  private quat = new THREE.Quaternion();
  private pos = new THREE.Vector3();
  private scl = new THREE.Vector3();
  private zAxis = new THREE.Vector3(0, 0, 1);
  private keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
  private accentLight = new THREE.PointLight(0xffffff, 0, 12, 1.5);
  private fillLight = new THREE.PointLight(0xffffff, 0, 12, 1.5);
  // [previous cover, current cover], crossfaded on song change.
  private art: [THREE.Texture, THREE.Texture] = [blank(), blank()];
  private artNodes = this.art.map((t) => texture(t));
  private artFade = 1;
  private blobs = new Float32Array((SATELLITES + 1) * 4);
  private matrix = new THREE.Matrix4();
  private size = new THREE.Vector2();

  // Everything the node graphs read, set once per frame.
  private u = {
    time: uniform(0),
    bass: uniform(0),
    mid: uniform(0),
    high: uniform(0),
    kick: uniform(0),
    snare: uniform(0),
    build: uniform(0),
    drop: uniform(0),
    beat: uniform(0),
    hue: uniform(0),
    glow: uniform(1),
    change: uniform(0),
    melt: uniform(0),
    artFade: uniform(1),
    aberration: uniform(0),
    // Stretches screen UVs so the shorter side spans -0.5..0.5.
    aspect: uniform(new THREE.Vector2(1, 1)),
    texel: uniform(new THREE.Vector2(1, 1)),
    // The palette in linear color for lighting, and as picked (sRGB) for the
    // liquid, which blends its colors the way the eye sees them.
    pal: [0, 1, 2, 3].map(() => uniform(new THREE.Color())),
    spectrum: uniformArray(new Array<number>(BANDS).fill(0), "float"),
    srgb: [0, 1, 2, 3].map(() => uniform(new THREE.Color())),
  };
  private bloomPass: ReturnType<typeof bloom>;

  static async create(canvas: HTMLCanvasElement) {
    const r = new LiquidRenderer(canvas);
    await r.renderer.init();
    return r;
  }

  private constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGPURenderer({ canvas, antialias: false, powerPreference: "low-power" });
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    const u = this.u;
    const [, , pal2, pal3] = u.pal;
    const [srgb0, srgb1, srgb2, srgb3] = u.srgb;
    const centered = (p: ReturnType<typeof vec2>) => p.sub(0.5).mul(u.aspect);

    // Pass 1: the liquid (or the cover, in melt). Noise fed through noise a
    // few times over. Writes the color, plus the surface height in alpha so
    // it can be lit smoothly after it's stretched up.
    this.liquidTarget = new THREE.RenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
    const [artA, artB] = this.artNodes;
    const liquidMaterial = new THREE.MeshBasicNodeMaterial();
    liquidMaterial.fragmentNode = Fn(() => {
      const fbm = (p: ReturnType<typeof vec2>, octaves: number) => mx_fractal_noise_float(p, octaves, 2.03, 0.48, 0.8);
      const uvc = centered(screenUV);
      const p = uvc.mul(1.2);
      const t = u.time;
      const warp = float(1.2).add(u.bass.mul(1.8)).add(u.kick.mul(0.6)).add(u.build).add(u.drop.mul(0.8));
      // The warp layers only need broad shapes, so they skip the finest octave.
      const q = vec2(fbm(p.add(vec2(0, t.mul(0.31))), 3), fbm(p.add(vec2(5.2, 1.3)).sub(vec2(t.mul(0.27), 0)), 3));
      const r = vec2(
        fbm(p.add(q.mul(warp)).add(vec2(1.7, 9.2)).add(t.mul(0.15)), 3),
        fbm(p.add(q.mul(warp)).add(vec2(8.3, 2.8)).sub(t.mul(0.126)), 3),
      );
      const f = fbm(p.add(r.mul(warp)), 4);
      const fn = f.mul(1.5).add(0.5).clamp(0, 1);
      const col = mix(srgb0, srgb1, smoothstep(0.05, 0.7, fn)).toVar();
      col.assign(mix(col, srgb2, smoothstep(0.1, 0.7, length(q).mul(2.2))));
      col.assign(mix(col, srgb3, smoothstep(0.25, 0.8, abs(r.y).mul(2.6)).mul(u.mid.mul(0.35).add(0.45))));
      const st = uvc.mul(vec2(0.85, -0.85)).add(0.5).add(r.mul(u.bass.mul(0.22).add(0.18)));
      const art = vec3(sRGBTransferOETF(mix(artA.sample(st).rgb, artB.sample(st).rgb, u.artFade)));
      col.assign(mix(col, art.mul(fn.mul(0.35).add(0.75)), u.melt));
      return vec4(col, f.mul(1.2).add(0.5));
    })();
    this.liquidQuad = new THREE.QuadMesh(liquidMaterial);

    // The liquid at a screen point, lit so it reads as a wet surface. The
    // slope comes from neighboring texels of the stretched-up height, which
    // keeps the sheen smooth.
    const liquid = texture(this.liquidTarget.texture);
    const litLiquid = Fn(([st]: [ReturnType<typeof vec2>]) => {
      const c = liquid.sample(st);
      const hx = liquid.sample(st.add(vec2(u.texel.x, 0))).a;
      const hy = liquid.sample(st.add(vec2(0, u.texel.y))).a;
      const grad = vec2(hx.sub(c.a), hy.sub(c.a)).div(u.texel.mul(u.aspect));
      const n = normalize(vec3(grad.mul(-0.1), 1));
      const L = normalize(vec3(-0.45, 0.6, 0.75));
      const diff = dot(n, L).clamp(0, 1);
      const spec = pow(dot(n, normalize(L.add(vec3(0, 0, 1)))).clamp(0, 1), 36);
      const col = c.rgb.mul(diff.mul(0.4).add(0.68)).toVar();
      col.addAssign(mix(vec3(1), srgb3, 0.35).mul(spec.mul(u.high.mul(0.6).add(0.1))));
      // Thin-film color on the slopes, stronger with the hats.
      const phase = vec3(0, 0.33, 0.67).add(c.a.add(n.x.mul(0.35)).add(u.time.mul(0.04))).mul(PI2);
      const film = vec3(cos(phase.x), cos(phase.y), cos(phase.z)).mul(0.5).add(0.5);
      col.addAssign(film.mul(u.high.mul(0.12).add(0.03)).mul(diff.mul(-0.5).add(1)));
      return vec3(sRGBTransferEOTF(col.mul(u.bass.mul(0.3).add(0.7))));
    });

    // Kicks push the liquid out from the middle; snares send a ripple out as the hit fades.
    this.scene.backgroundNode = Fn(() => {
      const uvc = centered(screenUV).toVar();
      const d = length(uvc);
      uvc.mulAssign(float(1).sub(u.kick.mul(0.12).mul(exp(d.mul(-2.2)))).sub(u.drop.mul(0.05)));
      const rr = float(1).sub(u.snare).mul(1.1);
      const wave = sin(d.sub(rr).mul(38)).mul(exp(d.sub(rr).mul(7).pow(2).negate())).mul(u.snare);
      uvc.addAssign(uvc.div(d.max(1e-4)).mul(wave).mul(0.022));
      return litLiquid(uvc.div(u.aspect).add(0.5));
    })();

    // Glass blobs: spheres pushed around by noise. The surface normal is found
    // from two neighboring points on the pushed surface, in the vertex stage.
    // A band's level, by index.
    const bandLevel = (i: Parameters<typeof u.spectrum.element>[0]) => float(u.spectrum.element(i));
    // The band at a height on a blob, from bass at the bottom to treble at the top.
    const bandAt = (y: ReturnType<typeof float>) => {
      const x = y.mul(0.5).add(0.5).clamp(0, 1).mul(BANDS - 1);
      const i0 = floor(x);
      const t = x.sub(i0);
      const i1 = i0.add(1).min(BANDS - 1);
      return { i0, i1, t, level: mix(bandLevel(int(i0)), bandLevel(int(i1)), t) };
    };
    const glass = (
      seed: ReturnType<typeof float>,
      wobble: ReturnType<typeof float>,
      tint: ReturnType<typeof vec3>,
      spectrum: number,
    ) => {
      const shape = (dir: ReturnType<typeof vec3>) => {
        const broad = mx_noise_float(dir.mul(1.4).add(vec3(seed, u.time.mul(0.35), seed.mul(0.5))));
        const fine = mx_noise_float(dir.mul(4.5).add(vec3(u.time.mul(0.6), seed, 0)));
        const r = float(1).add(broad.mul(wobble)).add(fine.mul(u.high.mul(0.035).add(u.snare.mul(0.03))));
        if (!spectrum) return dir.mul(r);
        // Each band rings its own latitude; higher bands ripple finer around it.
        // Neighboring bands' ripples blend into each other, so there's no seam between rings.
        const { i0, i1, t, level } = bandAt(dir.y);
        const az = atan(dir.z, dir.x);
        const ring = (i: typeof i0) => sin(az.mul(floor(i.mul(0.5).add(3))).add(u.time.mul(2)));
        const ripple = mix(ring(i0), ring(i1), t).mul(0.4).add(0.6);
        return dir.mul(r.add(level.mul(ripple).mul(0.1 * spectrum)));
      };
      const n = normalGeometry;
      const up = select(abs(n.y).greaterThan(0.99), vec3(1, 0, 0), vec3(0, 1, 0));
      const t = normalize(cross(n, up));
      const b = cross(n, t);
      const p0 = shape(n);
      const p1 = shape(normalize(n.add(t.mul(0.02))));
      const p2 = shape(normalize(n.add(b.mul(0.02))));
      const normalView = transformNormalToView(varying(normalize(cross(p1.sub(p0), p2.sub(p0)))));

      const m = new THREE.MeshPhysicalNodeMaterial({
        roughness: 0.12,
        metalness: 0,
        clearcoat: 1,
        clearcoatRoughness: 0.04,
      });
      m.positionNode = p0;
      m.normalNode = normalView;
      // Glassy: the liquid bends through the blob, tinted by the palette.
      const bent = litLiquid(screenUV.add(normalView.xy.mul(vec2(-0.05, 0.05))));
      const body = mix(bent, tint, 0.4).mul(u.kick.mul(0.35).add(0.9));
      m.colorNode = body;
      m.iridescenceNode = u.high.mul(0.7).add(0.25);
      m.iridescenceIORNode = float(1.3);
      const rim = pow(float(1).sub(abs(dot(normalView, positionViewDirection))), 2);
      m.emissiveNode = body.mul(0.15).add(rim.mul(pal3).mul(0.5));
      // Hats tighten and brighten the highlights.
      m.roughnessNode = float(0.16).sub(u.high.mul(0.08));
      return m;
    };

    this.center = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1, 40),
      glass(float(0), u.bass.mul(0.15).add(u.drop.mul(0.12)).add(0.06), mix(pal2, pal3, u.kick.mul(0.6).add(0.4)), 1),
    );
    this.scene.add(this.center);

    const seed = float(instanceIndex).mul(3.7).add(1);
    this.satellites = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1, 16),
      glass(seed, u.mid.mul(0.12).add(0.08), mix(pal2, pal3, hash(instanceIndex).mul(0.6).add(0.2)), 0),
      SATELLITES,
    );
    this.satellites.frustumCulled = false;
    this.scene.add(this.satellites);

    // Snare: a shockwave ring that grows as the hit fades.
    const ringMaterial = new THREE.MeshBasicNodeMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    ringMaterial.colorNode = mix(pal3, vec3(1), 0.3);
    ringMaterial.opacityNode = u.snare.mul(0.55).mul(smoothstep(0, 0.5, uv().x).mul(smoothstep(1, 0.5, uv().x)));
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.94, 1, 128, 1), ringMaterial);
    this.scene.add(this.ring);

    // The halo: a bar for every band, mirrored down both sides of the center
    // blob, bass at the bottom and treble at the top. Each glows with its band.
    const barMaterial = new THREE.MeshBasicNodeMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const barBand = instanceIndex.mod(BANDS);
    const along = float(barBand).div(BANDS - 1);
    const barLevel = bandLevel(barBand);
    const barColor = mix(mix(pal2, pal3, smoothstep(0, 0.6, along)), vec3(1), smoothstep(0.6, 1, along).mul(0.5));
    barMaterial.colorNode = barColor.mul(barLevel.mul(2.2).add(0.3));
    barMaterial.opacityNode = barLevel.mul(0.6).add(0.35);
    this.bars = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), barMaterial, BANDS * 2);
    this.bars.frustumCulled = false;
    this.halo.add(this.bars);
    this.scene.add(this.halo);

    // Dust in a shell around the blobs: it twinkles on the hats and bursts
    // out on drops and song changes.
    const dustMaterial = new THREE.SpriteNodeMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const h1 = hash(instanceIndex);
    const h2 = hash(instanceIndex.add(7));
    const h3 = hash(instanceIndex.add(13));
    const theta = h1.mul(PI2).add(u.time.mul(0.04).mul(h3.sub(0.5)));
    // Each speck belongs to a band, layered by height like the halo.
    const dustBand = instanceIndex.mod(BANDS);
    const dustLevel = bandLevel(dustBand);
    const z = float(dustBand).add(h2).div(BANDS).mul(2).sub(1);
    const ring = sqrt(float(1).sub(z.mul(z)));
    const radius = mix(1.5, 4.2, h3).mul(float(1).add(u.drop.mul(0.5)).add(u.change.mul(0.9)).add(u.kick.mul(0.04)));
    dustMaterial.positionNode = vec3(cos(theta).mul(ring), z.mul(0.75), sin(theta).mul(ring)).mul(radius);
    const twinkle = smoothstep(0.75, 1, hash(instanceIndex.add(floor(u.beat.mul(4)).mul(131)))).mul(u.high);
    dustMaterial.colorNode = mix(pal3, vec3(1), 0.5).mul(twinkle.mul(2.5).add(dustLevel.mul(1.4)).add(0.15).add(u.change));
    dustMaterial.opacityNode = smoothstep(0.5, 0, length(uv().sub(0.5)));
    dustMaterial.scaleNode = mix(0.012, 0.035, h1).mul(twinkle.add(dustLevel.mul(0.8)).add(1));
    this.dust = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), dustMaterial, DUST);
    this.dust.frustumCulled = false;
    this.scene.add(this.dust);

    this.keyLight.position.set(-3, 4, 5);
    this.accentLight.position.set(2.5, 1.5, 2.5);
    this.fillLight.position.set(-2.5, -2, 2);
    this.scene.add(this.keyLight, this.accentLight, this.fillLight);
    this.camera.position.set(0, 0, 5);

    // Finishing: bloom, a touch of chromatic aberration on hits, then the
    // song's tint, a drop flash, a vignette and dither so dark gradients
    // don't band.
    // Multisampled, so the blobs' edges stay smooth.
    const scenePass = pass(this.scene, this.camera, { samples: 4 });
    const color = scenePass.getTextureNode("output");
    this.bloomPass = bloom(color, 0.3, 0.3, 0.85);
    const lit = chromaticAberration(color.add(this.bloomPass), u.aberration, vec2(0.5, 0.5), float(1));
    this.pipeline = new THREE.RenderPipeline(
      this.renderer,
      Fn(() => {
        const c = hue(vec4(lit).rgb, u.hue).max(0).mul(u.glow).toVar();
        c.addAssign(mix(pal3, vec3(1), 0.4).mul(u.drop.mul(0.25)));
        const d = length(centered(screenUV));
        c.mulAssign(float(1).sub(smoothstep(0.35, 1.15, d).mul(0.45)));
        const cell = screenCoordinate.xy;
        c.addAssign(hash(cell.x.add(cell.y.mul(4096)).add(floor(u.time.mul(60)))).sub(0.5).div(255));
        return vec4(c, 1);
      })(),
    );
  }

  setCover(img: HTMLImageElement) {
    const tex = new THREE.Texture(img);
    tex.colorSpace = THREE.SRGBColorSpace;
    // Mirrored, so wide screens tile the cover into a kaleidoscope instead of a seam.
    tex.wrapS = tex.wrapT = THREE.MirroredRepeatWrapping;
    tex.needsUpdate = true;
    this.art[0].dispose();
    this.art = [this.art[1], tex];
    this.artNodes.forEach((node, i) => (node.value = this.art[i]));
    this.artFade = 0;
    // The cover is also what the glass reflects.
    const env = tex.clone();
    env.mapping = THREE.EquirectangularReflectionMapping;
    this.scene.environment?.dispose();
    this.scene.environment = env;
    this.scene.environmentIntensity = 0.7;
  }

  draw(f: Frame, dt: number) {
    const r = this.renderer;
    const l = f.levels;
    const u = this.u;
    // The canvas is sized by the caller; keep three.js's viewport in step.
    const canvas = r.domElement;
    const { width, height } = canvas;
    r.getSize(this.size);
    if (this.size.x !== width || this.size.y !== height) {
      r.setSize(width, height, false);
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
    }
    this.artFade = Math.min(1, this.artFade + dt / 1.5);

    u.time.value = f.time;
    u.bass.value = l.bass;
    u.mid.value = l.mid;
    u.high.value = l.high;
    u.kick.value = l.kick;
    u.snare.value = l.snare;
    u.build.value = l.build;
    u.drop.value = l.drop;
    u.beat.value = l.beat;
    u.hue.value = l.hue + l.change * 0.8;
    u.glow.value = l.glow;
    u.change.value = l.change;
    u.melt.value = f.melt;
    u.artFade.value = this.artFade;
    u.aberration.value = 0.4 * l.kick + 1.2 * l.drop + l.change;
    const a = width / height;
    u.aspect.value.set(Math.max(a, 1), Math.max(1 / a, 1));
    for (let i = 0; i < 4; i++) {
      const [r, g, b] = f.palette.subarray(i * 3, i * 3 + 3);
      u.srgb[i].value.setRGB(r, g, b, THREE.LinearSRGBColorSpace);
      u.pal[i].value.setRGB(r, g, b, THREE.SRGBColorSpace);
    }
    this.bloomPass.strength.value = 0.2 + 0.25 * l.bass + 0.5 * l.drop + 0.4 * l.change;

    placeBlobs(this.blobs, f.time, l);
    const b = this.blobs;
    this.center.position.set(b[0], b[1], b[2]);
    this.center.scale.setScalar(b[3]);
    for (let i = 0; i < SATELLITES; i++) {
      const o = (i + 1) * 4;
      this.matrix.makeScale(b[o + 3], b[o + 3], b[o + 3]).setPosition(b[o], b[o + 1], b[o + 2]);
      this.satellites.setMatrixAt(i, this.matrix);
    }
    this.satellites.instanceMatrix.needsUpdate = true;

    const spectrum = this.u.spectrum.array as number[];
    for (let i = 0; i < BANDS; i++) spectrum[i] = l.spectrum[i];

    // Lights pick up the palette and pulse with the drums.
    this.accentLight.color.copy(u.pal[3].value);
    this.accentLight.intensity = 6 + 18 * l.kick + 10 * l.drop;
    this.fillLight.color.copy(u.pal[2].value);
    this.fillLight.intensity = 4 + 10 * l.snare + 6 * l.mid;

    // The camera sways with the groove (more for danceable songs), leans on
    // each downbeat, pushes in on kicks and thumps on drops.
    const sway = 0.25 + 0.6 * l.swing;
    const g = (l.groove * Math.PI * 2) / 32;
    const dist = 5.2 - 0.35 * l.kick - 0.6 * l.drop - 0.4 * l.build + 0.8 * l.change;
    this.camera.position.set(Math.sin(g) * sway, Math.cos(g * 0.7) * sway * 0.4, dist);
    this.camera.up.set(Math.sin(g * 0.5) * 0.05 + 0.03 * l.downbeat * Math.sin(l.beat * Math.PI), 1, 0);
    this.camera.lookAt(0, 0, 0);

    // Halo bars stand out from the blob's edge, facing the camera.
    this.halo.position.copy(this.center.position);
    this.halo.quaternion.copy(this.camera.quaternion);
    const inner = b[3] * 1.2 + 0.06;
    for (let i = 0; i < BANDS * 2; i++) {
      const band = i % BANDS;
      const side = i < BANDS ? -1 : 1;
      const theta = -Math.PI / 2 + ((band + 0.5) / BANDS) * Math.PI;
      const x = side * Math.cos(theta);
      const y = Math.sin(theta);
      const len = 0.025 + 0.6 * l.spectrum[band];
      this.quat.setFromAxisAngle(this.zAxis, Math.atan2(y, x) - Math.PI / 2);
      this.pos.set(x * (inner + len / 2), y * (inner + len / 2), 0);
      this.scl.set(0.03, len, 0.03);
      this.bars.setMatrixAt(i, this.matrix.compose(this.pos, this.quat, this.scl));
    }
    this.bars.instanceMatrix.needsUpdate = true;

    this.ring.quaternion.copy(this.camera.quaternion);
    this.ring.scale.setScalar(0.8 + (1 - l.snare) * 2.6);
    this.ring.visible = l.snare > 0.01;

    // Pass 1: the liquid, small. Pass 2: everything, full size.
    const lw = Math.max(1, Math.round(width * BACKGROUND_SCALE));
    const lh = Math.max(1, Math.round(height * BACKGROUND_SCALE));
    if (this.liquidTarget.width !== lw || this.liquidTarget.height !== lh) this.liquidTarget.setSize(lw, lh);
    u.texel.value.set(1 / lw, 1 / lh);
    r.setRenderTarget(this.liquidTarget);
    this.liquidQuad.render(r);
    r.setRenderTarget(null);
    this.pipeline.render();
  }

  dispose() {
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
    (this.liquidQuad.material as THREE.Material).dispose();
    this.liquidTarget.dispose();
    this.art.forEach((t) => t.dispose());
    this.scene.environment?.dispose();
    this.pipeline.dispose();
    this.renderer.dispose();
  }
}
