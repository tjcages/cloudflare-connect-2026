import { describe, it, expect } from "vitest";
import { createSeededRng } from "./rng";
describe("createSeededRng", () => {
  it("is deterministic for a given seed", () => {
    const a = createSeededRng(42),
      b = createSeededRng(42);
    const seqA = [a(), a(), a()],
      seqB = [b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });
  it("differs across seeds and stays in [0,1)", () => {
    const a = createSeededRng(1),
      b = createSeededRng(2);
    expect(a()).not.toEqual(b());
    const r = createSeededRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
