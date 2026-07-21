export const LIQUID_NODES = 13;

const LINKS = LIQUID_NODES - 1;
const MAX_SUBSTEP = 1 / 240;
const MAX_SUBSTEPS = 12;
const HEAD_K = 5200;
const HEAD_C = 104;
const LINK_K = 4200;
const LINK_C = 80;
const MAX_LINK = 22;
const HEAD_R = 10.6;
const TAIL_R = 3.2;
const THIN_BASE = 1.16;
const THIN_GAIN = 0.62;
const THIN_MIN = 0.42;
const THIN_MAX = 1.22;

export type LiquidChain = {
  reset: (x: number, y: number) => void;
  step: (dt: number, targetX: number, targetY: number, sc: number) => void;
  pack: (sc: number, outPos: Float32Array, outRad: Float32Array) => void;
};

export function createLiquidChain(): LiquidChain {
  const px = new Float32Array(LIQUID_NODES);
  const py = new Float32Array(LIQUID_NODES);
  const vx = new Float32Array(LIQUID_NODES);
  const vy = new Float32Array(LIQUID_NODES);

  const integrate = (h: number, targetX: number, targetY: number, maxLink: number) => {
    vx[0] += (HEAD_K * (targetX - px[0]) - HEAD_C * vx[0]) * h;
    vy[0] += (HEAD_K * (targetY - py[0]) - HEAD_C * vy[0]) * h;
    px[0] += vx[0] * h;
    py[0] += vy[0] * h;

    for (let i = 1; i < LIQUID_NODES; i++) {
      vx[i] += (LINK_K * (px[i - 1] - px[i]) - LINK_C * vx[i]) * h;
      vy[i] += (LINK_K * (py[i - 1] - py[i]) - LINK_C * vy[i]) * h;
      px[i] += vx[i] * h;
      py[i] += vy[i] * h;

      const dx = px[i] - px[i - 1];
      const dy = py[i] - py[i - 1];
      const d = Math.hypot(dx, dy);
      if (d > maxLink && d > 1e-4) {
        const nx = dx / d;
        const ny = dy / d;
        px[i] = px[i - 1] + nx * maxLink;
        py[i] = py[i - 1] + ny * maxLink;
        const out = vx[i] * nx + vy[i] * ny;
        if (out > 0) {
          vx[i] -= nx * out * 0.7;
          vy[i] -= ny * out * 0.7;
        }
      }
    }
  };

  return {
    reset(x, y) {
      for (let i = 0; i < LIQUID_NODES; i++) {
        px[i] = x;
        py[i] = y;
        vx[i] = 0;
        vy[i] = 0;
      }
    },
    step(dt, targetX, targetY, sc) {
      const steps = Math.min(MAX_SUBSTEPS, Math.max(1, Math.ceil(dt / MAX_SUBSTEP)));
      const h = dt / steps;
      const maxLink = MAX_LINK * sc;
      for (let s = 0; s < steps; s++) integrate(h, targetX, targetY, maxLink);
    },
    pack(sc, outPos, outRad) {
      for (let i = 0; i < LIQUID_NODES; i++) {
        outPos[i * 2] = px[i];
        outPos[i * 2 + 1] = py[i];
      }
      for (let i = 0; i < LIQUID_NODES; i++) {
        const a = i === 0 ? 0 : i - 1;
        const b = i === LINKS ? LINKS : i + 1;
        const span = Math.hypot(px[b] - px[a], py[b] - py[a]) / (b - a || 1);
        const u = i / LINKS;
        const base = (HEAD_R + (TAIL_R - HEAD_R) * u) * sc;
        const thin = Math.min(THIN_MAX, Math.max(THIN_MIN, THIN_BASE - (THIN_GAIN * span) / (10 * sc)));
        outRad[i] = base * thin;
      }
    },
  };
}
