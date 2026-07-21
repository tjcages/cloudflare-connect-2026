import {
  compileProgram,
  createDataTexture,
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
import {
  CONSTELLATION_MAX_LINES,
  CONSTELLATION_MAX_PULSES,
  CONSTELLATION_STAR_COUNT,
  CONSTELLATION_WEB_FRAG,
} from "./constellation-web.shaders";

const LINK_RADIUS_SCALE = 0.31;
const PAIR_DIST_SCALE = 0.2184;
const HUB_SEPARATION_SCALE = 0.462;
const FADE_IN_MS = 210;
const FADE_OUT_MS = 540;
const FLASH_MS = 700;
const REPLAY_MS = 3000;
const REPLAY_CASCADE_T = 0.62;
const LINE_PEAK_ALPHA = 1;
const STAR_ACT_TAU_MS = 62;
const STAR_ACT_DEGREE_BONUS = 0.28;
const FLARE_MS = 460;
const PULSE_MIN_MS = 400;
const PULSE_MAX_MS = 700;
const PULSE_TRIGGER_PHASE = 0.5;
const EDGE_COOLDOWN_MS = 900;
const RELAY_COOLDOWN_MS = 720;
const MAX_HOPS = 2;

type StarSet = { xs: Float32Array; ys: Float32Array; bytes: Uint8Array };

type EdgeState = {
  a: number;
  b: number;
  stagger: number;
  phase: number;
  prevPhase: number;
  env: number;
  activeSince: number;
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
  waypoints: { x: number; y: number }[];
};

type Pulse = { edge: number; from: number; start: number; duration: number; hops: number };

type PendingPulse = { edge: number; from: number; at: number; hops: number };

type SimState = {
  stars: StarSet;
  graph: Graph | null;
  cssW: number;
  cssH: number;
  linkRadius: number;
  pairDist: number;
  smoothX: number;
  smoothY: number;
  hasSmooth: boolean;
  cursorFade: number;
  lastNow: number;
  lastFlashGlobal: number;
  replaying: boolean;
  replayRequested: boolean;
  replayStart: number;
  replayCascade: boolean;
  pulses: Pulse[];
  pending: PendingPulse[];
  flareStart: Float32Array;
  segData: Float32Array;
  fxData: Float32Array;
  pulseSegData: Float32Array;
  pulseFxData: Float32Array;
  lineCount: number;
  pulseCount: number;
  starAct: Float32Array;
  starFlare: Float32Array;
  starPeak: Float32Array;
  starSum: Float32Array;
};

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

function buildStars(): StarSet {
  const n = CONSTELLATION_STAR_COUNT;
  const rng = createSeededRng(1861);
  const xs = new Float32Array(n);
  const ys = new Float32Array(n);
  const bytes = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    let bestX = 0.5;
    let bestY = 0.5;
    let bestScore = -1;
    for (let attempt = 0; attempt < 40; attempt++) {
      const x = 0.055 + rng() * 0.89;
      const y = 0.085 + rng() * 0.83;
      let minDist = Infinity;
      for (let j = 0; j < i; j++) {
        const dist = Math.hypot((x - xs[j]) * 1.6, y - ys[j]);
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
    xs[i] = bx / 255;
    ys[i] = by / 255;
    bytes[i * 4] = bx;
    bytes[i * 4 + 1] = by;
    bytes[i * 4 + 2] = Math.round(rng() * 255);
    bytes[i * 4 + 3] = Math.round(rng() * 255);
  }
  return { xs, ys, bytes };
}

function buildGraph(stars: StarSet, cssW: number, cssH: number): Graph {
  const n = CONSTELLATION_STAR_COUNT;
  const sx = new Float32Array(n);
  const sy = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    sx[i] = stars.xs[i] * cssW;
    sy[i] = stars.ys[i] * cssH;
  }
  const minSide = Math.min(cssW, cssH);
  const pairDist = minSide * PAIR_DIST_SCALE;
  const hubSeparation = minSide * HUB_SEPARATION_SCALE;
  const keys = new Set<number>();
  for (let i = 0; i < n; i++) {
    const nearby: { j: number; d: number }[] = [];
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      const d = Math.hypot(sx[j] - sx[i], sy[j] - sy[i]);
      if (d < pairDist) nearby.push({ j, d });
    }
    nearby.sort((p, q) => p.d - q.d);
    const take = Math.min(3, nearby.length);
    for (let k = 0; k < take; k++) {
      const j = nearby[k].j;
      keys.add(i < j ? i * 256 + j : j * 256 + i);
    }
  }
  const edges: EdgeState[] = [...keys]
    .sort((p, q) => p - q)
    .map((key) => ({
      a: key >> 8,
      b: key & 255,
      stagger: (((key * 2654435761) >>> 0) / 4294967296) * 90,
      phase: 0,
      prevPhase: 0,
      env: 0,
      activeSince: -1,
      flashStart: -1e9,
      lastPulse: -1e9,
    }));
  const edgeIndex = new Map<number, number>();
  const incident: number[][] = Array.from({ length: n }, () => []);
  edges.forEach((edge, idx) => {
    edgeIndex.set(edge.a * 256 + edge.b, idx);
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
      const e0 = edgeIndex.get(edge.a * 256 + edge.b);
      const e1 = edgeIndex.get(edge.a * 256 + c);
      const e2 = edgeIndex.get(edge.b * 256 + c);
      if (e0 === undefined || e1 === undefined || e2 === undefined) continue;
      triangles.push({ e0, e1, e2, lastFlash: -1e9, complete: false });
    }
  }
  const degree = new Array<number>(n).fill(0);
  for (const edge of edges) {
    degree[edge.a] += 1;
    degree[edge.b] += 1;
  }
  const byDegree = Array.from({ length: n }, (_, i) => i).sort((p, q) => degree[q] - degree[p]);
  const hubs: number[] = [];
  for (const idx of byDegree) {
    if (hubs.length === 4) break;
    if (hubs.every((h) => Math.hypot(sx[h] - sx[idx], sy[h] - sy[idx]) > hubSeparation)) hubs.push(idx);
  }
  for (const idx of byDegree) {
    if (hubs.length === 4) break;
    if (!hubs.includes(idx)) hubs.push(idx);
  }
  hubs.sort((p, q) => sx[p] - sx[q]);
  const waypoints = hubs.map((i) => ({ x: sx[i], y: sy[i] }));
  return { sx, sy, edges, incident, triangles, waypoints };
}

