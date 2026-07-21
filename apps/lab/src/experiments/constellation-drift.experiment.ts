import {
  compileProgram,
  createSeededRng,
  createStripesEngine,
  DEFAULT_ENGINE_CONFIG,
  FULLSCREEN_VERT,
  type EngineHookContext,
  type FieldHookFrame,
  type FieldHookPass,
} from "@necatikcl/stripes-engine";
import { EXPERIMENT_BASE_CONFIG } from "./preset";
import type { ExperimentDefinition } from "./types";
import { CONSTELLATION_DRIFT_FRAG, DRIFT_MAX_LINES, DRIFT_STAR_COUNT } from "./constellation-drift.shaders";

const PAIR_DIST_SCALE = 0.24;
const DRIFT_AMP = 0.013;
const FADE_IN_MIN = 640;
const FADE_IN_SPAN = 280;
const HOLD_MIN = 3400;
const HOLD_SPAN = 2600;
const FADE_OUT_MIN = 1080;
const FADE_OUT_SPAN = 620;
const SPAWN_MIN = 1000;
const SPAWN_SPAN = 1400;
const MAX_ALIVE = 9;
const FLASH_MS = 1900;
const FLASH_GLOBAL_COOLDOWN = 9000;
const FLASH_TRIANGLE_COOLDOWN = 22000;
const STAR_ACT_TAU_MS = 260;
const STAR_ACT_DEGREE_BONUS = 0.24;
const REPLAY_STAGGER_MS = 300;
const REPLAY_LINKS = 7;

type StarSet = {
  baseX: Float32Array;
  baseY: Float32Array;
  seedA: Float32Array;
  seedB: Float32Array;
  ampX: Float32Array;
  ampY: Float32Array;
  rateX: Float32Array;
  rateY: Float32Array;
  phaseX: Float32Array;
  phaseY: Float32Array;
};

type Candidate = { a: number; b: number; key: number };

type Link = {
  a: number;
  b: number;
  key: number;
  start: number;
  fadeIn: number;
  hold: number;
  fadeOut: number;
  flashStart: number;
};

type Pending = { a: number; b: number; key: number; dueAt: number };

type SimState = {
  rng: () => number;
  stars: StarSet;
  candidates: Candidate[];
  cssW: number;
  cssH: number;
  uvX: Float32Array;
  uvY: Float32Array;
  links: Link[];
  activeKeys: Set<number>;
  pending: Pending[];
  nextSpawnAt: number;
  lastFlashAt: number;
  triangleFlash: Map<number, number>;
  replayRequested: boolean;
  lastNow: number;
  starAct: Float32Array;
  starPeak: Float32Array;
  starSum: Float32Array;
  starPosData: Float32Array;
  starSeedData: Float32Array;
  segData: Float32Array;
  fxData: Float32Array;
  lineCount: number;
};

function standardEase(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  let u = t;
  for (let i = 0; i < 5; i++) {
    const inv = 1 - u;
    const x = 1.8 * u * inv * inv + u * u * u;
    const dx = 1.8 * inv * (1 - 3 * u) + 3 * u * u;
    if (dx < 1e-4) break;
    u -= (x - t) / dx;
    if (u < 0) u = 0;
    if (u > 1) u = 1;
  }
  const inv = 1 - u;
  return 1.8 * u * inv * inv + 3 * u * u * inv + u * u * u;
}

function smooth01(u: number): number {
  const t = Math.min(1, Math.max(0, u));
  return t * t * (3 - 2 * t);
}

