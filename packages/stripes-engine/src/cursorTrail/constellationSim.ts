import type { ConstellationTrailConfig } from "../config/types";
import { createSeededRng } from "../core/rng";
import type { CursorTrailPoint } from "./cursorTrailSim";

export const CONSTELLATION_BASE_STAR_COUNT = 44;

const STAR_SEED = 1861;
const NEIGHBOR_LINKS = 3;
const FLASH_MS = 700;
const STAR_ACT_TAU_MS = 62;
const STAR_ACT_DEGREE_BONUS = 0.28;
const CURSOR_SMOOTH_TAU_MS = 70;
const CURSOR_FADE_IN_MS = 260;
const CURSOR_FADE_OUT_MS = 380;
const PULSE_TRIGGER_PHASE = 0.5;
const RELAY_COOLDOWN_RATIO = 0.8;
const FLASH_GLOBAL_GAP_MS = 1400;
const FLASH_TRIANGLE_GAP_MS = 5000;

export type ConstellationCaps = {
  maxStars: number;
  maxLinks: number;
  maxPulses: number;
};

type EdgeState = {
  a: number;
  b: number;
  stagger: number;
  phase: number;
  prevPhase: number;
  env: number;
  activeSince: number;
  holdUntil: number;
  flashStart: number;
  lastPulse: number;
};

type TriangleState = { e0: number; e1: number; e2: number; lastFlash: number; complete: boolean };

type Graph = {
  sx: Float32Array;
  sy: Float32Array;
  edges: EdgeState[];
  incident: number[][];
  triangles: TriangleState[];
};

type Pulse = { edge: number; from: number; start: number; duration: number; hops: number };

type PendingPulse = { edge: number; from: number; at: number; hops: number };

export type ConstellationState = {
  caps: ConstellationCaps;
  starCount: number;
  starBytes: Uint8Array;
  starsX: Float32Array;
  starsY: Float32Array;
  starsDirty: boolean;
  starFxBytes: Uint8Array;
  graph: Graph | null;
  cssW: number;
  cssH: number;
  linkRadius: number;
  pairDist: number;
  builtPairDist: number;
  smoothX: number;
  smoothY: number;
  hasSmooth: boolean;
  cursorFade: number;
  lastNow: number;
  lastFlashGlobal: number;
  pulses: Pulse[];
  pending: PendingPulse[];
  flareStart: Float32Array;
  starAct: Float32Array;
  starFlare: Float32Array;
  starPeak: Float32Array;
  starSum: Float32Array;
  segData: Float32Array;
  fxData: Float32Array;
  pulseSegData: Float32Array;
  pulseFxData: Float32Array;
  lineCount: number;
  pulseCount: number;
};

export function constellationCaps(config: ConstellationTrailConfig): ConstellationCaps {
  const maxLinks = Math.max(4, Math.round(config.maxLinks));
  return {
    maxStars: Math.max(4, Math.round(config.maxStars)),
    maxLinks,
    maxPulses: Math.min(24, Math.max(4, Math.round(maxLinks * 0.42))),
  };
}

export function createConstellationState(caps: ConstellationCaps): ConstellationState {
  return {
    caps,
    starCount: 0,
    starBytes: new Uint8Array(caps.maxStars * 4),
    starsX: new Float32Array(caps.maxStars),
    starsY: new Float32Array(caps.maxStars),
    starsDirty: true,
    starFxBytes: new Uint8Array(caps.maxStars * 4),
    graph: null,
    cssW: 0,
    cssH: 0,
    linkRadius: 0,
    pairDist: 0,
    builtPairDist: 0,
    smoothX: 0,
    smoothY: 0,
    hasSmooth: false,
    cursorFade: 0,
    lastNow: -1,
    lastFlashGlobal: -1e9,
    pulses: [],
    pending: [],
    flareStart: new Float32Array(caps.maxStars).fill(-1e9),
    starAct: new Float32Array(caps.maxStars),
    starFlare: new Float32Array(caps.maxStars),
    starPeak: new Float32Array(caps.maxStars),
    starSum: new Float32Array(caps.maxStars),
    segData: new Float32Array(caps.maxLinks * 4),
    fxData: new Float32Array(caps.maxLinks * 2),
    pulseSegData: new Float32Array(caps.maxPulses * 4),
    pulseFxData: new Float32Array(caps.maxPulses * 2),
    lineCount: 0,
    pulseCount: 0,
  };
}

