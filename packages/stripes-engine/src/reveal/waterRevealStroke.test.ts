import { describe, expect, it } from "vitest";
import {
  createWaterRevealStroke,
  REVEAL_SUBSTEPS_PER_REFERENCE_FRAME,
  REVEAL_SUBSTEPS_PER_SECOND,
} from "./waterRevealStroke";
import { serpentinePoint } from "./revealMath";

const DURATION_MS = 2000;
const WINDOW_MS = 1000;
const ROWS = 7;
const WOBBLE = 0.4;
const INTENSITY = 0.8;
/** Sim texture the plan's 0..1 coords are scaled into; deviations are reported in its pixels. */
const SIM_EDGE = 420;

type Splat = { atMs: number; x: number; y: number; amp: number; soak: number };

/**
 * Replays the dispatch loop `waterRevealSim.tick` runs, in sim pixels, so a
 * sub-step sequence can be compared across frame rates without a GL context.
 */
function sweepAtFps(fps: number, windowMs = WINDOW_MS): Splat[] {
  const stroke = createWaterRevealStroke();
  const splats: Splat[] = [];
  for (let frame = 0; frame <= Math.round((windowMs / 1000) * fps); frame++) {
    const elapsedMs = (frame * 1000) / fps;
    const sweepT = Math.min(1, Math.max(0, elapsedMs / DURATION_MS));
    const plan = stroke.advance(elapsedMs, sweepT, ROWS, WOBBLE, INTENSITY);
    for (let i = 0; i < plan.substeps; i++) {
      const t1 = (i + 1) / plan.substeps;
      splats.push({
        atMs: elapsedMs,
        x: (plan.ax + (plan.bx - plan.ax) * t1) * SIM_EDGE,
        y: (plan.ay + (plan.by - plan.ay) * t1) * SIM_EDGE,
        amp: plan.amp,
        soak: plan.soakScale,
      });
    }
  }
  return splats;
}

/** Longest step the sweep path advances per sub-step, in sim px: the finest quantum two schedules can differ by. */
function substepQuantumPx(): number {
  const dt = 1 / REVEAL_SUBSTEPS_PER_SECOND;
  let worst = 0;
  for (let t = 0; t + dt <= WINDOW_MS / DURATION_MS; t += dt) {
    const a = serpentinePoint(t, ROWS, WOBBLE);
    const b = serpentinePoint(t + dt, ROWS, WOBBLE);
    worst = Math.max(worst, Math.hypot(b.x - a.x, b.y - a.y) * SIM_EDGE);
  }
  return worst;
}