function buildStars(): StarSet {
  const n = DRIFT_STAR_COUNT;
  const rng = createSeededRng(4703);
  const baseX = new Float32Array(n);
  const baseY = new Float32Array(n);
  const seedA = new Float32Array(n);
  const seedB = new Float32Array(n);
  const ampX = new Float32Array(n);
  const ampY = new Float32Array(n);
  const rateX = new Float32Array(n);
  const rateY = new Float32Array(n);
  const phaseX = new Float32Array(n);
  const phaseY = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let bestX = 0.5;
    let bestY = 0.5;
    let bestScore = -1;
    for (let attempt = 0; attempt < 40; attempt++) {
      const x = 0.07 + rng() * 0.86;
      const y = 0.1 + rng() * 0.8;
      let minDist = Infinity;
      for (let j = 0; j < i; j++) {
        const dist = Math.hypot((x - baseX[j]) * 1.6, y - baseY[j]);
        if (dist < minDist) minDist = dist;
      }
      if (minDist > bestScore) {
        bestScore = minDist;
        bestX = x;
        bestY = y;
      }
      if (minDist >= 0.12) break;
    }
    baseX[i] = bestX;
    baseY[i] = bestY;
    seedA[i] = rng();
    seedB[i] = rng();
    ampX[i] = DRIFT_AMP * (0.55 + rng() * 0.75);
    ampY[i] = DRIFT_AMP * (0.55 + rng() * 0.75);
    rateX[i] = (2 * Math.PI) / (26 + rng() * 22);
    rateY[i] = (2 * Math.PI) / (30 + rng() * 26);
    phaseX[i] = rng() * Math.PI * 2;
    phaseY[i] = rng() * Math.PI * 2;
  }
  return { baseX, baseY, seedA, seedB, ampX, ampY, rateX, rateY, phaseX, phaseY };
}

function buildCandidates(stars: StarSet, cssW: number, cssH: number): Candidate[] {
  const n = DRIFT_STAR_COUNT;
  const pairDist = PAIR_DIST_SCALE * Math.min(cssW, cssH);
  const keys = new Set<number>();
  for (let i = 0; i < n; i++) {
    const nearby: { j: number; d: number }[] = [];
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      const d = Math.hypot((stars.baseX[j] - stars.baseX[i]) * cssW, (stars.baseY[j] - stars.baseY[i]) * cssH);
      if (d < pairDist) nearby.push({ j, d });
    }
    nearby.sort((p, q) => p.d - q.d);
    const take = Math.min(3, nearby.length);
    for (let k = 0; k < take; k++) {
      const j = nearby[k].j;
      keys.add(i < j ? i * 256 + j : j * 256 + i);
    }
  }
  return [...keys].sort((p, q) => p - q).map((key) => ({ a: key >> 8, b: key & 255, key }));
}

function linkPhase(link: Link, now: number): number {
  const t = now - link.start;
  if (t < 0) return 0;
  if (t < link.fadeIn) return standardEase(t / link.fadeIn);
  if (t < link.fadeIn + link.hold) return 1;
  const out = (t - link.fadeIn - link.hold) / link.fadeOut;
  if (out >= 1) return 0;
  return 1 - standardEase(out);
}

function linkTotalMs(link: Link): number {
  return link.fadeIn + link.hold + link.fadeOut;
}

function spawnLink(state: SimState, candidate: Candidate, now: number): void {
  if (state.activeKeys.has(candidate.key) || state.links.length >= DRIFT_MAX_LINES) return;
  state.activeKeys.add(candidate.key);
  state.links.push({
    a: candidate.a,
    b: candidate.b,
    key: candidate.key,
    start: now,
    fadeIn: FADE_IN_MIN + state.rng() * FADE_IN_SPAN,
    hold: HOLD_MIN + state.rng() * HOLD_SPAN,
    fadeOut: FADE_OUT_MIN + state.rng() * FADE_OUT_SPAN,
    flashStart: -1e9,
  });
}

function pickCandidate(state: SimState): Candidate | null {
  const free = state.candidates.filter((c) => !state.activeKeys.has(c.key));
  if (free.length === 0) return null;
  if (state.links.length > 0 && state.rng() < 0.58) {
    const touched = new Set<number>();
    for (const link of state.links) {
      touched.add(link.a);
      touched.add(link.b);
    }
    const adjacent = free.filter((c) => touched.has(c.a) || touched.has(c.b));
    if (adjacent.length > 0) return adjacent[Math.floor(state.rng() * adjacent.length)];
  }
  return free[Math.floor(state.rng() * free.length)];
}