function smooth01(u: number): number {
  const t = Math.min(1, Math.max(0, u));
  return t * t * (3 - 2 * t);
}

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

export function constellationStarCount(config: ConstellationTrailConfig, caps: ConstellationCaps): number {
  const raw = Math.round(CONSTELLATION_BASE_STAR_COUNT * config.starDensity);
  return Math.min(caps.maxStars, Math.max(3, raw));
}

function buildStars(state: ConstellationState, count: number): void {
  const rng = createSeededRng(STAR_SEED);
  state.starBytes.fill(0);
  for (let i = 0; i < count; i++) {
    let bestX = 0.5;
    let bestY = 0.5;
    let bestScore = -1;
    for (let attempt = 0; attempt < 40; attempt++) {
      const x = 0.055 + rng() * 0.89;
      const y = 0.085 + rng() * 0.83;
      let minDist = Infinity;
      for (let j = 0; j < i; j++) {
        const dist = Math.hypot((x - state.starsX[j]) * 1.6, y - state.starsY[j]);
        if (dist < minDist) minDist = dist;
      }
      if (minDist > bestScore) {
        bestScore = minDist;
        bestX = x;
        bestY = y;
      }
      if (minDist >= 0.115) break;
    }
    const bx = Math.round(bestX * 255);
    const by = Math.round(bestY * 255);
    state.starsX[i] = bx / 255;
    state.starsY[i] = by / 255;
    state.starBytes[i * 4] = bx;
    state.starBytes[i * 4 + 1] = by;
    state.starBytes[i * 4 + 2] = Math.round(rng() * 255);
    state.starBytes[i * 4 + 3] = Math.round(rng() * 255);
  }
  state.starCount = count;
  state.starsDirty = true;
  state.flareStart.fill(-1e9);
  state.starAct.fill(0);
  state.starFlare.fill(0);
}

function buildGraph(state: ConstellationState, cssW: number, cssH: number, pairDist: number): Graph {
  const n = state.starCount;
  const sx = new Float32Array(n);
  const sy = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    sx[i] = state.starsX[i] * cssW;
    sy[i] = state.starsY[i] * cssH;
  }
  const keys = new Set<number>();
  for (let i = 0; i < n; i++) {
    const nearby: { j: number; d: number }[] = [];
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      const d = Math.hypot(sx[j] - sx[i], sy[j] - sy[i]);
      if (d < pairDist) nearby.push({ j, d });
    }
    nearby.sort((p, q) => p.d - q.d);
    const take = Math.min(NEIGHBOR_LINKS, nearby.length);
    for (let k = 0; k < take; k++) {
      const j = nearby[k].j;
      keys.add(i < j ? i * 1024 + j : j * 1024 + i);
    }
  }
  const edges: EdgeState[] = [...keys]
    .sort((p, q) => p - q)
    .map((key) => ({
      a: Math.floor(key / 1024),
      b: key % 1024,
      stagger: (((key * 2654435761) >>> 0) / 4294967296) * 90,
      phase: 0,
      prevPhase: 0,
      env: 0,
      activeSince: -1,
      holdUntil: 0,
      flashStart: -1e9,
      lastPulse: -1e9,
    }));
  const edgeIndex = new Map<number, number>();
  const incident: number[][] = Array.from({ length: n }, () => []);
  edges.forEach((edge, idx) => {
    edgeIndex.set(edge.a * 1024 + edge.b, idx);
    incident[edge.a].push(idx);
    incident[edge.b].push(idx);
  });
  const adjacency: Set<number>[] = Array.from({ length: n }, () => new Set());
  for (const edge of edges) {
    adjacency[edge.a].add(edge.b);
    adjacency[edge.b].add(edge.a);
  }
  const triangles: TriangleState[] = [];
  for (const edge of edges) {
    for (const c of adjacency[edge.a]) {
      if (c <= edge.b || !adjacency[edge.b].has(c)) continue;
      const e0 = edgeIndex.get(edge.a * 1024 + edge.b);
      const e1 = edgeIndex.get(edge.a * 1024 + c);
      const e2 = edgeIndex.get(edge.b * 1024 + c);
      if (e0 === undefined || e1 === undefined || e2 === undefined) continue;
      triangles.push({ e0, e1, e2, lastFlash: -1e9, complete: false });
    }
  }
  return { sx, sy, edges, incident, triangles };
}

