export type MurmurationSim = {
  count: number;
  x: Float32Array;
  y: Float32Array;
  vx: Float32Array;
  vy: Float32Array;
  phase: Float32Array;
  fear: Float32Array;
  cohX: Float32Array;
  cohY: Float32Array;
  alnX: Float32Array;
  alnY: Float32Array;
  sepX: Float32Array;
  sepY: Float32Array;
  nbr: Float32Array;
  random: () => number;
  initialized: boolean;
  lastNowMs: number;
};

export type MurmurationEnv = {
  width: number;
  height: number;
  timeSec: number;
  dtSec: number;
  cursorX: number;
  cursorY: number;
  cursorActive: boolean;
  predatorX: number;
  predatorY: number;
  predatorActive: boolean;
};

const NEIGHBOR_RADIUS = 46;
const SEPARATION_RADIUS = 13;
const MAX_SPEED = 62;
const MIN_SPEED = 24;
const MAX_FORCE = 120;
const CRUISE_RATIO = 0.62;
const COHESION_WEIGHT = 0.62;
const ALIGNMENT_WEIGHT = 0.95;
const SEPARATION_WEIGHT = 1.55;
const ATTRACT_WEIGHT = 0.5;
const CURSOR_WEIGHT = 1.35;
const PREDATOR_WEIGHT = 2.6;
const CURSOR_RADIUS = 88;
const PREDATOR_RADIUS = 135;
const BOUNDARY_MARGIN = 40;
const BOUNDARY_FORCE = 220;
const WANDER_FORCE = 22;
const FEAR_DECAY_TAU = 0.85;
const FEAR_SPEED_BOOST = 1.7;
const FEAR_FORCE_BOOST = 2.2;
const TWO_PI = Math.PI * 2;

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function smoothstep(edge0: number, edge1: number, v: number): number {
  const t = clamp((v - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function murmurationScale(width: number, height: number): number {
  return clamp(Math.min(width, height) / 320, 0.5, 2);
}

export function standardEase(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const cx = 1.8;
  const bx = -3.6;
  const ax = 2.8;
  const cy = 1.8;
  const by = -0.6;
  const ay = -0.2;
  let u = t;
  for (let i = 0; i < 6; i++) {
    const x = ((ax * u + bx) * u + cx) * u - t;
    const dx = (3 * ax * u + 2 * bx) * u + cx;
    if (Math.abs(dx) < 1e-6) break;
    u -= x / dx;
  }
  u = clamp(u, 0, 1);
  return ((ay * u + by) * u + cy) * u;
}

export function createMurmurationSim(count: number, random: () => number): MurmurationSim {
  return {
    count,
    x: new Float32Array(count),
    y: new Float32Array(count),
    vx: new Float32Array(count),
    vy: new Float32Array(count),
    phase: new Float32Array(count),
    fear: new Float32Array(count),
    cohX: new Float32Array(count),
    cohY: new Float32Array(count),
    alnX: new Float32Array(count),
    alnY: new Float32Array(count),
    sepX: new Float32Array(count),
    sepY: new Float32Array(count),
    nbr: new Float32Array(count),
    random,
    initialized: false,
    lastNowMs: -1,
  };
}

export function seedMurmuration(sim: MurmurationSim, width: number, height: number): void {
  const r = sim.random;
  const minDim = Math.min(width, height);
  const clusterRadius = minDim * 0.17;
  const speed = MAX_SPEED * murmurationScale(width, height) * 0.55;
  for (let i = 0; i < sim.count; i++) {
    const second = i % 2 === 1;
    const cx = width * (second ? 0.66 : 0.32);
    const cy = height * (second ? 0.6 : 0.42);
    const rad = clusterRadius * Math.sqrt(r());
    const ang = r() * TWO_PI;
    sim.x[i] = cx + Math.cos(ang) * rad;
    sim.y[i] = cy + Math.sin(ang) * rad;
    const heading = (second ? 2.7 : -0.4) + (r() - 0.5) * 0.8;
    const sp = speed * (0.7 + 0.6 * r());
    sim.vx[i] = Math.cos(heading) * sp;
    sim.vy[i] = Math.sin(heading) * sp;
    sim.phase[i] = r();
    sim.fear[i] = 0;
  }
  sim.initialized = true;
}

export function flockCentroid(sim: MurmurationSim): { x: number; y: number } {
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < sim.count; i++) {
    sx += sim.x[i];
    sy += sim.y[i];
  }
  return { x: sx / sim.count, y: sy / sim.count };
}

export function stepMurmuration(sim: MurmurationSim, env: MurmurationEnv): void {
  const dt = env.dtSec;
  if (dt <= 0) return;
  const n = sim.count;
  const scale = murmurationScale(env.width, env.height);
  const neighborR2 = NEIGHBOR_RADIUS * scale * (NEIGHBOR_RADIUS * scale);
  const sepR = SEPARATION_RADIUS * scale;
  const sepR2 = sepR * sepR;
  const maxSpeed = MAX_SPEED * scale;
  const minSpeed = MIN_SPEED * scale;
  const cruise = maxSpeed * CRUISE_RATIO;
  const maxForce = MAX_FORCE * scale;
  const margin = BOUNDARY_MARGIN * scale;
  const boundaryForce = BOUNDARY_FORCE * scale;
  const wanderForce = WANDER_FORCE * scale;
  const cursorR = CURSOR_RADIUS * scale;
  const predatorR = PREDATOR_RADIUS * scale;
  const fearDecay = Math.exp(-dt / FEAR_DECAY_TAU);
  const t = env.timeSec;

  sim.cohX.fill(0);
  sim.cohY.fill(0);
  sim.alnX.fill(0);
  sim.alnY.fill(0);
  sim.sepX.fill(0);
  sim.sepY.fill(0);
  sim.nbr.fill(0);

  for (let i = 0; i < n; i++) {
    const xi = sim.x[i];
    const yi = sim.y[i];
    for (let j = i + 1; j < n; j++) {
      const dx = sim.x[j] - xi;
      const dy = sim.y[j] - yi;
      const d2 = dx * dx + dy * dy;
      if (d2 >= neighborR2) continue;
      sim.cohX[i] += sim.x[j];
      sim.cohY[i] += sim.y[j];
      sim.alnX[i] += sim.vx[j];
      sim.alnY[i] += sim.vy[j];
      sim.nbr[i] += 1;
      sim.cohX[j] += xi;
      sim.cohY[j] += yi;
      sim.alnX[j] += sim.vx[i];
      sim.alnY[j] += sim.vy[i];
      sim.nbr[j] += 1;
      if (d2 < sepR2) {
        const d = Math.sqrt(Math.max(d2, 0.01));
        const push = (1 - d / sepR) / d;
        sim.sepX[i] -= dx * push;
        sim.sepY[i] -= dy * push;
        sim.sepX[j] += dx * push;
        sim.sepY[j] += dy * push;
      }
    }
  }

  const ax1 = env.width * (0.5 + 0.28 * Math.sin(0.073 * t + 0.9) + 0.13 * Math.sin(0.197 * t + 2.2));
  const ay1 = env.height * (0.5 + 0.25 * Math.sin(0.091 * t + 2.1) + 0.11 * Math.sin(0.283 * t + 0.7));
  const ax2 = env.width * (0.5 + 0.27 * Math.sin(0.111 * t + 3.8) + 0.12 * Math.sin(0.259 * t + 1.3));
  const ay2 = env.height * (0.5 + 0.24 * Math.sin(0.067 * t + 5.2) + 0.12 * Math.sin(0.221 * t + 4.1));

  let steerX = 0;
  let steerY = 0;
  const steerToward = (dirX: number, dirY: number, speed: number, velX: number, velY: number, cap: number): void => {
    const len = Math.hypot(dirX, dirY);
    if (len < 1e-5) {
      steerX = 0;
      steerY = 0;
      return;
    }
    const sx = (dirX / len) * speed - velX;
    const sy = (dirY / len) * speed - velY;
    const sLen = Math.hypot(sx, sy);
    const k = sLen > cap ? cap / sLen : 1;
    steerX = sx * k;
    steerY = sy * k;
  };

  for (let i = 0; i < n; i++) {
    const px = sim.x[i];
    const py = sim.y[i];
    const pvx = sim.vx[i];
    const pvy = sim.vy[i];
    const fear = sim.fear[i];
    const agentMaxSpeed = maxSpeed * (1 + FEAR_SPEED_BOOST * fear);
    const agentMaxForce = maxForce * (1 + FEAR_FORCE_BOOST * fear);
    let accX = 0;
    let accY = 0;

    const count = sim.nbr[i];
    if (count > 0) {
      const inv = 1 / count;
      steerToward(sim.cohX[i] * inv - px, sim.cohY[i] * inv - py, cruise, pvx, pvy, agentMaxForce);
      accX += steerX * COHESION_WEIGHT;
      accY += steerY * COHESION_WEIGHT;
      steerToward(sim.alnX[i] * inv, sim.alnY[i] * inv, cruise, pvx, pvy, agentMaxForce);
      accX += steerX * ALIGNMENT_WEIGHT;
      accY += steerY * ALIGNMENT_WEIGHT;
      steerToward(sim.sepX[i], sim.sepY[i], agentMaxSpeed, pvx, pvy, agentMaxForce);
      accX += steerX * SEPARATION_WEIGHT;
      accY += steerY * SEPARATION_WEIGHT;
    }

    const prefRaw = 0.5 + 0.5 * Math.sin(0.055 * t + sim.phase[i] * TWO_PI);
    const pref = smoothstep(0.35, 0.65, prefRaw);
    const tx = ax1 + (ax2 - ax1) * pref;
    const ty = ay1 + (ay2 - ay1) * pref;
    steerToward(tx - px, ty - py, cruise, pvx, pvy, agentMaxForce);
    accX += steerX * ATTRACT_WEIGHT;
    accY += steerY * ATTRACT_WEIGHT;

    if (env.cursorActive) {
      const cdx = px - env.cursorX;
      const cdy = py - env.cursorY;
      const cd = Math.hypot(cdx, cdy);
      if (cd < cursorR) {
        const falloff = (1 - cd / cursorR) * (1 - cd / cursorR);
        steerToward(cdx, cdy, agentMaxSpeed, pvx, pvy, agentMaxForce);
        accX += steerX * CURSOR_WEIGHT * falloff;
        accY += steerY * CURSOR_WEIGHT * falloff;
      }
    }

    if (env.predatorActive) {
      const pdx = px - env.predatorX;
      const pdy = py - env.predatorY;
      const pd = Math.hypot(pdx, pdy);
      if (pd < predatorR) {
        const falloff = 1 - pd / predatorR;
        steerToward(pdx, pdy, maxSpeed * (1 + FEAR_SPEED_BOOST), pvx, pvy, maxForce * (1 + FEAR_FORCE_BOOST));
        accX += steerX * PREDATOR_WEIGHT * falloff;
        accY += steerY * PREDATOR_WEIGHT * falloff;
        if (falloff > sim.fear[i]) sim.fear[i] = falloff;
      }
    }

    if (px < margin) accX += boundaryForce * (1 - px / margin);
    if (px > env.width - margin) accX -= boundaryForce * (1 - (env.width - px) / margin);
    if (py < margin) accY += boundaryForce * (1 - py / margin);
    if (py > env.height - margin) accY -= boundaryForce * (1 - (env.height - py) / margin);

    accX += wanderForce * Math.sin(1.7 * t + sim.phase[i] * 9.4);
    accY += wanderForce * Math.cos(1.3 * t + sim.phase[i] * 15.7);

    const accLen = Math.hypot(accX, accY);
    const accCap = agentMaxForce * 2.2;
    if (accLen > accCap) {
      const k = accCap / accLen;
      accX *= k;
      accY *= k;
    }

    let nvx = pvx + accX * dt;
    let nvy = pvy + accY * dt;
    const speed = Math.hypot(nvx, nvy);
    if (speed < 1e-4) {
      const ang = sim.phase[i] * TWO_PI;
      nvx = Math.cos(ang) * minSpeed;
      nvy = Math.sin(ang) * minSpeed;
    } else if (speed < minSpeed) {
      const k = minSpeed / speed;
      nvx *= k;
      nvy *= k;
    } else if (speed > agentMaxSpeed) {
      const k = agentMaxSpeed / speed;
      nvx *= k;
      nvy *= k;
    }
    sim.vx[i] = nvx;
    sim.vy[i] = nvy;
    sim.x[i] = clamp(px + nvx * dt, -margin * 2, env.width + margin * 2);
    sim.y[i] = clamp(py + nvy * dt, -margin * 2, env.height + margin * 2);
    sim.fear[i] *= fearDecay;
  }
}

export type PredatorDart = {
  startMs: number;
  durationMs: number;
  x0: number;
  y0: number;
  cx: number;
  cy: number;
  x1: number;
  y1: number;
};

export type PredatorPoint = {
  x: number;
  y: number;
  angle: number;
  done: boolean;
};

export function createPredatorDart(
  width: number,
  height: number,
  targetX: number,
  targetY: number,
  startMs: number,
  random: () => number,
): PredatorDart {
  const margin = Math.max(width, height) * 0.22;
  const fromLeft = targetX >= width * 0.5;
  const x0 = fromLeft ? -margin : width + margin;
  const x1 = fromLeft ? width + margin : -margin;
  const y0 = clamp(targetY + (random() - 0.5) * height * 0.85, height * 0.08, height * 0.92);
  const y1 = clamp(targetY - (y0 - targetY) * (0.5 + random() * 0.9), -margin * 0.4, height + margin * 0.4);
  const jx = clamp(targetX + (random() - 0.5) * width * 0.12, width * 0.15, width * 0.85);
  const jy = clamp(targetY + (random() - 0.5) * height * 0.16, height * 0.12, height * 0.88);
  const cx = 2 * jx - 0.5 * (x0 + x1);
  const cy = 2 * jy - 0.5 * (y0 + y1);
  return { startMs, durationMs: 1600, x0, y0, cx, cy, x1, y1 };
}

export function predatorPoint(dart: PredatorDart, nowMs: number): PredatorPoint {
  const raw = (nowMs - dart.startMs) / dart.durationMs;
  const e = standardEase(clamp(raw, 0, 1));
  const u = 1 - e;
  const x = u * u * dart.x0 + 2 * u * e * dart.cx + e * e * dart.x1;
  const y = u * u * dart.y0 + 2 * u * e * dart.cy + e * e * dart.y1;
  const dx = 2 * u * (dart.cx - dart.x0) + 2 * e * (dart.x1 - dart.cx);
  const dy = 2 * u * (dart.cy - dart.y0) + 2 * e * (dart.y1 - dart.cy);
  return { x, y, angle: Math.atan2(dy, dx), done: raw >= 1 };
}