function queueReplayCluster(state: SimState, now: number): void {
  state.pending.length = 0;
  if (state.candidates.length === 0) return;
  const degree = new Map<number, number>();
  for (const c of state.candidates) {
    degree.set(c.a, (degree.get(c.a) ?? 0) + 1);
    degree.set(c.b, (degree.get(c.b) ?? 0) + 1);
  }
  let hub = state.candidates[0].a;
  let best = -1;
  for (const [star, deg] of degree) {
    const idle = state.candidates.some((c) => (c.a === star || c.b === star) && !state.activeKeys.has(c.key));
    if (!idle) continue;
    const score = deg + state.rng() * 1.5;
    if (score > best) {
      best = score;
      hub = star;
    }
  }
  const spokes = state.candidates.filter((c) => (c.a === hub || c.b === hub) && !state.activeKeys.has(c.key));
  const neighbours = new Set<number>(spokes.map((c) => (c.a === hub ? c.b : c.a)));
  const rims = state.candidates.filter(
    (c) => !state.activeKeys.has(c.key) && c.a !== hub && c.b !== hub && neighbours.has(c.a) && neighbours.has(c.b),
  );
  const chosen = [...spokes, ...rims].slice(0, REPLAY_LINKS);
  chosen.forEach((c, index) => {
    state.pending.push({ a: c.a, b: c.b, key: c.key, dueAt: now + index * REPLAY_STAGGER_MS });
  });
  state.nextSpawnAt = now + chosen.length * REPLAY_STAGGER_MS + SPAWN_MIN;
}

function updateTriangles(state: SimState, now: number): void {
  if (now - state.lastFlashAt < FLASH_GLOBAL_COOLDOWN) return;
  const count = state.links.length;
  for (let i = 0; i < count; i++) {
    const li = state.links[i];
    if (linkPhase(li, now) < 0.88) continue;
    for (let j = i + 1; j < count; j++) {
      const lj = state.links[j];
      if (linkPhase(lj, now) < 0.88) continue;
      const shared = li.a === lj.a || li.a === lj.b || li.b === lj.a || li.b === lj.b;
      if (!shared) continue;
      const verts = new Set<number>([li.a, li.b, lj.a, lj.b]);
      if (verts.size !== 3) continue;
      for (let k = j + 1; k < count; k++) {
        const lk = state.links[k];
        if (linkPhase(lk, now) < 0.88) continue;
        if (!verts.has(lk.a) || !verts.has(lk.b)) continue;
        const sorted = [...verts].sort((p, q) => p - q);
        const triKey = sorted[0] * 65536 + sorted[1] * 256 + sorted[2];
        if (now - (state.triangleFlash.get(triKey) ?? -1e9) < FLASH_TRIANGLE_COOLDOWN) continue;
        state.triangleFlash.set(triKey, now);
        state.lastFlashAt = now;
        li.flashStart = now;
        lj.flashStart = now;
        lk.flashStart = now;
        return;
      }
    }
  }
}