function edgeLength(graph: Graph, edge: EdgeState): number {
  return Math.hypot(graph.sx[edge.b] - graph.sx[edge.a], graph.sy[edge.b] - graph.sy[edge.a]);
}

function launchPulse(
  state: ConstellationState,
  config: ConstellationTrailConfig,
  graph: Graph,
  edgeIndex: number,
  from: number,
  now: number,
  hops: number,
): void {
  if (state.pulses.length >= state.caps.maxPulses) return;
  const edge = graph.edges[edgeIndex];
  if (now - edge.lastPulse < config.pulseCooldownMs * RELAY_COOLDOWN_RATIO) return;
  edge.lastPulse = now;
  const span = edgeLength(graph, edge) / Math.max(1, state.pairDist);
  const duration = config.pulseDurationMs * (0.571 + 0.429 * Math.min(1, Math.max(0, span)));
  state.pulses.push({ edge: edgeIndex, from, start: now, duration, hops });
}

function relayFrom(
  state: ConstellationState,
  config: ConstellationTrailConfig,
  graph: Graph,
  star: number,
  sourceEdge: number,
  now: number,
  hops: number,
): void {
  if (hops > config.pulseRelayHops) return;
  const relayCooldown = config.pulseCooldownMs * RELAY_COOLDOWN_RATIO;
  const options = graph.incident[star]
    .filter((idx) => idx !== sourceEdge)
    .filter((idx) => graph.edges[idx].phase >= 0.42 && now - graph.edges[idx].lastPulse > relayCooldown)
    .sort((p, q) => graph.edges[q].phase - graph.edges[p].phase)
    .slice(0, 2);
  options.forEach((idx, k) => {
    state.pending.push({ edge: idx, from: star, at: now + 70 + k * 55, hops });
  });
}

function updateFlares(state: ConstellationState, config: ConstellationTrailConfig, now: number): void {
  const flareMs = Math.max(1, config.flareMs);
  for (let i = 0; i < state.starCount; i++) {
    const t = (now - state.flareStart[i]) / flareMs;
    state.starFlare[i] = t >= 0 && t < 1 ? (t < 0.14 ? smooth01(t / 0.14) : 1 - standardEase((t - 0.14) / 0.86)) : 0;
  }
}

function updatePulses(state: ConstellationState, config: ConstellationTrailConfig, graph: Graph, now: number): void {
  graph.edges.forEach((edge, idx) => {
    if (edge.phase < PULSE_TRIGGER_PHASE || edge.prevPhase >= PULSE_TRIGGER_PHASE) return;
    if (now - edge.lastPulse < config.pulseCooldownMs) return;
    const da = Math.hypot(graph.sx[edge.a] - state.smoothX, graph.sy[edge.a] - state.smoothY);
    const db = Math.hypot(graph.sx[edge.b] - state.smoothX, graph.sy[edge.b] - state.smoothY);
    launchPulse(state, config, graph, idx, da <= db ? edge.a : edge.b, now, 1);
  });

  for (let i = state.pending.length - 1; i >= 0; i--) {
    const item = state.pending[i];
    if (now < item.at) continue;
    state.pending.splice(i, 1);
    if (graph.edges[item.edge].phase >= 0.3) launchPulse(state, config, graph, item.edge, item.from, now, item.hops);
  }

  for (let i = state.pulses.length - 1; i >= 0; i--) {
    const pulse = state.pulses[i];
    const edge = graph.edges[pulse.edge];
    const t = (now - pulse.start) / pulse.duration;
    if (t >= 1) {
      state.pulses.splice(i, 1);
      const dest = pulse.from === edge.a ? edge.b : edge.a;
      if (edge.phase >= 0.2) {
        state.flareStart[dest] = now;
        relayFrom(state, config, graph, dest, pulse.edge, now, pulse.hops + 1);
      }
      continue;
    }
    if (edge.phase <= 0.05) state.pulses.splice(i, 1);
  }
}

