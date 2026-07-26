/**
 * Per-frame fill accounting: which passes actually dispatched, at what
 * resolution, and how many render-target pixels they shaded.
 *
 * Output megapixels only measure the final blit; the real GPU cost is the sum
 * of every dispatched pass's render-target area, which this counts. Passes that
 * early-out contribute nothing, so the list is what ran, not what was built.
 *
 * State is module-scope because instances render strictly sequentially on one
 * shared context — the worker's tick loop drives one engine to completion
 * before starting the next. Recording is off unless a stats subscriber asked
 * for it, so the hot path costs a single boolean test per target bind.
 */
export type PassFill = {
  name: string;
  /** Render-target dimensions of the last dispatch in this pass. */
  width: number;
  height: number;
  /** Target binds during this pass — sub-stepped sims bind once per step. */
  dispatches: number;
  /** Summed render-target area across those dispatches. */
  pixels: number;
};

let recording = false;
let current: PassFill | null = null;
let frame: PassFill[] = [];

export function setFillRecording(on: boolean): void {
  if (recording === on) return;
  recording = on;
  current = null;
  frame = [];
}

export function fillRecording(): boolean {
  return recording;
}

export function beginFillFrame(): void {
  if (!recording) return;
  current = null;
  frame = [];
}

export function beginFillPass(name: string): void {
  if (!recording) return;
  current = { name, width: 0, height: 0, dispatches: 0, pixels: 0 };
}

export function endFillPass(): void {
  if (!recording || !current) return;
  if (current.dispatches > 0) frame.push(current);
  current = null;
}

/**
 * Record one dispatch into a `width * height` target. Called wherever a
 * viewport is established — every pass sets one immediately before drawing, so
 * this is an exact per-draw count for fullscreen passes.
 *
 * Particle passes (stars, flames) bind once and then draw instanced quads that
 * cover only part of the target, so their entry is an upper bound.
 */
export function noteFillTarget(width: number, height: number): void {
  if (!recording || !current) return;
  current.width = width;
  current.height = height;
  current.dispatches += 1;
  current.pixels += width * height;
}

export function readFillFrame(): PassFill[] {
  return frame;
}