function updateSim(state: SimState, frame: FieldHookFrame): void {
  const now = frame.now;
  const dt = state.lastNow < 0 ? 16 : Math.min(50, Math.max(0, now - state.lastNow));
  state.lastNow = now;

  if (frame.cssW > 1 && (Math.abs(frame.cssW - state.cssW) > 0.5 || Math.abs(frame.cssH - state.cssH) > 0.5)) {
    state.cssW = frame.cssW;
    state.cssH = frame.cssH;
    state.candidates = buildCandidates(state.stars, frame.cssW, frame.cssH);
  }

  const seconds = frame.elapsed * 0.001;
  const stars = state.stars;
  for (let i = 0; i < DRIFT_STAR_COUNT; i++) {
    const x = stars.baseX[i] + stars.ampX[i] * Math.sin(seconds * stars.rateX[i] + stars.phaseX[i]);
    const y = stars.baseY[i] + stars.ampY[i] * Math.cos(seconds * stars.rateY[i] + stars.phaseY[i]);
    state.uvX[i] = x;
    state.uvY[i] = y;
    state.starPosData[i * 2] = x;
    state.starPosData[i * 2 + 1] = y;
  }

  if (state.replayRequested) {
    state.replayRequested = false;
    queueReplayCluster(state, now);
  }

  for (let i = state.pending.length - 1; i >= 0; i--) {
    const item = state.pending[i];
    if (now < item.dueAt) continue;
    state.pending.splice(i, 1);
    spawnLink(state, { a: item.a, b: item.b, key: item.key }, now);
  }

  if (state.nextSpawnAt < 0) state.nextSpawnAt = now + 1200;

  if (state.candidates.length > 0 && now >= state.nextSpawnAt) {
    let alive = 0;
    for (const link of state.links) {
      if (now - link.start < link.fadeIn + link.hold) alive++;
    }
    if (alive < MAX_ALIVE) {
      const candidate = pickCandidate(state);
      if (candidate) spawnLink(state, candidate, now);
      state.nextSpawnAt = now + SPAWN_MIN + state.rng() * SPAWN_SPAN;
    } else {
      state.nextSpawnAt = now + 500;
    }
  }

  for (let i = state.links.length - 1; i >= 0; i--) {
    const link = state.links[i];
    if (now - link.start >= linkTotalMs(link)) {
      state.activeKeys.delete(link.key);
      state.links.splice(i, 1);
    }
  }

  updateTriangles(state, now);

  state.starPeak.fill(0);
  state.starSum.fill(0);
  let count = 0;
  for (const link of state.links) {
    const phase = linkPhase(link, now);
    if (phase > 0.01) {
      state.starSum[link.a] += phase;
      state.starSum[link.b] += phase;
      if (phase > state.starPeak[link.a]) state.starPeak[link.a] = phase;
      if (phase > state.starPeak[link.b]) state.starPeak[link.b] = phase;
    }
    if (count >= DRIFT_MAX_LINES || phase < 0.008) continue;
    const flashT = (now - link.flashStart) / FLASH_MS;
    const flash =
      flashT >= 0 && flashT < 1
        ? flashT < 0.34
          ? smooth01(flashT / 0.34)
          : 1 - standardEase((flashT - 0.34) / 0.66)
        : 0;
    const o4 = count * 4;
    const o2 = count * 2;
    state.segData[o4] = state.uvX[link.a];
    state.segData[o4 + 1] = state.uvY[link.a];
    state.segData[o4 + 2] = state.uvX[link.b];
    state.segData[o4 + 3] = state.uvY[link.b];
    state.fxData[o2] = phase;
    state.fxData[o2 + 1] = flash * 0.85;
    count++;
  }
  state.lineCount = count;

  const k = 1 - Math.exp(-dt / STAR_ACT_TAU_MS);
  for (let i = 0; i < DRIFT_STAR_COUNT; i++) {
    const peak = state.starPeak[i];
    const extra = Math.min(1, Math.max(0, (state.starSum[i] - peak) * 0.5));
    const target = Math.min(1, peak * (1 + STAR_ACT_DEGREE_BONUS * extra));
    state.starAct[i] += (target - state.starAct[i]) * k;
  }
}