function packPulses(state: ConstellationState, graph: Graph, now: number): void {
  let pulseCount = 0;
  for (const pulse of state.pulses) {
    if (pulseCount >= state.caps.maxPulses) break;
    const edge = graph.edges[pulse.edge];
    const t = Math.min(1, Math.max(0, (now - pulse.start) / pulse.duration));
    const head = pulse.from === edge.a ? t : 1 - t;
    const envelope = smooth01(t / 0.12) * (1 - standardEase(Math.max(0, (t - 0.82) / 0.18)));
    const intensity = envelope * Math.min(1, edge.phase * 1.4) * (pulse.hops > 1 ? 0.82 : 1);
    if (intensity < 0.01) continue;
    const o4 = pulseCount * 4;
    const o2 = pulseCount * 2;
    state.pulseSegData[o4] = state.starsX[edge.a];
    state.pulseSegData[o4 + 1] = state.starsY[edge.a];
    state.pulseSegData[o4 + 2] = state.starsX[edge.b];
    state.pulseSegData[o4 + 3] = state.starsY[edge.b];
    state.pulseFxData[o2] = head;
    state.pulseFxData[o2 + 1] = intensity;
    pulseCount++;
  }
  state.pulseCount = pulseCount;
}

function relaxStarActivation(state: ConstellationState, dt: number): void {
  const k = 1 - Math.exp(-dt / STAR_ACT_TAU_MS);
  for (let i = 0; i < state.starCount; i++) {
    const peak = state.starPeak[i];
    const extra = Math.min(1, Math.max(0, (state.starSum[i] - peak) * 0.5));
    const target = Math.min(1, peak * (1 + STAR_ACT_DEGREE_BONUS * extra));
    state.starAct[i] += (target - state.starAct[i]) * k;
  }
}

function packStarFx(state: ConstellationState): void {
  for (let i = 0; i < state.caps.maxStars; i++) {
    const act = i < state.starCount ? state.starAct[i] : 0;
    const flare = i < state.starCount ? state.starFlare[i] : 0;
    state.starFxBytes[i * 4] = Math.round(Math.min(1, Math.max(0, act)) * 255);
    state.starFxBytes[i * 4 + 1] = Math.round(Math.min(1, Math.max(0, flare)) * 255);
  }
}

