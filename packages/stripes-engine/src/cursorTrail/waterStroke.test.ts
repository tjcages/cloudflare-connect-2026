import { describe, expect, it } from "vitest";
import { createWaterStroke } from "./waterStroke";
import { SUBSTEPS_PER_REFERENCE_FRAME, SUBSTEPS_PER_SECOND } from "../core/simSteps";

const START_X = 100;
const CURSOR_SPEED_PX_PER_SEC = 120;
const WINDOW_MS = 1000;

type Splat = { atMs: number; x: number; amp: number };

/**
 * Replays the dispatch loop `waterSim.step` runs, in display pixels, so a
 * sub-step sequence can be compared across frame rates without a GL context.
 */
function strokeAtFps(fps: number): Splat[] {
  const stroke = createWaterStroke();
  const dt = 1 / fps;
  const at = (ms: number) => ({ x: START_X + (CURSOR_SPEED_PX_PER_SEC * ms) / 1000, y: 200 });
  const splats: Splat[] = [];

  stroke.advance(0, 0, at(0));
  for (let frame = 1; frame <= Math.round((WINDOW_MS / 1000) * fps); frame++) {
    const nowMs = (frame * 1000) / fps;
    const plan = stroke.advance(nowMs, dt, at(nowMs));
    for (let i = 0; i < plan.substeps; i++) {
      const t1 = (i + 1) / plan.substeps;
      splats.push({ atMs: nowMs, x: plan.ax + (plan.bx - plan.ax) * t1, amp: plan.amp });
    }
  }
  return splats;
}

describe("water stroke scheduling", () => {
  it("reproduces the legacy 30fps sequence exactly", () => {
    const stroke = createWaterStroke();
    stroke.advance(0, 0, { x: START_X, y: 200 });
    for (let frame = 1; frame <= 30; frame++) {
      const nowMs = (frame * 1000) / 30;
      const plan = stroke.advance(nowMs, 1 / 30, {
        x: START_X + (CURSOR_SPEED_PX_PER_SEC * nowMs) / 1000,
        y: 200,
      });
      expect(plan.substeps).toBe(SUBSTEPS_PER_REFERENCE_FRAME);
      // Legacy amp was `hypot(travel this frame) * 0.12`, and at 30fps the
      // travel per reference frame is the travel per frame.
      expect(plan.amp).toBeCloseTo((CURSOR_SPEED_PX_PER_SEC / 30) * 0.12, 12);
    }
  });

  it("runs the same sub-steps per second at every frame rate", () => {
    for (const fps of [30, 60, 90, 120, 144, 240]) {
      const splats = strokeAtFps(fps);
      expect(splats.length).toBeGreaterThanOrEqual(SUBSTEPS_PER_SECOND - 1);
      expect(splats.length).toBeLessThanOrEqual(SUBSTEPS_PER_SECOND);
    }
  });

  it("injects the same amplitude per second at every frame rate", () => {
    const reference = strokeAtFps(30).reduce((sum, s) => sum + s.amp, 0);
    for (const fps of [60, 90, 120, 144, 240]) {
      const total = strokeAtFps(fps).reduce((sum, s) => sum + s.amp, 0);
      expect(Math.abs(total - reference) / reference).toBeLessThan(0.01);
    }
  });

  it("lands the k-th sub-step at the same place on the path at every frame rate", () => {
    const reference = strokeAtFps(30);
    // One sub-step of cursor travel: the finest quantum the sequence can differ by.
    const substepTravel = CURSOR_SPEED_PX_PER_SEC / SUBSTEPS_PER_SECOND;
    for (const fps of [60, 90, 120, 144, 240]) {
      const splats = strokeAtFps(fps);
      let worst = 0;
      for (let k = 0; k < Math.min(splats.length, reference.length); k++) {
        worst = Math.max(worst, Math.abs(splats[k].x - reference[k].x));
      }
      expect(worst).toBeLessThanOrEqual(substepTravel);
    }
  });

  it("keeps the wake on the same wall-clock timeline at every frame rate", () => {
    const reference = strokeAtFps(30);
    for (const fps of [60, 90, 120, 144, 240]) {
      const splats = strokeAtFps(fps);
      for (const sample of [0.25, 0.5, 0.75, 1]) {
        const cut = WINDOW_MS * sample;
        const count = (s: Splat[]) => s.filter((x) => x.atMs <= cut).length;
        expect(Math.abs(count(splats) - count(reference))).toBeLessThanOrEqual(SUBSTEPS_PER_REFERENCE_FRAME);
      }
    }
  });

  it("defers travel from a frame too short to owe a sub-step", () => {
    const stroke = createWaterStroke();
    stroke.advance(0, 0, { x: 0, y: 0 });
    expect(stroke.advance(1, 1 / 1000, { x: 1, y: 0 }).substeps).toBe(0);
    expect(stroke.advance(2, 1 / 1000, { x: 2, y: 0 }).substeps).toBe(0);
    const next = stroke.advance(3, 1 / 1000, { x: 3, y: 0 });
    expect(next.substeps).toBeGreaterThan(0);
    // Every skipped frame's travel is still in the segment the sub-steps splat over.
    expect(next.ax).toBe(0);
    expect(next.bx).toBe(3);
  });

  it("clamps a fast flick at the same cursor speed at every frame rate", () => {
    for (const fps of [30, 60, 120]) {
      const stroke = createWaterStroke();
      const speed = 300;
      stroke.advance(0, 0, { x: 0, y: 0 });
      let amp = 0;
      for (let frame = 1; frame <= fps; frame++) {
        const nowMs = (frame * 1000) / fps;
        amp = stroke.advance(nowMs, 1 / fps, { x: (speed * nowMs) / 1000, y: 0 }).amp;
      }
      expect(amp).toBeCloseTo(Math.min(1, (speed / 30) * 0.12), 10);
    }
  });
});
