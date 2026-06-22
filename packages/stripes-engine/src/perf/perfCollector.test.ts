import { describe, it, expect } from "vitest";
import { createPerfCollector } from "./perfCollector";
describe("createPerfCollector", () => {
  it("computes fps from p50 frame time and keeps pass ms", () => {
    const c = createPerfCollector(10);
    for (let i = 0; i < 10; i++) c.recordFrame(16);
    c.recordPasses({ field: 2, present: 1 });
    const s = c.snapshot();
    expect(s.frameMs.p50).toBe(16);
    expect(s.fps).toBeCloseTo(1000 / 16, 1);
    expect(s.passMs).toEqual({ field: 2, present: 1 });
    expect(s.sampleCount).toBe(10);
  });
  it("ring buffer caps samples at capacity", () => {
    const c = createPerfCollector(3);
    c.recordFrame(10);
    c.recordFrame(20);
    c.recordFrame(30);
    c.recordFrame(40);
    expect(c.snapshot().sampleCount).toBe(3);
  });
});
