export const COMET_PATH_POINTS = 12;

const CAPACITY = 160;
const MIN_SPACING = 2.5;
const MAX_AGE_MS = 320;
const MIN_TAIL_LEN = 7;

export type CometPath = {
  reset: (x: number, y: number, now: number) => void;
  push: (x: number, y: number, now: number) => void;
  sample: (headX: number, headY: number, now: number, targetLen: number, out: Float32Array) => number;
};

export function createCometPath(): CometPath {
  const px = new Float32Array(CAPACITY);
  const py = new Float32Array(CAPACITY);
  const pt = new Float32Array(CAPACITY);
  const polyX = new Float32Array(CAPACITY + 1);
  const polyY = new Float32Array(CAPACITY + 1);
  const polyL = new Float32Array(CAPACITY + 1);
  let head = 0;
  let count = 0;

  const store = (x: number, y: number, now: number) => {
    head = count === 0 ? 0 : (head + 1) % CAPACITY;
    px[head] = x;
    py[head] = y;
    pt[head] = now;
    if (count < CAPACITY) count += 1;
  };

  return {
    reset(x, y, now) {
      head = 0;
      count = 0;
      store(x, y, now);
    },
    push(x, y, now) {
      if (count === 0) {
        store(x, y, now);
        return;
      }
      const dx = x - px[head];
      const dy = y - py[head];
      if (dx * dx + dy * dy < MIN_SPACING * MIN_SPACING) {
        pt[head] = now;
        return;
      }
      store(x, y, now);
    },
    sample(headX, headY, now, targetLen, out) {
      polyX[0] = headX;
      polyY[0] = headY;
      polyL[0] = 0;
      let n = 1;
      let total = 0;
      for (let i = 0; i < count; i++) {
        const idx = (head - i + CAPACITY) % CAPACITY;
        if (now - pt[idx] > MAX_AGE_MS) break;
        const dx = px[idx] - polyX[n - 1];
        const dy = py[idx] - polyY[n - 1];
        const seg = Math.hypot(dx, dy);
        if (seg < 0.4) continue;
        if (total + seg >= targetLen) {
          const k = (targetLen - total) / seg;
          polyX[n] = polyX[n - 1] + dx * k;
          polyY[n] = polyY[n - 1] + dy * k;
          polyL[n] = targetLen;
          total = targetLen;
          n += 1;
          break;
        }
        total += seg;
        polyX[n] = px[idx];
        polyY[n] = py[idx];
        polyL[n] = total;
        n += 1;
        if (n > CAPACITY) break;
      }
      if (n < 2 || total < MIN_TAIL_LEN) return 0;

      const spacing = total / (COMET_PATH_POINTS - 1);
      let seg = 0;
      for (let i = 0; i < COMET_PATH_POINTS; i++) {
        const at = spacing * i;
        while (seg < n - 2 && polyL[seg + 1] < at) seg += 1;
        const l0 = polyL[seg];
        const l1 = polyL[seg + 1];
        const k = l1 > l0 ? (at - l0) / (l1 - l0) : 0;
        out[i * 2] = polyX[seg] + (polyX[seg + 1] - polyX[seg]) * k;
        out[i * 2 + 1] = polyY[seg] + (polyY[seg + 1] - polyY[seg]) * k;
      }
      for (let i = 1; i < COMET_PATH_POINTS - 1; i++) {
        const o = i * 2;
        out[o] = out[o] * 0.5 + (out[o - 2] + out[o + 2]) * 0.25;
        out[o + 1] = out[o + 1] * 0.5 + (out[o - 1] + out[o + 3]) * 0.25;
      }
      return COMET_PATH_POINTS;
    },
  };
}