function pathPoint(points: { x: number; y: number }[], t: number): { x: number; y: number } {
  const last = points.length - 1;
  const s = Math.min(0.9999, Math.max(0, t)) * last;
  const seg = Math.floor(s);
  const u = s - seg;
  const p0 = points[Math.max(0, seg - 1)];
  const p1 = points[seg];
  const p2 = points[Math.min(last, seg + 1)];
  const p3 = points[Math.min(last, seg + 2)];
  const u2 = u * u;
  const u3 = u2 * u;
  return {
    x:
      0.5 *
      (2 * p1.x +
        (p2.x - p0.x) * u +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * u2 +
        (3 * p1.x - p0.x - 3 * p2.x + p3.x) * u3),
    y:
      0.5 *
      (2 * p1.y +
        (p2.y - p0.y) * u +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * u2 +
        (3 * p1.y - p0.y - 3 * p2.y + p3.y) * u3),
  };
}

function edgeLength(graph: Graph, edge: EdgeState): number {
  return Math.hypot(graph.sx[edge.b] - graph.sx[edge.a], graph.sy[edge.b] - graph.sy[edge.a]);
}

function launchPulse(state: SimState, graph: Graph, edgeIndex: number, from: number, now: number, hops: number): void {
  if (state.pulses.length >= CONSTELLATION_MAX_PULSES) return;
  const edge = graph.edges[edgeIndex];
  if (now - edge.lastPulse < RELAY_COOLDOWN_MS) return;
  edge.lastPulse = now;
  const span = edgeLength(graph, edge) / Math.max(1, state.pairDist);
  const duration = PULSE_MIN_MS + (PULSE_MAX_MS - PULSE_MIN_MS) * Math.min(1, Math.max(0, span));
  state.pulses.push({ edge: edgeIndex, from, start: now, duration, hops });
}

function relayFrom(state: SimState, graph: Graph, star: number, sourceEdge: number, now: number, hops: number): void {
  if (hops > MAX_HOPS) return;
  const options = graph.incident[star]
    .filter((idx) => idx !== sourceEdge)
    .filter((idx) => graph.edges[idx].phase >= 0.42 && now - graph.edges[idx].lastPulse > RELAY_COOLDOWN_MS)
    .sort((p, q) => graph.edges[q].phase - graph.edges[p].phase)
    .slice(0, 2);
  options.forEach((idx, k) => {
    state.pending.push({ edge: idx, from: star, at: now + 70 + k * 55, hops });
  });
}