const definition: ExperimentDefinition = {
  id: "constellation-drift",
  title: "Constellation Drift",
  category: "stars",
  blurb: "Slowly drifting stars link themselves together and let go again, a few quiet seams at a time.",
  pointer: "custom",
  create: (ctx) => {
    const stars = buildStars();
    const starSeedData = new Float32Array(DRIFT_STAR_COUNT * 2);
    for (let i = 0; i < DRIFT_STAR_COUNT; i++) {
      starSeedData[i * 2] = stars.seedA[i];
      starSeedData[i * 2 + 1] = stars.seedB[i];
    }
    const state: SimState = {
      rng: createSeededRng(20713),
      stars,
      candidates: [],
      cssW: 0,
      cssH: 0,
      uvX: new Float32Array(DRIFT_STAR_COUNT),
      uvY: new Float32Array(DRIFT_STAR_COUNT),
      links: [],
      activeKeys: new Set<number>(),
      pending: [],
      nextSpawnAt: -1,
      lastFlashAt: -1e9,
      triangleFlash: new Map<number, number>(),
      replayRequested: false,
      lastNow: -1,
      starAct: new Float32Array(DRIFT_STAR_COUNT),
      starPeak: new Float32Array(DRIFT_STAR_COUNT),
      starSum: new Float32Array(DRIFT_STAR_COUNT),
      starPosData: new Float32Array(DRIFT_STAR_COUNT * 2),
      starSeedData,
      segData: new Float32Array(DRIFT_MAX_LINES * 4),
      fxData: new Float32Array(DRIFT_MAX_LINES * 2),
      lineCount: 0,
    };

    const fieldPass = ({ gl, quad }: EngineHookContext): FieldHookPass => {
      const program = compileProgram(gl, FULLSCREEN_VERT, CONSTELLATION_DRIFT_FRAG);
      const uField = gl.getUniformLocation(program, "uField");
      const uCssSize = gl.getUniformLocation(program, "uCssSize");
      const uTime = gl.getUniformLocation(program, "uTime");
      const uLineCount = gl.getUniformLocation(program, "uLineCount");
      const uStarPos = gl.getUniformLocation(program, "uStarPos");
      const uStarSeed = gl.getUniformLocation(program, "uStarSeed");
      const uStarAct = gl.getUniformLocation(program, "uStarAct");
      const uLineSeg = gl.getUniformLocation(program, "uLineSeg");
      const uLineFx = gl.getUniformLocation(program, "uLineFx");
      return {
        render(frame) {
          updateSim(state, frame);
          gl.bindFramebuffer(gl.FRAMEBUFFER, frame.output.fbo);
          gl.viewport(0, 0, frame.output.width, frame.output.height);
          gl.useProgram(program);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, frame.input.texture);
          gl.uniform1i(uField, 0);
          gl.uniform2f(uCssSize, frame.cssW, frame.cssH);
          gl.uniform1f(uTime, frame.elapsed * 0.001);
          gl.uniform1i(uLineCount, state.lineCount);
          gl.uniform2fv(uStarPos, state.starPosData);
          gl.uniform2fv(uStarSeed, state.starSeedData);
          gl.uniform1fv(uStarAct, state.starAct);
          gl.uniform4fv(uLineSeg, state.segData);
          gl.uniform2fv(uLineFx, state.fxData);
          quad.draw();
        },
        dispose() {
          gl.deleteProgram(program);
        },
      };
    };

    const engine = createStripesEngine(ctx.canvas, { hooks: { fieldPass } });
    engine.setConfig({
      ...EXPERIMENT_BASE_CONFIG,
      reveal: { ...DEFAULT_ENGINE_CONFIG.reveal, enabled: false },
      cursorTrail: { ...DEFAULT_ENGINE_CONFIG.cursorTrail, enabled: false },
      clickWave: { ...DEFAULT_ENGINE_CONFIG.clickWave, enabled: false },
      flames: { ...DEFAULT_ENGINE_CONFIG.flames, enabled: false },
      background: {
        ...EXPERIMENT_BASE_CONFIG.background,
        stars: { ...DEFAULT_ENGINE_CONFIG.background.stars, enabled: false },
      },
    });

    let disposed = false;
    const image = new Image();
    image.onload = () => {
      if (!disposed) engine.setSource(image);
    };
    image.src = ctx.textureUrl;
    engine.start();

    return {
      engine,
      replay: () => {
        state.replayRequested = true;
      },
      destroy: () => {
        disposed = true;
        engine.dispose();
      },
    };
  },
};

export default definition;