export function stepConstellation(
  state: ConstellationState,
  config: ConstellationTrailConfig,
  cursor: CursorTrailPoint | null,
  cssW: number,
  cssH: number,
  now: number,
): void {
  const dt = state.lastNow < 0 ? 16 : Math.min(50, Math.max(0, now - state.lastNow));
  state.lastNow = now;

  const wantStars = constellationStarCount(config, state.caps);
  if (wantStars !== state.starCount) {
    buildStars(state, wantStars);
    state.graph = null;
  }

  const minSide = Math.min(cssW, cssH);
  state.linkRadius = config.radiusScale * minSide;
  state.pairDist = config.linkMaxDistScale * minSide;
  const sizeChanged = Math.abs(cssW - state.cssW) > 0.5 || Math.abs(cssH - state.cssH) > 0.5;
  const spanChanged = Math.abs(state.pairDist - state.builtPairDist) > 0.5;
  if (cssW > 1 && (sizeChanged || spanChanged || !state.graph)) {
    state.cssW = cssW;
    state.cssH = cssH;
    state.builtPairDist = state.pairDist;
    state.graph = buildGraph(state, cssW, cssH, state.pairDist);
    state.pulses.length = 0;
    state.pending.length = 0;
  }

  const graph = state.graph;
  if (!graph) {
    state.lineCount = 0;
    state.pulseCount = 0;
    state.starPeak.fill(0);
    state.starSum.fill(0);
    relaxStarActivation(state, dt);
    updateFlares(state, config, now);
    packStarFx(state);
    return;
  }

  if (cursor) {
    if (state.hasSmooth) {
      const k = 1 - Math.exp(-dt / CURSOR_SMOOTH_TAU_MS);
      state.smoothX += (cursor.x - state.smoothX) * k;
      state.smoothY += (cursor.y - state.smoothY) * k;
    } else {
      state.smoothX = cursor.x;
      state.smoothY = cursor.y;
      state.hasSmooth = true;
    }
    state.cursorFade = Math.min(1, state.cursorFade + dt / CURSOR_FADE_IN_MS);
  } else {
    state.cursorFade = Math.max(0, state.cursorFade - dt / CURSOR_FADE_OUT_MS);
    if (state.cursorFade === 0) state.hasSmooth = false;
  }

  const radius = Math.max(1, state.linkRadius);
  const formMs = Math.max(1, config.linkFormMs);
  const dissolveMs = Math.max(1, config.linkDissolveMs);
  for (const edge of graph.edges) {
    let target = 0;
    if (cursor && state.hasSmooth) {
      const da = Math.hypot(graph.sx[edge.a] - state.smoothX, graph.sy[edge.a] - state.smoothY);
      const db = Math.hypot(graph.sx[edge.b] - state.smoothX, graph.sy[edge.b] - state.smoothY);
      const m = Math.max(da, db) / radius;
      if (m < 1) target = smooth01((1 - m) / 0.65);
    }
    edge.prevPhase = edge.phase;
    if (target > 0.02) {
      if (edge.activeSince < 0) edge.activeSince = now;
      edge.env = target;
      if (now - edge.activeSince > edge.stagger) edge.phase = Math.min(1, edge.phase + dt / formMs);
    } else {
      if (edge.activeSince >= 0) {
        edge.activeSince = -1;
        edge.holdUntil = now + config.linkHoldMs;
      }
      if (now >= edge.holdUntil) {
        edge.phase = Math.max(0, edge.phase - dt / dissolveMs);
        if (edge.phase === 0) edge.env = 0;
      }
    }
  }

  if (config.pulseEnabled) updatePulses(state, config, graph, now);
  else {
    state.pulses.length = 0;
    state.pending.length = 0;
  }

  if (config.polygonFlashEnabled) {
    for (const tri of graph.triangles) {
      const e0 = graph.edges[tri.e0];
      const e1 = graph.edges[tri.e1];
      const e2 = graph.edges[tri.e2];
      const complete =
        e0.phase >= 0.8 && e1.phase >= 0.8 && e2.phase >= 0.8 && Math.min(e0.env, e1.env, e2.env) >= 0.45;
      if (
        complete &&
        !tri.complete &&
        now - state.lastFlashGlobal > FLASH_GLOBAL_GAP_MS &&
        now - tri.lastFlash > FLASH_TRIANGLE_GAP_MS
      ) {
        state.lastFlashGlobal = now;
        tri.lastFlash = now;
        e0.flashStart = now;
        e1.flashStart = now;
        e2.flashStart = now;
      }
      tri.complete = complete;
    }
  }

  state.starPeak.fill(0);
  state.starSum.fill(0);
  for (const edge of graph.edges) {
    const link = standardEase(edge.phase) * (0.55 + 0.45 * edge.env);
    if (link <= 0.01) continue;
    state.starSum[edge.a] += link;
    state.starSum[edge.b] += link;
    if (link > state.starPeak[edge.a]) state.starPeak[edge.a] = link;
    if (link > state.starPeak[edge.b]) state.starPeak[edge.b] = link;
  }
  relaxStarActivation(state, dt);
  updateFlares(state, config, now);
  packStarFx(state);

  let count = 0;
  for (const edge of graph.edges) {
    if (count >= state.caps.maxLinks) break;
    const alpha = standardEase(edge.phase) * (0.62 + 0.38 * edge.env);
    if (alpha < 0.008) continue;
    const flashT = (now - edge.flashStart) / FLASH_MS;
    const flash =
      flashT >= 0 && flashT < 1
        ? flashT < 0.16
          ? smooth01(flashT / 0.16)
          : 1 - standardEase((flashT - 0.16) / 0.84)
        : 0;
    const o4 = count * 4;
    const o2 = count * 2;
    state.segData[o4] = state.starsX[edge.a];
    state.segData[o4 + 1] = state.starsY[edge.a];
    state.segData[o4 + 2] = state.starsX[edge.b];
    state.segData[o4 + 3] = state.starsY[edge.b];
    state.fxData[o2] = alpha;
    state.fxData[o2 + 1] = flash;
    count++;
  }
  state.lineCount = count;

  if (config.pulseEnabled) packPulses(state, graph, now);
  else state.pulseCount = 0;
}