function updateFlares(state: SimState, now: number): void {
  for (let i = 0; i < CONSTELLATION_STAR_COUNT; i++) {
    const t = (now - state.flareStart[i]) / FLARE_MS;
    state.starFlare[i] = t >= 0 && t < 1 ? (t < 0.14 ? smooth01(t / 0.14) : 1 - standardEase((t - 0.14) / 0.86)) : 0;
  }
}

function seedCascade(state: SimState, graph: Graph, now: number): void {
  let best = -1;
  let bestScore = 0;
  for (let i = 0; i < CONSTELLATION_STAR_COUNT; i++) {
    let score = 0;
    for (const idx of graph.incident[i]) score += graph.edges[idx].phase;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  if (best < 0 || bestScore < 0.8) return;
  state.flareStart[best] = now;
  const seeds = graph.incident[best]
    .filter((idx) => graph.edges[idx].phase >= 0.35)
    .sort((p, q) => graph.edges[q].phase - graph.edges[p].phase)
    .slice(0, 3);
  seeds.forEach((idx, k) => {
    state.pending.push({ edge: idx, from: best, at: now + k * 90, hops: 1 });
  });
}

function updatePulses(state: SimState, graph: Graph, now: number): void {
  graph.edges.forEach((edge, idx) => {
    if (edge.phase < PULSE_TRIGGER_PHASE || edge.prevPhase >= PULSE_TRIGGER_PHASE) return;
    if (now - edge.lastPulse < EDGE_COOLDOWN_MS) return;
    const da = Math.hypot(graph.sx[edge.a] - state.smoothX, graph.sy[edge.a] - state.smoothY);
    const db = Math.hypot(graph.sx[edge.b] - state.smoothX, graph.sy[edge.b] - state.smoothY);
    launchPulse(state, graph, idx, da <= db ? edge.a : edge.b, now, 1);
  });

  for (let i = state.pending.length - 1; i >= 0; i--) {
    const item = state.pending[i];
    if (now < item.at) continue;
    state.pending.splice(i, 1);
    if (graph.edges[item.edge].phase >= 0.3) launchPulse(state, graph, item.edge, item.from, now, item.hops);
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
        relayFrom(state, graph, dest, pulse.edge, now, pulse.hops + 1);
      }
      continue;
    }
    if (edge.phase <= 0.05) state.pulses.splice(i, 1);
  }
}

function packPulses(state: SimState, graph: Graph, now: number): void {
  let pulseCount = 0;
  for (const pulse of state.pulses) {
    if (pulseCount >= CONSTELLATION_MAX_PULSES) break;
    const edge = graph.edges[pulse.edge];
    const t = Math.min(1, Math.max(0, (now - pulse.start) / pulse.duration));
    const head = pulse.from === edge.a ? t : 1 - t;
    const envelope = smooth01(t / 0.12) * (1 - standardEase(Math.max(0, (t - 0.82) / 0.18)));
    const intensity = envelope * Math.min(1, edge.phase * 1.4) * (pulse.hops > 1 ? 0.82 : 1);
    if (intensity < 0.01) continue;
    const o4 = pulseCount * 4;
    const o2 = pulseCount * 2;
    state.pulseSegData[o4] = state.stars.xs[edge.a];
    state.pulseSegData[o4 + 1] = state.stars.ys[edge.a];
    state.pulseSegData[o4 + 2] = state.stars.xs[edge.b];
    state.pulseSegData[o4 + 3] = state.stars.ys[edge.b];
    state.pulseFxData[o2] = head;
    state.pulseFxData[o2 + 1] = intensity;
    pulseCount++;
  }
  state.pulseCount = pulseCount;
}

function relaxStarActivation(state: SimState, dt: number): void {
  const k = 1 - Math.exp(-dt / STAR_ACT_TAU_MS);
  for (let i = 0; i < CONSTELLATION_STAR_COUNT; i++) {
    const peak = state.starPeak[i];
    const extra = Math.min(1, Math.max(0, (state.starSum[i] - peak) * 0.5));
    const target = Math.min(1, peak * (1 + STAR_ACT_DEGREE_BONUS * extra));
    state.starAct[i] += (target - state.starAct[i]) * k;
  }
}