describe("water reveal stroke scheduling", () => {
  it("hands a 60fps frame exactly the legacy sub-step count", () => {
    const stroke = createWaterRevealStroke();
    for (let frame = 0; frame <= 60; frame++) {
      const elapsedMs = (frame * 1000) / 60;
      const plan = stroke.advance(elapsedMs, elapsedMs / DURATION_MS, ROWS, WOBBLE, INTENSITY);
      expect(plan.substeps).toBe(REVEAL_SUBSTEPS_PER_REFERENCE_FRAME);
      expect(plan.soakScale).toBeCloseTo(1, 12);
    }
  });

  it("reproduces the legacy 60fps splat path exactly", () => {
    // Legacy walked prev -> current serpentine point every frame, 15 sub-steps
    // across the segment, and added the soak once per frame undivided.
    const stroke = createWaterRevealStroke();
    let prev = serpentinePoint(0, ROWS, WOBBLE);
    for (let frame = 0; frame <= 60; frame++) {
      const elapsedMs = (frame * 1000) / 60;
      const sweepT = elapsedMs / DURATION_MS;
      const plan = stroke.advance(elapsedMs, sweepT, ROWS, WOBBLE, INTENSITY);
      const point = serpentinePoint(sweepT, ROWS, WOBBLE);
      expect(plan.ax).toBeCloseTo(prev.x, 12);
      expect(plan.ay).toBeCloseTo(1 - prev.y, 12);
      expect(plan.bx).toBeCloseTo(point.x, 12);
      expect(plan.by).toBeCloseTo(1 - point.y, 12);
      expect(plan.amp).toBe(INTENSITY);
      prev = point;
    }
  });

  it("runs the same sub-steps per second at every frame rate", () => {
    for (const fps of [30, 60, 90, 120, 144, 240]) {
      const splats = sweepAtFps(fps);
      // Plus the opening reference frame the sweep is always credited.
      const expected = REVEAL_SUBSTEPS_PER_SECOND + REVEAL_SUBSTEPS_PER_REFERENCE_FRAME;
      expect(splats.length).toBeGreaterThanOrEqual(expected - 1);
      expect(splats.length).toBeLessThanOrEqual(expected);
    }
  });

  it("lands the k-th sub-step at the same point on the sweep at every frame rate", () => {
    const reference = sweepAtFps(60);
    const quantum = substepQuantumPx();
    for (const fps of [30, 90, 120, 144, 240]) {
      const splats = sweepAtFps(fps);
      let worst = 0;
      for (let k = 0; k < Math.min(splats.length, reference.length); k++) {
        worst = Math.max(worst, Math.hypot(splats[k].x - reference[k].x, splats[k].y - reference[k].y));
      }
      expect(worst).toBeLessThanOrEqual(quantum);
    }
  });

  it("soaks the same total cover per second at every frame rate", () => {
    // The cover pass runs once per frame, so the soak total is the sum over
    // frames — not over sub-steps.
    const soakAtFps = (fps: number) => {
      const stroke = createWaterRevealStroke();
      let total = 0;
      for (let frame = 0; frame <= Math.round((WINDOW_MS / 1000) * fps); frame++) {
        const elapsedMs = (frame * 1000) / fps;
        total += stroke.advance(elapsedMs, elapsedMs / DURATION_MS, ROWS, WOBBLE, INTENSITY).soakScale;
      }
      return total;
    };
    const reference = soakAtFps(60);
    for (const fps of [30, 90, 120, 144, 240]) {
      expect(Math.abs(soakAtFps(fps) - reference) / reference).toBeLessThan(0.01);
    }
  });

  it("keeps the sweep on the same wall-clock timeline at every frame rate", () => {
    const reference = sweepAtFps(60);
    for (const fps of [30, 90, 120, 144, 240]) {
      const splats = sweepAtFps(fps);
      for (const sample of [0.25, 0.5, 0.75, 1]) {
        const cut = WINDOW_MS * sample;
        const count = (s: Splat[]) => s.filter((x) => x.atMs <= cut).length;
        expect(Math.abs(count(splats) - count(reference))).toBeLessThanOrEqual(REVEAL_SUBSTEPS_PER_REFERENCE_FRAME);
      }
    }
  });

  it("defers travel from a frame too short to owe a sub-step", () => {
    const stroke = createWaterRevealStroke();
    stroke.advance(0, 0, ROWS, WOBBLE, INTENSITY);
    // 0.4ms owes 0.36 of a sub-step, so the first two frames owe none.
    expect(stroke.advance(0.4, 0.4 / DURATION_MS, ROWS, WOBBLE, INTENSITY).substeps).toBe(0);
    expect(stroke.advance(0.8, 0.8 / DURATION_MS, ROWS, WOBBLE, INTENSITY).substeps).toBe(0);
    const next = stroke.advance(1.2, 1.2 / DURATION_MS, ROWS, WOBBLE, INTENSITY);
    expect(next.substeps).toBeGreaterThan(0);
    // Every skipped frame's travel is still in the segment the sub-steps splat over.
    expect(next.ax).toBeCloseTo(serpentinePoint(0, ROWS, WOBBLE).x, 12);
    expect(next.bx).toBeCloseTo(serpentinePoint(1.2 / DURATION_MS, ROWS, WOBBLE).x, 12);
  });

  it("holds the settle ring-down at one rate and stops splatting", () => {
    for (const fps of [30, 60, 120]) {
      const stroke = createWaterRevealStroke();
      let steps = 0;
      let amp = -1;
      for (let frame = 0; frame <= fps; frame++) {
        const plan = stroke.advance(DURATION_MS + (frame * 1000) / fps, 1, ROWS, WOBBLE, INTENSITY);
        steps += plan.substeps;
        amp = plan.amp;
      }
      expect(amp).toBe(0);
      const expected = REVEAL_SUBSTEPS_PER_SECOND + REVEAL_SUBSTEPS_PER_REFERENCE_FRAME;
      expect(steps).toBeGreaterThanOrEqual(expected - 1);
      expect(steps).toBeLessThanOrEqual(expected);
    }
  });

  it("caps a stall instead of bursting a catch-up spiral", () => {
    const stroke = createWaterRevealStroke();
    stroke.advance(0, 0, ROWS, WOBBLE, INTENSITY);
    const stalled = stroke.advance(5000, 0.5, ROWS, WOBBLE, INTENSITY);
    expect(stalled.substeps).toBe(Math.round(0.1 * REVEAL_SUBSTEPS_PER_SECOND));
    expect(stalled.soakScale).toBeCloseTo(0.1 * 60, 12);
  });

  it("resets carried state so a replayed reveal starts clean", () => {
    const stroke = createWaterRevealStroke();
    for (let frame = 0; frame <= 30; frame++) {
      stroke.advance((frame * 1000) / 60, (frame * 1000) / 60 / DURATION_MS, ROWS, WOBBLE, INTENSITY);
    }
    stroke.reset();
    const first = stroke.advance(0, 0, ROWS, WOBBLE, INTENSITY);
    expect(first.substeps).toBe(REVEAL_SUBSTEPS_PER_REFERENCE_FRAME);
    expect(first.ax).toBe(first.bx);
    expect(first.ay).toBe(first.by);
  });
});