function updateSim(state: SimState, frame: FieldHookFrame): void {
  const now = frame.now;
  const dt = state.lastNow < 0 ? 16 : Math.min(50, Math.max(0, now - state.lastNow));
  state.lastNow = now;

  if (frame.cssW > 1 && (Math.abs(frame.cssW - state.cssW) > 0.5 || Math.abs(frame.cssH - state.cssH) > 0.5)) {
    state.cssW = frame.cssW;
    state.cssH = frame.cssH;
    state.linkRadius = LINK_RADIUS_SCALE * Math.min(frame.cssW, frame.cssH);
    state.pairDist = PAIR_DIST_SCALE * Math.min(frame.cssW, frame.cssH);
    state.graph = buildGraph(state.stars, frame.cssW, frame.cssH);
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
    updateFlares(state, now);
    return;
  }

  if (state.replayRequested) {
    state.replayRequested = false;
    state.replaying = true;
    state.replayStart = now;
    state.replayCascade = false;
    state.lastFlashGlobal = -1e9;
    for (const tri of graph.triangles) tri.lastFlash = -1e9;
  }

  let cursor: { x: number; y: number } | null = null;
  if (state.replaying) {
    const t = (now - state.replayStart) / REPLAY_MS;
    if (t >= 1) {
      state.replaying = false;
      cursor = frame.cursor();
    } else {
      const p = pathPoint(graph.waypoints, t);
      const sec = frame.elapsed * 0.001;
      const amp = 7 * Math.sin(Math.PI * t);
      cursor = {
        x: p.x + amp * (0.7 * Math.sin(sec * 2.1 + 1.3) + 0.3 * Math.sin(sec * 3.7)),
        y: p.y + amp * (0.7 * Math.cos(sec * 1.9) + 0.3 * Math.sin(sec * 3.1 + 2)),
      };
      if (!state.replayCascade && t > REPLAY_CASCADE_T) {
        state.replayCascade = true;
        seedCascade(state, graph, now);
      }
    }
  } else {
    cursor = frame.cursor();
  }

  if (cursor) {
    if (state.hasSmooth) {
      const k = 1 - Math.exp(-dt / 70);
      state.smoothX += (cursor.x - state.smoothX) * k;
      state.smoothY += (cursor.y - state.smoothY) * k;
    } else {
      state.smoothX = cursor.x;
      state.smoothY = cursor.y;
      state.hasSmooth = true;
    }
    state.cursorFade = Math.min(1, state.cursorFade + dt / 260);
  } else {
    state.cursorFade = Math.max(0, state.cursorFade - dt / 380);
    if (state.cursorFade === 0) state.hasSmooth = false;
  }

  for (const edge of graph.edges) {
    let target = 0;
    if (cursor && state.hasSmooth) {
      const da = Math.hypot(graph.sx[edge.a] - state.smoothX, graph.sy[edge.a] - state.smoothY);
      const db = Math.hypot(graph.sx[edge.b] - state.smoothX, graph.sy[edge.b] - state.smoothY);
      const m = Math.max(da, db) / state.linkRadius;
      if (m < 1) target = smooth01((1 - m) / 0.65);
    }
    edge.prevPhase = edge.phase;
    if (target > 0.02) {
      if (edge.activeSince < 0) edge.activeSince = now;
      edge.env = target;
      if (now - edge.activeSince > edge.stagger) edge.phase = Math.min(1, edge.phase + dt / FADE_IN_MS);
    } else {
      edge.activeSince = -1;
      edge.phase = Math.max(0, edge.phase - dt / FADE_OUT_MS);
      if (edge.phase === 0) edge.env = 0;
    }
  }

  updatePulses(state, graph, now);

  for (const tri of graph.triangles) {
    const e0 = graph.edges[tri.e0];
    const e1 = graph.edges[tri.e1];
    const e2 = graph.edges[tri.e2];
    const complete = e0.phase >= 0.8 && e1.phase >= 0.8 && e2.phase >= 0.8 && Math.min(e0.env, e1.env, e2.env) >= 0.45;
    if (complete && !tri.complete && now - state.lastFlashGlobal > 1400 && now - tri.lastFlash > 5000) {
      state.lastFlashGlobal = now;
      tri.lastFlash = now;
      e0.flashStart = now;
      e1.flashStart = now;
      e2.flashStart = now;
    }
    tri.complete = complete;
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
  updateFlares(state, now);

  let count = 0;
  for (const edge of graph.edges) {
    if (count >= CONSTELLATION_MAX_LINES) break;
    const alpha = standardEase(edge.phase) * (0.62 + 0.38 * edge.env) * LINE_PEAK_ALPHA;
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
    state.segData[o4] = state.stars.xs[edge.a];
    state.segData[o4 + 1] = state.stars.ys[edge.a];
    state.segData[o4 + 2] = state.stars.xs[edge.b];
    state.segData[o4 + 3] = state.stars.ys[edge.b];
    state.fxData[o2] = alpha;
    state.fxData[o2 + 1] = flash;
    count++;
  }
  state.lineCount = count;

  packPulses(state, graph, now);
}

const definition: ExperimentDefinition = {
  id: "constellation-web",
  title: "Constellation Web",
  category: "stars",
  blurb:
    "Stars bulge the stripe geometry around them; cursor-linked lines shear it into seams and carry travelling light pulses that flare the stars they reach.",
  create: (ctx) => {
    const state: SimState = {
      stars: buildStars(),
      graph: null,
      cssW: 0,
      cssH: 0,
      linkRadius: 0,
      pairDist: 0,
      smoothX: 0,
      smoothY: 0,
      hasSmooth: false,
      cursorFade: 0,
      lastNow: -1,
      lastFlashGlobal: -1e9,
      replaying: false,
      replayRequested: false,
      replayStart: 0,
      replayCascade: false,
      pulses: [],
      pending: [],
      flareStart: new Float32Array(CONSTELLATION_STAR_COUNT).fill(-1e9),
      segData: new Float32Array(CONSTELLATION_MAX_LINES * 4),
      fxData: new Float32Array(CONSTELLATION_MAX_LINES * 2),
      pulseSegData: new Float32Array(CONSTELLATION_MAX_PULSES * 4),
      pulseFxData: new Float32Array(CONSTELLATION_MAX_PULSES * 2),
      lineCount: 0,
      pulseCount: 0,
      starAct: new Float32Array(CONSTELLATION_STAR_COUNT),
      starFlare: new Float32Array(CONSTELLATION_STAR_COUNT),
      starPeak: new Float32Array(CONSTELLATION_STAR_COUNT),
      starSum: new Float32Array(CONSTELLATION_STAR_COUNT),
    };

    const fieldPass = ({ gl, quad }: EngineHookContext): FieldHookPass => {
      const program = compileProgram(gl, FULLSCREEN_VERT, CONSTELLATION_WEB_FRAG);
      const starTexture = createDataTexture(gl, state.stars.bytes, CONSTELLATION_STAR_COUNT, 1);
      const uField = gl.getUniformLocation(program, "uField");
      const uStars = gl.getUniformLocation(program, "uStars");
      const uCssSize = gl.getUniformLocation(program, "uCssSize");
      const uCursor = gl.getUniformLocation(program, "uCursor");
      const uCursorFade = gl.getUniformLocation(program, "uCursorFade");
      const uLinkRadius = gl.getUniformLocation(program, "uLinkRadius");
      const uTime = gl.getUniformLocation(program, "uTime");
      const uLineCount = gl.getUniformLocation(program, "uLineCount");
      const uPulseCount = gl.getUniformLocation(program, "uPulseCount");
      const uLineSeg = gl.getUniformLocation(program, "uLineSeg");
      const uLineFx = gl.getUniformLocation(program, "uLineFx");
      const uPulseSeg = gl.getUniformLocation(program, "uPulseSeg");
      const uPulseFx = gl.getUniformLocation(program, "uPulseFx");
      const uStarAct = gl.getUniformLocation(program, "uStarAct");
      const uStarFlare = gl.getUniformLocation(program, "uStarFlare");
      return {
        render(frame) {
          updateSim(state, frame);
          gl.bindFramebuffer(gl.FRAMEBUFFER, frame.output.fbo);
          gl.viewport(0, 0, frame.output.width, frame.output.height);
          gl.useProgram(program);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, frame.input.texture);
          gl.uniform1i(uField, 0);
          gl.activeTexture(gl.TEXTURE1);
          gl.bindTexture(gl.TEXTURE_2D, starTexture);
          gl.uniform1i(uStars, 1);
          gl.uniform2f(uCssSize, frame.cssW, frame.cssH);
          gl.uniform2f(uCursor, state.hasSmooth ? state.smoothX : -1e5, state.hasSmooth ? state.smoothY : -1e5);
          gl.uniform1f(uCursorFade, state.cursorFade);
          gl.uniform1f(uLinkRadius, Math.max(1, state.linkRadius));
          gl.uniform1f(uTime, frame.elapsed * 0.001);
          gl.uniform1i(uLineCount, state.lineCount);
          gl.uniform1i(uPulseCount, state.pulseCount);
          gl.uniform4fv(uLineSeg, state.segData);
          gl.uniform2fv(uLineFx, state.fxData);
          gl.uniform4fv(uPulseSeg, state.pulseSegData);
          gl.uniform2fv(uPulseFx, state.pulseFxData);
          gl.uniform1fv(uStarAct, state.starAct);
          gl.uniform1fv(uStarFlare, state.starFlare);
          quad.draw();
        },
        dispose() {
          gl.deleteProgram(program);
          gl.deleteTexture(starTexture);
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
